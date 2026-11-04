"""Stage 07 — export everything the website reads into site/public/data/.

All map layers are ~10 km cells on an EPSG:3035 grid, written as GeoJSON in WGS84. Exact
occurrence coordinates never leave the pipeline. The export is validated against the JSON
Schemas in site/schema/ and the stage fails if anything is invalid or a layer exceeds 300 KB.
"""
from __future__ import annotations

import datetime as dt
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from pipeline.lib import cleaning, config, io, risk, schema  # noqa: E402

CELL_M = config.PUBLIC_CELL_KM * 1000
ROUND = 3  # ~100 m: plenty for 10 km cells, keeps every layer under 300 KB
VERSION = "0.1.0"


class Grid:
    """Maps every climate-raster cell to a 10 km public cell and draws cell polygons in WGS84."""

    def __init__(self):
        import rasterio
        from pyproj import Transformer

        with rasterio.open(config.PROCESSED / "env" / "current.tif") as src:
            self.shape = (src.height, src.width)
            self.transform = src.transform
            land = np.isfinite(src.read(1))
            profile = src.profile
        # Publish Greece only: models are fitted on the wider study box, but every layer, count and
        # range change on the site refers to cells that touch Greece (same mask as stage 04).
        import importlib.util
        spec = importlib.util.spec_from_file_location("s04", Path(__file__).with_name("04_models.py"))
        s04 = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(s04)
        self.land = land & s04.greece_mask(profile)
        rows, cols = np.indices(self.shape)
        lon = self.transform.c + (cols + 0.5) * self.transform.a
        lat = self.transform.f + (rows + 0.5) * self.transform.e
        self.fwd = Transformer.from_crs("EPSG:4326", config.EQUAL_AREA_CRS, always_xy=True)
        self.inv = Transformer.from_crs(config.EQUAL_AREA_CRS, "EPSG:4326", always_xy=True)
        x, y = self.fwd.transform(lon, lat)
        self.ix, self.iy = cleaning.grid_index(x, y, CELL_M)

    def cells(self, mask: np.ndarray) -> set[tuple[int, int]]:
        m = mask & self.land
        return set(zip(self.ix[m].tolist(), self.iy[m].tolist()))

    def mean_by_cell(self, values: np.ndarray) -> dict[tuple[int, int], float]:
        m = self.land & np.isfinite(values)
        df = pd.DataFrame({"ix": self.ix[m], "iy": self.iy[m], "v": values[m]})
        return {(a, b): v for (a, b), v in df.groupby(["ix", "iy"])["v"].mean().items()}

    def polygon(self, ix: int, iy: int, nd: int = ROUND) -> list:
        x0, y0 = ix * CELL_M, iy * CELL_M
        xs = [x0, x0 + CELL_M, x0 + CELL_M, x0, x0]
        ys = [y0, y0, y0 + CELL_M, y0 + CELL_M, y0]
        lon, lat = self.inv.transform(xs, ys)
        return [[[round(a, nd), round(b, nd)] for a, b in zip(lon, lat)]]


def fc(features: list) -> dict:
    return {"type": "FeatureCollection", "features": features}


def feature(grid: Grid, cell: tuple[int, int], props: dict) -> dict:
    return {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": grid.polygon(*cell)}, "properties": props}


def merged(grid: Grid, cells, props: dict) -> dict:
    """All cells of one class as a single MultiPolygon feature (one feature per class keeps files small)."""
    return {"type": "Feature", "properties": props,
            "geometry": {"type": "MultiPolygon", "coordinates": [grid.polygon(*c) for c in sorted(cells)]}}


def read_bin(path: Path) -> np.ndarray | None:
    import rasterio

    if not path.exists():
        return None
    with rasterio.open(path) as src:
        return src.read(1) == 1


def interval(values) -> dict:
    v = [float(x) for x in values if x is not None and np.isfinite(x)]
    if not v:
        return {"median": 0.0, "min": 0.0, "max": 0.0}
    return {"median": round(float(np.median(v)), 1), "min": round(min(v), 1), "max": round(max(v), 1)}


def main() -> None:
    from pyproj import Transformer

    config.ensure_dirs()
    out = config.SITE_DATA
    for sub in ("species", "layers"):
        shutil.rmtree(out / sub, ignore_errors=True)

    species = pd.read_csv(config.CURATED / "species.csv", dtype=str, keep_default_na=False).set_index("slug")
    idents = pd.read_csv(config.CURATED / "identifications.csv", dtype=str, keep_default_na=False)
    rk = pd.read_csv(config.OUTPUTS / "risk.csv").set_index("slug")
    cult = pd.read_csv(config.OUTPUTS / "cultivation.csv").set_index("slug")
    sens = json.loads((config.OUTPUTS / "sensitivity.json").read_text())
    manifest = io.read_manifest()
    occ = pd.read_parquet(config.PROCESSED / "occurrences_clean.parquet")
    to3035 = Transformer.from_crs("EPSG:4326", config.EQUAL_AREA_CRS, always_xy=True)
    occ["x"], occ["y"] = to3035.transform(occ["decimalLongitude"].to_numpy(), occ["decimalLatitude"].to_numpy())
    public_occ = cleaning.aggregate_public(occ)

    grid = Grid()
    greek_cells = grid.cells(np.ones(grid.shape, dtype=bool))
    public_occ = public_occ[[(a, b) in greek_cells for a, b in zip(public_occ["ix"], public_occ["iy"])]]
    import rasterio

    with rasterio.open(config.RASTERS / "natura_frac.tif") as src:
        natura_cell = {k for k, v in grid.mean_by_cell(src.read(1)).items() if v >= 0.5}

    order = rk.sort_values("rank").index.tolist()
    index_of = {s: i for i, s in enumerate(order)}
    grid_now: dict = {}
    grid_loss: dict = {s: {} for s in config.SCENARIOS}
    grid_cult: dict = {s: {} for s in config.SCENARIOS}
    summary_rows = []

    for slug in order:
        sp, r = species.loc[slug], rk.loc[slug]
        metrics = json.loads((config.METRICS / f"{slug}.json").read_text())
        rdir = config.RASTERS / slug
        now = grid.cells(read_bin(rdir / "current_bin.tif"))
        layers = out / "layers" / slug
        io.write_json(layers / "range_now.geojson", fc([merged(grid, now, {"change": "present"})] if now else []), True)
        for c in now:
            grid_now.setdefault(c, []).append(slug)

        range_cells, natura_share = {"now": len(now)}, {"now": round(100 * len(now & natura_cell) / max(len(now), 1), 1)}
        for ssp in config.SCENARIOS:
            per_gcm = [read_bin(rdir / f"{g}_{ssp}_bin.tif") for g in config.GCMS]
            per_gcm = [b for b in per_gcm if b is not None]
            agree = np.mean(per_gcm, axis=0) > config.MODEL_AGREEMENT
            fut = grid.cells(agree)
            feats = [merged(grid, cs, {"change": ch}) for ch, cs in
                     (("kept", now & fut), ("lost", now - fut), ("gained", fut - now)) if cs]
            io.write_json(layers / f"range_2050_{ssp}.geojson", fc(feats), True)
            for c in now - fut:
                grid_loss[ssp].setdefault(c, []).append(slug)
            counts = [len(grid.cells(b)) for b in per_gcm]
            range_cells[ssp] = interval(counts)
            natura_share[ssp] = interval([100 * len(grid.cells(b) & natura_cell) / max(len(grid.cells(b)), 1) for b in per_gcm])
            cmask = read_bin(rdir / f"cult_{ssp}.tif")
            if cmask is not None:
                for c in grid.cells(cmask):
                    grid_cult[ssp][c] = grid_cult[ssp].get(c, 0) + 1
                if ssp == "ssp245":
                    io.write_json(layers / "cultivation.geojson",
                                  fc([merged(grid, grid.cells(cmask), {"scenario": ssp})] if grid.cells(cmask) else []), True)

        po = public_occ[public_occ["species_slug"] == slug]
        io.write_json(layers / "occurrences.geojson",
                      fc([feature(grid, (int(a), int(b)), {"n_records": int(n)}) for a, b, n in zip(po["ix"], po["iy"], po["n_records"])]), True)

        rec = metrics.get("records", {})
        model = metrics.get("model")
        rc = metrics["range_change_pct"]
        cat = r["status_category"]
        alts = idents[(idents["slug"] == slug) & (idents["role"] == "alternative")]
        modelled = idents[(idents["slug"] == slug) & (idents["role"] == "modelled")]
        ema = None
        if sp["ema_monograph"].lower() in ("yes", "true"):
            ema = {"exists": True, "use": sp["ema_use"] or None, "url": sp["ema_url"] or None,
                   "name": (sp.get("ema_name") or "").split(" - ")[0].strip() or None,
                   "reference": None}
        elif sp["ema_monograph"].lower() in ("no", "false"):
            ema = {"exists": False}
        low = bool(rec.get("low_confidence_model", False)) or (model is not None and model.get("auc_mean", 1) < config.AUC_ADEQUATE)
        caveats = []
        if sp["identification_confidence"] != "certain":
            caveats.append(f"Identification is {sp['identification_confidence']}; results describe {sp['accepted_name']}, "
                           "which may not be the plant Dioscorides meant.")
        if low:
            caveats.append(f"Low-confidence model: {rec.get('thinned', 0)} thinned records (we require "
                           f"{config.MIN_RECORDS_RELIABLE}) or AUC below {config.AUC_ADEQUATE}.")
        if sp["notes"]:
            caveats.append(sp["notes"])

        comps = {k: round(float(r[k]), 3) for k in risk.COMPONENTS}
        doc = {
            "slug": slug, "accepted_name": sp["accepted_name"], "common_name_en": sp["common_name_en"],
            "family": sp["family"] or None,
            "dioscorides": {"book": int(sp["dmm_book"]), "chapter": int(sp["dmm_chapter"]) if sp["dmm_chapter"] else None,
                            "greek_name": sp["greek_name"], "greek_translit": sp["greek_translit"] or None,
                            "excerpt": sp.get("excerpt") or None, "paraphrase": None, "paraphrase_ai_assisted": False,
                            "edition": sp.get("excerpt_edition") or "Wellmann 1906–1914",
                            "excerpt_url": sp.get("excerpt_url") or None},
            "identification": {"confidence": sp["identification_confidence"], "source": sp["identification_source"],
                               "note": modelled["notes"].iloc[0] if len(modelled) and modelled["notes"].iloc[0] else None,
                               "reviewed_by": modelled["reviewed_by"].iloc[0] if len(modelled) else None,
                               "alternatives": [{"name": a, "source": s} for a, s in zip(alts["candidate_name"], alts["source"])]},
            "endemic_greece": sp["endemic_greece"].lower() == "true", "endemic_region": sp["endemic_region"] or None,
            "conservation_status": {"category": cat, "source": r["status_source"]} if cat and cat != "NE" else None,
            "ema_monograph": ema,
            "records": {"raw": int(rec.get("raw", 0)), "clean": int(rec.get("clean", 0)), "thinned": int(rec.get("thinned", 0)),
                        "public_cells": int(len(po)), "low_confidence_model": low},
            "model": None if model is None else {k: round(float(model[k]), 3) for k in
                                                 ("auc_mean", "auc_sd", "boyce_mean", "boyce_sd", "tss_mean", "tss_sd", "null_auc_mean")
                                                 if k in model and model[k] is not None and np.isfinite(model[k])} | {"variables": model.get("variables", [])},
            "range_change_pct": {s: interval(rc[s]["per_gcm"]) for s in config.SCENARIOS},
            "range_cells": range_cells, "natura_share_pct": natura_share,
            "risk": {"score": round(float(r["score"]), 3), "score_lo": round(float(r["score_lo"]), 3),
                     "score_hi": round(float(r["score_hi"]), 3), "rank": int(r["rank"]), "rank_lo": int(r["rank_lo"]),
                     "rank_hi": int(r["rank_hi"]), "class": int(r["class"]),
                     "rank_without_disputed": None if pd.isna(r["rank_without_disputed"]) else int(r["rank_without_disputed"]),
                     "top10_stability": round(float(r["top10_stability"]), 3), "components": comps,
                     "components_ci": {"range_loss": [round(float(r["range_loss_lo"]), 3), round(float(r["range_loss_hi"]), 3)]}},
            "cultivation_area_km2": round(float(cult.loc[slug, "area_ssp245"])) if slug in cult.index else None,
            "cultivation_area_km2_range": ({"min": round(float(cult.loc[slug, "area_ssp245_lo"])),
                                            "max": round(float(cult.loc[slug, "area_ssp245_hi"]))} if slug in cult.index else None),
            "caveats": caveats,
        }
        io.write_json(out / "species" / f"{slug}.json", doc)
        summary_rows.append({
            "slug": slug, "accepted_name": doc["accepted_name"], "common_name_en": doc["common_name_en"],
            "greek_name": sp["greek_name"], "dmm_book": doc["dioscorides"]["book"],
            "identification_confidence": sp["identification_confidence"], "endemic_greece": doc["endemic_greece"],
            "endemic_region": doc["endemic_region"], "conservation_category": cat or None, "low_confidence_model": low,
            "risk": {k: doc["risk"][k] for k in ("score", "score_lo", "score_hi", "rank", "rank_lo", "rank_hi", "class")},
            "range_change_pct": doc["range_change_pct"], "model": doc["model"], "records_clean": doc["records"]["clean"],
        })

    io.write_json(out / "species.json", summary_rows)

    # Greece-wide risk grid
    scores = rk["score"].to_dict()
    feats, cell_props = [], {}
    all_cells = set(grid_now) | {c for s in grid_loss.values() for c in s} | {c for s in grid_cult.values() for c in s}
    for c in sorted(all_cells):
        # Empty/zero properties are omitted to stay under 300 KB; the site reads missing as 0/''.
        props: dict = {"id": f"{c[0]}_{c[1]}"}
        if c in natura_cell:
            props["natura"] = 1
        for s, members in [("now", grid_now.get(c, []))] + [(k, grid_loss[k].get(c, [])) for k in config.SCENARIOS]:
            if members:
                mean = float(np.mean([scores[m] for m in members]))
                props[f"class_{s}"] = int(risk.risk_class([mean])[0])
                # Species indices (species.json order) as a base-36 bitmask: bit i set = species i.
                props[f"sp_{s}"] = np.base_repr(sum(1 << index_of[m] for m in members), 36).lower()
            cult_n = grid_cult.get(s, {}).get(c, 0) if s != "now" else 0
            if cult_n:
                props[f"cult_{s}"] = cult_n
        cell_props[props["id"]] = {k: v for k, v in props.items() if k != "id"}
        feats.append({"type": "Feature", "properties": {"id": props["id"]},
                      "geometry": {"type": "Polygon", "coordinates": grid.polygon(*c, nd=2)}})
    # The layer itself carries only cell shapes (≈1 km precision, shared corners round identically so cells
    # still tile); per-cell values live in greece_risk_cells.json, merged by id in the browser.
    io.write_json(out / "layers" / "greece_risk_grid.geojson", fc(feats), True)
    io.write_json(out / "layers" / "greece_risk_cells.json", cell_props, True)

    # Natura 2000 drawn as the outer edges of its 10 km cells (one dashed line on the map).
    edges = []
    for ix, iy in natura_cell:
        for (nx, ny), (a, b) in {(ix, iy - 1): ((0, 0), (1, 0)), (ix, iy + 1): ((0, 1), (1, 1)),
                                 (ix - 1, iy): ((0, 0), (0, 1)), (ix + 1, iy): ((1, 0), (1, 1))}.items():
            if (nx, ny) not in natura_cell:
                xs = [(ix + a[0]) * CELL_M, (ix + b[0]) * CELL_M]
                ys = [(iy + a[1]) * CELL_M, (iy + b[1]) * CELL_M]
                lon, lat = grid.inv.transform(xs, ys)
                edges.append([[round(lon[0], ROUND), round(lat[0], ROUND)], [round(lon[1], ROUND), round(lat[1], ROUND)]])
    io.write_json(out / "layers" / "natura2000_outline.geojson",
                  fc([{"type": "Feature", "properties": {}, "geometry": {"type": "MultiLineString", "coordinates": edges}}]), True)

    oat = sens["one_at_a_time"]
    meta = {
        "sample": False,
        "build_date": dt.date.today().isoformat(),
        "gbif_doi": manifest.get("gbif", {}).get("doi"),
        "versions": {"pipeline": VERSION, "climate": f"{config.CLIMATE_SOURCE} {config.WORLDCLIM_RES}",
                     "dem": "Copernicus GLO-90", "corine": "CLC2018 100 m", "natura2000": "end-2024",
                     "osm": manifest.get("osm", {}).get("date", "Geofabrik Greece extract"),
                     "iucn": "Red List API v4 (2026)"},
        "n_species": len(order),
        "scenarios": {
            "now": {"label": "Now", "title": "Current climate", "description": f"Modelled from the {config.BASELINE_PERIOD} climate baseline."},
            **{k: {"label": v["label"], "title": f"2050 · {'moderate' if k == 'ssp245' else 'high'} emissions",
                   "description": f"{v['long']}, {config.FUTURE_PERIOD}, {len(config.GCMS)} climate models; ranges show the spread."}
               for k, v in config.SCENARIOS.items()},
        },
        "gcms": config.GCMS, "risk_weights": config.RISK_WEIGHTS, "cell_km": config.PUBLIC_CELL_KM,
        "headline_slug": order[0],
        # Median across species; min/max here are the interquartile range across species.
        "summary": {"median_range_change_ssp245": (lambda v: {"median": round(float(np.median(v)), 1),
                                                               "min": round(float(np.percentile(v, 75)), 1),
                                                               "max": round(float(np.percentile(v, 25)), 1)})(
            [row["range_change_pct"]["ssp245"]["median"] for row in summary_rows])},
        "sensitivity": {"draws": sens["draws"], "perturbation": sens["perturbation"], "one_at_a_time": oat["components"],
                        "top_k": oat["top_k"], "top_k_unchanged": {k: round(v * 100, 1) for k, v in oat["top_k_unchanged"].items()},
                        "top10_overlap_without_disputed": sens["top10_overlap_without_disputed"]},
    }
    io.write_json(out / "meta.json", meta)

    problems = schema.validate_export(out)
    if problems:
        raise SystemExit("export failed validation:\n  " + "\n  ".join(problems))
    print(f"exported {len(order)} species to {out}; schema OK")


if __name__ == "__main__":
    main()
