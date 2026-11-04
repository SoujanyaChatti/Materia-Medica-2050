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
    """Fraction (0..1) of each climate cell lying within 2 km of an OSM road/track or settlement.

    Roads and settlement points are rasterised on a 250 m grid in the Greek Grid (EPSG:2100), a
    Euclidean distance transform gives distance to the nearest feature, and the share of 250 m
    pixels within 2 km is averaged onto the climate grid.
    """
    import pyogrio
    import rasterio
    from rasterio.features import rasterize
    from rasterio.transform import from_origin
    from rasterio.warp import Resampling, reproject, transform_bounds
    from scipy.ndimage import distance_transform_edt

    with rasterio.open(config.PROCESSED / "env" / "current.tif") as src:
        profile, shape, transform, crs = src.profile, (src.height, src.width), src.transform, src.crs
    if ACCESS.exists() and not config.force():
        with rasterio.open(ACCESS) as m:
            return m.read(1)
    pbf = io.download(OSM_URL, config.RAW / "osm" / "greece-latest.osm.pbf")
    hw = ",".join(f"'{h}'" for h in HIGHWAYS)
    pl = ",".join(f"'{p}'" for p in PLACES)
    lines = pyogrio.read_dataframe(pbf, layer="lines", columns=["highway"], where=f"highway IN ({hw})")
    pts = pyogrio.read_dataframe(pbf, layer="points", columns=["place"], where=f"place IN ({pl})")
    print(f"OSM: {len(lines)} road/track lines, {len(pts)} settlements")
    geoms = pd.concat([lines.geometry.to_crs(config.GREEK_GRID_CRS), pts.geometry.to_crs(config.GREEK_GRID_CRS)])

    res = 250.0
    x0, y0, x1, y1 = transform_bounds("EPSG:4326", config.GREEK_GRID_CRS, *config.STUDY_BBOX)
    W, H = int(np.ceil((x1 - x0) / res)), int(np.ceil((y1 - y0) / res))
    ftrans = from_origin(x0, y1, res, res)
    feat = rasterize(((g, 1) for g in geoms if g is not None), out_shape=(H, W), transform=ftrans, fill=0,
                     dtype="uint8", all_touched=True)
    dist = distance_transform_edt(feat == 0, sampling=res)
    near = (dist <= config.HARVEST_BUFFER_M).astype("float32")
    frac = np.zeros(shape, dtype="float32")
    reproject(near, frac, src_transform=ftrans, src_crs=config.GREEK_GRID_CRS, dst_transform=transform, dst_crs=crs,
              resampling=Resampling.average)
    p = profile.copy()
    p.update(count=1, dtype="float32", nodata=None)
    with rasterio.open(ACCESS, "w", **p) as dst:
        dst.write(frac, 1)
    return frac


def iucn_category(name: str, token: str) -> tuple[str | None, str | None]:
    import requests

    genus, species = name.split()[:2]
    r = requests.get("https://api.iucnredlist.org/api/v4/taxa/scientific_name",
                     params={"genus_name": genus, "species_name": species},
                     headers={"Authorization": f"Bearer {token}"}, timeout=60)
    if r.status_code != 200:
        return None, None
    assessments = r.json().get("assessments", [])
    # Global assessments only: regional ones (e.g. Europe) do not describe the species' global status.
    glob = [a for a in assessments if any(s.get("description", {}).get("en") == "Global" for s in a.get("scopes", []))]
    latest = sorted(glob, key=lambda a: a.get("year_published", ""), reverse=True)
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
    if config.only_species():
        species = species[species.index.isin(config.only_species())]
    mask = access_mask()
    import importlib.util
    spec = importlib.util.spec_from_file_location("s04", Path(__file__).with_name("04_models.py"))
    s04 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(s04)
    with rasterio.open(config.PROCESSED / "env" / "current.tif") as src:
        greece = s04.greece_mask(src.profile)
    token = os.environ.get("IUCN_TOKEN", "")

    rows = []
    for slug, sp in species.iterrows():
        m = json.loads((config.METRICS / f"{slug}.json").read_text()) if (config.METRICS / f"{slug}.json").exists() else {}
        rc = (m.get("range_change_pct") or {}).get("ssp245")
        if not rc:
            print(f"SKIP {slug}: no model output")
            continue
        with rasterio.open(config.RASTERS / slug / "current_bin.tif") as src:
            cur = (src.read(1) == 1) & greece   # OSM covers Greece only
        share = float(mask[cur].mean()) if cur.sum() else 0.0   # mean share of range within 2 km of access

        cat, cat_src = None, None
        if token:  # pooled plants (model_taxa) take the most threatened of their species
            names = [t.strip() for t in (sp.get("model_taxa") or "").split(";") if t.strip()] or [sp["accepted_name"]]
            found = [(*c, n) for n in names for c in [iucn_category(n, token)] if c[0]]
            order = ["CR", "EN", "VU", "NT", "LC", "DD"]
            found.sort(key=lambda c: order.index(c[0]) if c[0] in order else 99)
            if found:
                cat, cat_src, who = found[0]
                if len(names) > 1:
                    cat_src = f"{cat_src} ({who}; most threatened of the pooled species)"
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
