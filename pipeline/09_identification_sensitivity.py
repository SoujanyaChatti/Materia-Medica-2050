"""Stage 09 — identification sensitivity.

For each disputed plant, model every competing candidate taxon named in the cited scholarship
(data/curated/identification_candidates.csv) with the unchanged pipeline: the same GBIF download,
cleaning, ~1 km thinning, variables, MaxEnt + random forest, 5-fold spatial-block CV, 3 GCMs x 2 SSPs
and the 5 km cultivation rule. Then re-rank all 32 plants once per alternative, swapping only that
plant's model-derived components (range loss and harvest access) and keeping every other plant fixed.
Endemism and conservation status stay those of the published identification (see LIMITATIONS).

Outputs: outputs/identification_sensitivity.csv, outputs/identification_sensitivity.json
Usage:   python pipeline/09_identification_sensitivity.py [--limit N]   (N candidates, for a smoke test)
"""
from __future__ import annotations

import importlib.util
import json
import sys
import time
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from pipeline.lib import cleaning, config, io, risk, validation  # noqa: E402

CAND = config.CURATED / "identification_candidates.csv"
OUT_CSV = config.OUTPUTS / "identification_sensitivity.csv"
OUT_JSON = config.OUTPUTS / "identification_sensitivity.json"
RASTERS = config.RASTERS / "_candidates"
COLUMNS = ["taxonKey", "speciesKey", "species", "decimalLongitude", "decimalLatitude", "coordinateUncertaintyInMeters",
           "countryCode", "year", "basisOfRecord", "occurrenceStatus", "issue", "institutionCode", "gbifID"]


def _load(name: str, file: str):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(file))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def cand_id(row) -> str:
    return f"{row['slug']}__{row['query_name'].lower().replace(' ', '-')}"


def main() -> None:
    import rasterio

    t_start = time.time()
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    s01, s04, s06 = _load("s01", "01_species.py"), _load("s04", "04_models.py"), _load("s06", "06_cultivation.py")
    cands = pd.read_csv(CAND, dtype=str)
    if limit:
        cands = cands.head(limit)
    species = pd.read_csv(config.CURATED / "species.csv", dtype=str, keep_default_na=False).set_index("slug")
    published = pd.read_csv(config.OUTPUTS / "risk.csv").set_index("slug")

    # 1. Resolve names the same way stage 01 does (Catalogue of Life XR keys used by the 2026 download, plus backbone).
    keys, names = {}, {}
    for _, c in cands.iterrows():
        cid = cand_id(c)
        col, bb = s01._match(c["query_name"], s01.COL_XR), s01._match(c["query_name"], s01.BACKBONE)
        keys[cid] = {str(m["key"]) for m in (col,) if m["key"]}
        # A name resolving to a subspecies is matched on that taxon key only, never widened to its species.
        names[cid] = {str(m["name"]) for m in (col, bb) if m["name"] and len(str(m["name"]).split()) == 2}
        if len(c["query_name"].split()) == 2 and not any(len(str(m["name"] or "").split()) > 2 for m in (col, bb)):
            names[cid].add(c["query_name"])
        print(f"{cid}: COL {col['key']} '{col['name']}' [{col['match']}], backbone '{bb['name']}' ({bb['status']})")

    # 2. Records from the same DOI'd GBIF download (all vascular plants in the study box).
    manifest = io.read_manifest()
    zip_path = config.RAW / f"{manifest['gbif']['download_key']}.zip"
    with zipfile.ZipFile(zip_path) as z:
        csv_name = next(n for n in z.namelist() if n.endswith(".csv"))
        with z.open(csv_name) as f:
            allp = pd.read_csv(f, sep="\t", usecols=lambda c: c in COLUMNS, low_memory=False, on_bad_lines="skip", quoting=3)
    print(f"GBIF rows: {len(allp)} ({time.time() - t_start:.0f}s)")

    # 3. Shared inputs, built once.
    env_meta = json.loads((s04.ENV / "meta.json").read_text())
    current, profile = s04.read_stack(s04.ENV / "current.tif")
    greece = s04.greece_mask(profile)
    tg = pd.read_parquet(config.PROCESSED / "background.parquet")[["decimalLongitude", "decimalLatitude"]].drop_duplicates()
    bg = tg.sample(n=min(config.N_BACKGROUND, len(tg)), random_state=config.SEED)
    bg_X = s04.sample_raster(s04.ENV / "current.tif", bg["decimalLongitude"], bg["decimalLatitude"])
    bg_ok = np.all(np.isfinite(bg_X), axis=1)
    bg, bg_X = bg[bg_ok], bg_X[bg_ok]
    with rasterio.open(config.PROCESSED / "access_mask.tif") as m:
        access = m.read(1)
    _, transform, shape, crs, first = s06.grid()
    land = np.isfinite(first) & greece
    corine, natura_path = s06._find(s06.CORINE_DIR, "*.tif"), s06._find(s06.NATURA_DIR, "*.gpkg")
    cult_land = s06.corine_cultivable_fraction(corine, transform, shape, crs) >= 0.5
    natura = s06.natura_fraction(natura_path, transform, shape, crs)
    area = s06.cell_area_km2(transform, shape)
    print(f"shared layers ready ({time.time() - t_start:.0f}s)")

    rows = []
    for _, c in cands.iterrows():
        t0 = time.time()
        cid, slug = cand_id(c), c["slug"]
        sel = (allp["speciesKey"].astype(str).isin(keys[cid]) | allp["taxonKey"].astype(str).isin(keys[cid])
               | allp["species"].isin(names[cid]))
        g = allp[sel].assign(species_slug=cid)
        clean, log = cleaning.clean_occurrences(g) if len(g) else (g, {"raw": 0, "clean": 0})
        thin = cleaning.thin(clean, seed=config.SEED) if len(clean) else clean
        row = {"slug": slug, "candidate_as_cited": c["candidate_as_cited"], "query_name": c["query_name"],
               "matched_names": ";".join(sorted(names[cid])) or f"taxon key {';'.join(sorted(keys[cid]))}",
               "source": c["source"], "records_raw": int(log.get("raw", 0)), "records_thinned": int(len(thin))}
        if len(thin) < 10:
            row.update({"model_grade": "data gap", "note": "fewer than 10 thinned GBIF records in the study box"})
            rows.append(row)
            print(f"{cid}: data gap ({len(thin)} records)")
            continue

        pr_X = s04.sample_raster(s04.ENV / "current.tif", thin["decimalLongitude"], thin["decimalLatitude"])
        ok = np.all(np.isfinite(pr_X), axis=1)
        pr, pr_X = thin[ok], pr_X[ok]
        X = np.vstack([pr_X, bg_X])
        y = np.r_[np.ones(len(pr_X)), np.zeros(len(bg_X))].astype(int)
        lon = np.r_[pr["decimalLongitude"], bg["decimalLongitude"]]
        lat = np.r_[pr["decimalLatitude"], bg["decimalLatitude"]]
        cv = s04.cross_validate(X, y, lon, lat, config.SEED)
        base = validation.distance_baseline_auc(y, lon, lat, validation.spatial_blocks(lon, lat, config.CV_BLOCK_KM,
                                                                                         config.CV_FOLDS, config.SEED))
        models = s04.fit_models(X, y, config.SEED)
        thr = cv["threshold"]
        cur = s04.predict_stack(models, current)
        cur_bin = np.isfinite(cur) & (cur >= thr)
        n_now = int((cur_bin & greece).sum())
        out_dir = RASTERS / cid
        s04.write_raster(out_dir / "current_bin.tif", np.where(np.isfinite(cur), cur_bin.astype("uint8"), 255), profile, "uint8")

        change = {s: [] for s in config.SCENARIOS}
        bins = {s: [] for s in config.SCENARIOS}
        for fut in env_meta["futures"]:
            stack, _ = s04.read_stack(s04.ENV / fut["file"])
            p = s04.predict_stack(models, stack)
            b = np.isfinite(p) & (p >= thr)
            bins[fut["ssp"]].append(b)
            change[fut["ssp"]].append(100.0 * (int((b & greece).sum()) - n_now) / n_now if n_now else float("nan"))

        wild = s06.wild_buffer_mask(pr, transform, shape)
        cbase = land & cult_land & (natura < 0.5) & ~wild
        agree = np.mean(bins["ssp245"], axis=0)
        rc = change["ssp245"]
        share = float(access[cur_bin & greece].mean()) if (cur_bin & greece).sum() else 0.0
        grade = validation.model_grade(len(pr), cv["auc_mean"], base["auc_mean"])
        row.update({
            "n_presence": int(len(pr)), "auc": cv["auc_mean"], "auc_sd": cv["auc_sd"], "null_auc": cv["null_auc_mean"],
            "baseline_auc": base["auc_mean"], "model_grade": grade, "current_cells": n_now,
            "range_change_median": float(np.nanmedian(rc)), "range_change_min": float(np.nanmin(rc)),
            "range_change_max": float(np.nanmax(rc)),
            "range_change_ssp585_median": float(np.nanmedian(change["ssp585"])),
            "cultivation_km2": float(area[cbase & (agree > config.MODEL_AGREEMENT)].sum()),
            "cultivation_km2_min": float(area[cbase & (agree >= 1.0)].sum()),
            "cultivation_km2_max": float(area[cbase & (agree > 0)].sum()),
            "harvest_share": share,
        })
        if n_now == 0:
            row["note"] = "no suitable cells in Greece under the current climate; range change undefined"
        rows.append(row)
        print(f"{cid} ({time.time() - t0:.0f}s, {len(pr)} presences): AUC {cv['auc_mean']:.2f} vs baseline "
              f"{base['auc_mean']:.2f}, change {row['range_change_median']:.0f}%, grade {grade}")

    res = pd.DataFrame(rows)

    # 4. Re-rank all 32 plants once per modelled alternative, everything else fixed.
    comps0 = published[risk.COMPONENTS].astype(float)
    top0 = set(published.nsmallest(config.TOP_N, "rank").index)
    entered, left = set(), set()
    for i, r in res.iterrows():
        if r.get("model_grade") == "data gap" or not np.isfinite(r.get("range_change_median", np.nan)):
            continue
        slug, sp = r["slug"], species.loc[r["slug"]]
        comps = comps0.copy()
        comps.loc[slug, "range_loss"] = float(risk.range_loss_component([r["range_change_median"]])[0])
        comps.loc[slug, "harvest"] = float(risk.harvest_component([r["harvest_share"]],
                                                                  [sp["wild_harvest_flag"].lower() == "true"])[0])
        lo_c, hi_c = comps.copy(), comps.copy()
        lo_c.loc[slug, "range_loss"] = float(risk.range_loss_component([max(r["range_change_min"], r["range_change_max"])])[0])
        hi_c.loc[slug, "range_loss"] = float(risk.range_loss_component([min(r["range_change_min"], r["range_change_max"])])[0])
        score = risk.composite(comps)
        ranks = pd.Series(risk.rank_desc(score), index=comps.index)
        s_lo, s_hi = float(risk.composite(lo_c)[slug]), float(risk.composite(hi_c)[slug])
        others = score.drop(slug)
        top = set(ranks.nsmallest(config.TOP_N).index)
        entered |= top - top0
        left |= top0 - top
        res.loc[i, ["risk_score", "risk_score_lo", "risk_score_hi"]] = [float(score[slug]), s_lo, s_hi]
        res.loc[i, "rank"] = int(ranks[slug])
        res.loc[i, "rank_lo"] = int((others > s_hi).sum() + 1)   # best (highest) rank at the high score
        res.loc[i, "rank_hi"] = int((others > s_lo).sum() + 1)
        res.loc[i, "in_top10"] = slug in top
        res.loc[i, "top10_entered"] = ";".join(sorted(top - top0))
        res.loc[i, "top10_left"] = ";".join(sorted(top0 - top))

    res.to_csv(OUT_CSV, index=False)

    per_plant = {}
    for slug, g in res.groupby("slug"):
        m = g[g["rank"].notna()]
        per_plant[slug] = {
            "published_rank": int(published.loc[slug, "rank"]),
            "published_in_top10": slug in top0,
            "candidates": int(len(g)), "modelled": int(len(m)), "data_gap": int((g["model_grade"] == "data gap").sum()),
            "rank_min": int(min(m["rank"].min(), published.loc[slug, "rank"])) if len(m) else None,
            "rank_max": int(max(m["rank"].max(), published.loc[slug, "rank"])) if len(m) else None,
            "top10_status_changes": bool(len(m) and (m["in_top10"].astype(bool) != (slug in top0)).any()),
        }
    summary = {
        "candidates": int(len(res)), "modelled": int(res["rank"].notna().sum()),
        "data_gap": int((res["model_grade"] == "data gap").sum()),
        "plants_entering_top10_under_some_alternative": sorted(entered),
        "plants_leaving_top10_under_some_alternative": sorted(left),
        "plants_moving_in_or_out_of_top10": len(entered | left),
        "disputed_plants_whose_own_top10_status_can_change": sorted(k for k, v in per_plant.items() if v["top10_status_changes"]),
        "per_plant": per_plant,
        "held_fixed": "endemism and conservation status of the published identification; all other 31 plants",
        "runtime_s": round(time.time() - t_start),
    }
    io.write_json(OUT_JSON, summary)
    print(json.dumps({k: v for k, v in summary.items() if k != "per_plant"}, indent=1))


if __name__ == "__main__":
    main()
