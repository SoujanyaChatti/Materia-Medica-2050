"""Stage 05 — composite risk score and sensitivity analysis.

Components per species (see pipeline/lib/risk.py for definitions): range loss, Greek endemism,
conservation status (IUCN API, else the checklist category in species.csv) and harvest pressure
(share of current range within 2 km of OSM roads/settlements, plus the wild-harvest flag).
Weights in config.RISK_WEIGHTS. Sensitivity: 1,000 random weight draws (top-10 stability, rank
interval) and a one-at-a-time +/-50% perturbation per weight (Kendall's tau vs baseline).

Outputs: outputs/risk.csv, outputs/sensitivity.json
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

from pipeline.lib import config, io, risk  # noqa: E402

OSM_URL = "https://download.geofabrik.de/europe/greece-latest.osm.pbf"
OUT = config.OUTPUTS / "risk.csv"
SENS = config.OUTPUTS / "sensitivity.json"
ACCESS = config.PROCESSED / "access_mask.tif"
HIGHWAYS = ("motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "track", "service")
PLACES = ("city", "town", "village", "hamlet")


def access_mask() -> np.ndarray:
    """1 where a climate cell is within 2 km of a road or settlement."""
    import geopandas as gpd
    import rasterio
    from rasterio.features import rasterize

    with rasterio.open(config.PROCESSED / "env" / "current.tif") as src:
        profile, shape, transform = src.profile, (src.height, src.width), src.transform
    if ACCESS.exists() and not config.force():
        with rasterio.open(ACCESS) as m:
            return m.read(1)
    pbf = io.download(OSM_URL, config.RAW / "osm" / "greece-latest.osm.pbf")
    lines = gpd.read_file(pbf, layer="lines", columns=["highway"])
    lines = lines[lines["highway"].isin(HIGHWAYS)]
    pts = gpd.read_file(pbf, layer="points", columns=["place"])
    pts = pts[pts["place"].isin(PLACES)]
    geoms = pd.concat([lines.geometry, pts.geometry]).to_crs(config.GREEK_GRID_CRS).buffer(config.HARVEST_BUFFER_M)
    geoms = gpd.GeoSeries(geoms, crs=config.GREEK_GRID_CRS).to_crs(profile["crs"])
    mask = rasterize(((g, 1) for g in geoms), out_shape=shape, transform=transform, fill=0, dtype="uint8",
                     all_touched=True)
    p = profile.copy()
    p.update(count=1, dtype="uint8", nodata=None)
    with rasterio.open(ACCESS, "w", **p) as dst:
        dst.write(mask, 1)
    return mask


def iucn_category(name: str, token: str) -> tuple[str | None, str | None]:
    import requests

    genus, species = name.split()[:2]
    r = requests.get("https://api.iucnredlist.org/api/v4/taxa/scientific_name",
                     params={"genus_name": genus, "species_name": species},
                     headers={"Authorization": f"Bearer {token}"}, timeout=60)
    if r.status_code != 200:
        return None, None
    assessments = r.json().get("assessments", [])
    glob = [a for a in assessments if any(s.get("description", {}).get("en") == "Global" for s in a.get("scopes", []))]
    latest = sorted(glob or assessments, key=lambda a: a.get("year_published", ""), reverse=True)
    if not latest:
        return None, None
    a = latest[0]
    return a.get("red_list_category_code"), f"IUCN Red List {a.get('year_published', '')}".strip()


def main() -> None:
    load_dotenv(config.ROOT / ".env")
    config.ensure_dirs()
    if io.done(OUT) and io.done(SENS):
        print(f"cached: {OUT}")
        return
    import rasterio

    species = pd.read_csv(config.CURATED / "species.csv", dtype=str, keep_default_na=False).set_index("slug")
    mask = access_mask()
    token = os.environ.get("IUCN_TOKEN", "")

    rows = []
    for slug, sp in species.iterrows():
        m = json.loads((config.METRICS / f"{slug}.json").read_text()) if (config.METRICS / f"{slug}.json").exists() else {}
        rc = (m.get("range_change_pct") or {}).get("ssp245")
        if not rc:
            print(f"SKIP {slug}: no model output")
            continue
        with rasterio.open(config.RASTERS / slug / "current_bin.tif") as src:
            cur = src.read(1) == 1
        share = float((cur & (mask == 1)).sum() / cur.sum()) if cur.sum() else 0.0

        cat, cat_src = (iucn_category(sp["accepted_name"], token) if token else (None, None))
        if not cat:
            cat = (sp["conservation_category"] or "NE").strip("[]").upper()
            cat = cat if cat in config.STATUS_SCORE else "NE"
            cat_src = sp["conservation_source"] or "Vascular Plants of Greece checklist"
        rows.append({
            "slug": slug,
            "range_change_median": rc["median"], "range_change_min": rc["min"], "range_change_max": rc["max"],
            "range_loss": float(risk.range_loss_component([rc["median"]])[0]),
            "range_loss_lo": float(risk.range_loss_component([max(rc["min"], rc["max"])])[0]),
            "range_loss_hi": float(risk.range_loss_component([min(rc["min"], rc["max"])])[0]),
            "endemism": 1.0 if sp["endemic_greece"].lower() == "true" else 0.0,
            "status_category": cat, "status_source": cat_src,
            "status": float(risk.status_component([cat])[0]),
            "harvest_share": share,
            "harvest": float(risk.harvest_component([share], [sp["wild_harvest_flag"].lower() == "true"])[0]),
            "disputed": sp["identification_confidence"] == "disputed",
        })

    df = pd.DataFrame(rows).set_index("slug")
    comps = df[risk.COMPONENTS]
    df["score"] = risk.composite(comps)
    df["score_lo"], df["score_hi"] = risk.score_interval(comps, df["range_loss_lo"], df["range_loss_hi"])
    df["rank"] = risk.rank_desc(df["score"])
    df["class"] = risk.risk_class(df["score"])
    sens = risk.random_weight_sensitivity(comps)
    df = df.join(sens)

    # PRD: results with and without disputed identifications.
    undisputed = df[~df["disputed"]]
    df["rank_without_disputed"] = pd.Series(risk.rank_desc(undisputed["score"]), index=undisputed.index)

    oat = risk.one_at_a_time_sensitivity(comps)
    top = set(df.nsmallest(config.TOP_N, "rank").index)
    top_wo = set(undisputed.nsmallest(config.TOP_N, "rank").index)
    summary = {
        "weights": config.RISK_WEIGHTS, "draws": config.SENSITIVITY_DRAWS, "perturbation": config.SENSITIVITY_PERTURB,
        "one_at_a_time": oat, "top10_overlap_without_disputed": len(top & top_wo) / max(len(top), 1),
    }
    df.sort_values("rank").to_csv(OUT)
    io.write_json(SENS, summary)
    print(df.sort_values("rank")[["score", "score_lo", "score_hi", "rank", "rank_lo", "rank_hi", "top10_stability"]])


if __name__ == "__main__":
    main()
