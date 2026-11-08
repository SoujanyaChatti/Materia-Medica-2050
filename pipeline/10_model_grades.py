"""Stage 10 — distance-only baseline and model grades.

For every published model, recompute the exact presences, background and spatial-block folds of
stage 04 and score a distance-only baseline (inverse distance to the nearest training record) on the
same held-out folds. Grade each model:
  standard  >= 30 records, CV AUC >= 0.75 and AUC above the distance baseline
  low       otherwise
  data gap  < 10 records
Candidate models from stage 09 are appended. Writes outputs/model_grades.csv and adds
"baseline" and "grade" to outputs/metrics/<slug>.json.
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from pipeline.lib import config, io, validation  # noqa: E402

OUT = config.OUTPUTS / "model_grades.csv"


def main() -> None:
    spec = importlib.util.spec_from_file_location("s04", Path(__file__).with_name("04_models.py"))
    s04 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(s04)
    occ = pd.read_parquet(config.PROCESSED / "occurrences_clean.parquet")
    tg = pd.read_parquet(config.PROCESSED / "background.parquet")[["decimalLongitude", "decimalLatitude"]].drop_duplicates()
    bg = tg.sample(n=min(config.N_BACKGROUND, len(tg)), random_state=config.SEED)   # identical to stage 04
    bg_X = s04.sample_raster(s04.ENV / "current.tif", bg["decimalLongitude"], bg["decimalLatitude"])
    bg = bg[np.all(np.isfinite(bg_X), axis=1)]

    rows = []
    for slug, g in occ.groupby("species_slug"):
        mpath = config.METRICS / f"{slug}.json"
        m = json.loads(mpath.read_text())
        model = m.get("model") or {}
        pr_X = s04.sample_raster(s04.ENV / "current.tif", g["decimalLongitude"], g["decimalLatitude"])
        pr = g[np.all(np.isfinite(pr_X), axis=1)]
        y = np.r_[np.ones(len(pr)), np.zeros(len(bg))].astype(int)
        lon = np.r_[pr["decimalLongitude"], bg["decimalLongitude"]]
        lat = np.r_[pr["decimalLatitude"], bg["decimalLatitude"]]
        folds = validation.spatial_blocks(lon, lat, config.CV_BLOCK_KM, config.CV_FOLDS, config.SEED)
        base = validation.distance_baseline_auc(y, lon, lat, folds)
        n = int((m.get("records") or {}).get("thinned", len(pr)))
        auc = float(model.get("auc_mean", np.nan)) if model else float("nan")
        grade = validation.model_grade(n, auc, base["auc_mean"])
        m["baseline"] = base
        m["grade"] = grade
        io.write_json(mpath, m)
        rows.append({"model": slug, "kind": "published", "plant": slug, "records_thinned": n, "auc": auc,
                     "auc_sd": model.get("auc_sd"), "baseline_auc": base["auc_mean"], "null_auc": model.get("null_auc_mean"),
                     "beats_baseline": bool(np.isfinite(auc) and auc > base["auc_mean"]), "grade": grade})
        print(f"{slug}: n={n} AUC {auc:.2f} baseline {base['auc_mean']:.2f} -> {grade}")

    cand = config.OUTPUTS / "identification_sensitivity.csv"
    if cand.exists():
        for _, r in pd.read_csv(cand).iterrows():
            auc, b = r.get("auc", np.nan), r.get("baseline_auc", np.nan)
            rows.append({"model": f"{r['slug']} as {r['query_name']}", "kind": "candidate identification", "plant": r["slug"],
                         "records_thinned": int(r["records_thinned"]), "auc": auc, "auc_sd": r.get("auc_sd"),
                         "baseline_auc": b, "null_auc": r.get("null_auc"),
                         "beats_baseline": bool(np.isfinite(auc) and np.isfinite(b) and auc > b), "grade": r["model_grade"]})
    df = pd.DataFrame(rows)
    df.to_csv(OUT, index=False)
    pub = df[df["kind"] == "published"]
    print(pub["grade"].value_counts().to_dict(), "| published models beating baseline:",
          int(pub["beats_baseline"].sum()), "of", len(pub))


if __name__ == "__main__":
    main()
