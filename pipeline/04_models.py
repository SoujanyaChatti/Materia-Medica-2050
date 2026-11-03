"""Stage 04 — species distribution models.

Per species: presences = thinned occurrences; background = target-group background (thinned
records of all curated species, so it carries the same sampling bias). Fits MaxEnt (elapid) and
a random forest, evaluates both with 5-fold spatially blocked CV (~25 km blocks) and against a
null model, then projects the ensemble (mean of the two) to the baseline and every GCM x SSP.
Binary maps use the max-TSS threshold from CV.

Outputs: outputs/rasters/<slug>/{current,<gcm>_<ssp>}.tif (suitability 0..1) and binary
         masks; outputs/metrics/<slug>.json gains "model" and "range_change_pct".
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from pipeline.lib import config, io, validation  # noqa: E402

ENV = config.PROCESSED / "env"


def sample_raster(path: Path, lon, lat) -> np.ndarray:
    import rasterio

    with rasterio.open(path) as src:
        vals = np.array(list(src.sample(zip(lon, lat))), dtype="float32")
    return vals


def read_stack(path: Path):
    import rasterio

    with rasterio.open(path) as src:
        return src.read().astype("float32"), src.profile


def fit_models(X: np.ndarray, y: np.ndarray, seed: int):
    import elapid
    from sklearn.ensemble import RandomForestClassifier

    mx = elapid.MaxentModel(feature_types=["linear", "hinge", "product"], beta_multiplier=1.5, transform="cloglog")
    mx.fit(X, y)
    rf = RandomForestClassifier(n_estimators=500, min_samples_leaf=5, class_weight="balanced_subsample",
                                n_jobs=-1, random_state=seed)
    rf.fit(X, y)
    return mx, rf


def predict(models, X: np.ndarray) -> np.ndarray:
    mx, rf = models
    p_mx = np.asarray(mx.predict(X), dtype=float).ravel()
    p_rf = rf.predict_proba(X)[:, 1]
    return (p_mx + p_rf) / 2.0


def predict_stack(models, stack: np.ndarray) -> np.ndarray:
    bands, h, w = stack.shape
    flat = stack.reshape(bands, -1).T
    ok = np.all(np.isfinite(flat), axis=1)
    out = np.full(h * w, np.nan, dtype="float32")
    if ok.any():
        out[ok] = predict(models, flat[ok])
    return out.reshape(h, w)


def cross_validate(X, y, lon, lat, seed) -> dict:
    folds = validation.spatial_blocks(lon, lat, config.CV_BLOCK_KM, config.CV_FOLDS, seed)
    aucs, tsss, boyces, thrs, null_aucs = [], [], [], [], []
    rng = np.random.default_rng(seed)
    for k in range(config.CV_FOLDS):
        test = folds == k
        if y[test].sum() < 2 or (~y[test].astype(bool)).sum() < 2 or y[~test].sum() < 5:
            continue
        m = fit_models(X[~test], y[~test], seed)
        p = predict(m, X[test])
        aucs.append(validation.auc(y[test], p))
        tss, thr = validation.max_tss(y[test], p)
        tsss.append(tss)
        thrs.append(thr)
        boyces.append(validation.boyce_index(p[y[test] == 1], p[y[test] == 0]))
        null_aucs.append(validation.auc(y[test], rng.random(test.sum())))
    f = lambda a: (float(np.nanmean(a)), float(np.nanstd(a))) if a else (float("nan"), float("nan"))  # noqa: E731
    return {
        "auc_mean": f(aucs)[0], "auc_sd": f(aucs)[1],
        "tss_mean": f(tsss)[0], "tss_sd": f(tsss)[1],
        "boyce_mean": f(boyces)[0], "boyce_sd": f(boyces)[1],
        "null_auc_mean": f(null_aucs)[0],
        "threshold": float(np.nanmedian(thrs)) if thrs else 0.5,
        "folds_used": len(aucs), "cv": f"{config.CV_FOLDS}-fold spatial blocks ~{config.CV_BLOCK_KM:.0f} km",
    }


def write_raster(path: Path, arr: np.ndarray, profile: dict, dtype="float32") -> None:
    import rasterio

    p = profile.copy()
    p.update(count=1, dtype=dtype, nodata=(np.nan if dtype == "float32" else 255), compress="deflate")
    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(path, "w", **p) as dst:
        dst.write(arr.astype(dtype), 1)


def main() -> None:
    rng = config.seed_everything()
    config.ensure_dirs()
    occ = pd.read_parquet(config.PROCESSED / "occurrences_clean.parquet")
    env_meta = json.loads((ENV / "meta.json").read_text())
    current, profile = read_stack(ENV / "current.tif")

    # Target-group background: thinned records of all species (same sampling bias), topped up with
    # random land cells if the group is small.
    tg = occ[["decimalLongitude", "decimalLatitude"]].drop_duplicates()
    bg = tg.sample(n=min(config.N_BACKGROUND, len(tg)), random_state=config.SEED)
    bg_X = sample_raster(ENV / "current.tif", bg["decimalLongitude"], bg["decimalLatitude"])
    bg_ok = np.all(np.isfinite(bg_X), axis=1)
    bg, bg_X = bg[bg_ok], bg_X[bg_ok]

    for slug, g in occ.groupby("species_slug"):
        out_dir = config.RASTERS / slug
        metrics_path = config.METRICS / f"{slug}.json"
        metrics = json.loads(metrics_path.read_text()) if metrics_path.exists() else {}
        if (out_dir / "current_bin.tif").exists() and "model" in metrics and not config.force():
            print(f"cached: {slug}")
            continue
        pr_X = sample_raster(ENV / "current.tif", g["decimalLongitude"], g["decimalLatitude"])
        ok = np.all(np.isfinite(pr_X), axis=1)
        pr, pr_X = g[ok], pr_X[ok]
        if len(pr) < 5:
            print(f"SKIP {slug}: only {len(pr)} usable presences")
            metrics["model"] = None
            io.write_json(metrics_path, metrics)
            continue
        X = np.vstack([pr_X, bg_X])
        y = np.r_[np.ones(len(pr_X)), np.zeros(len(bg_X))].astype(int)
        lon = np.r_[pr["decimalLongitude"], bg["decimalLongitude"]]
        lat = np.r_[pr["decimalLatitude"], bg["decimalLatitude"]]

        cv = cross_validate(X, y, lon, lat, config.SEED)
        models = fit_models(X, y, config.SEED)
        thr = cv["threshold"]

        cur = predict_stack(models, current)
        cur_bin = np.where(np.isfinite(cur), (cur >= thr).astype("uint8"), 255)
        write_raster(out_dir / "current.tif", cur, profile)
        write_raster(out_dir / "current_bin.tif", cur_bin, profile, "uint8")
        n_now = int((cur_bin == 1).sum())

        change: dict[str, list[float]] = {s: [] for s in config.SCENARIOS}
        for fut in env_meta["futures"]:
            stack, _ = read_stack(ENV / fut["file"])
            p = predict_stack(models, stack)
            b = np.where(np.isfinite(p), (p >= thr).astype("uint8"), 255)
            write_raster(out_dir / f"{fut['gcm']}_{fut['ssp']}_bin.tif", b, profile, "uint8")
            n_fut = int((b == 1).sum())
            change[fut["ssp"]].append(100.0 * (n_fut - n_now) / n_now if n_now else float("nan"))

        metrics["model"] = {**cv, "variables": env_meta["variables"], "algorithms": ["maxent (elapid)", "random forest"],
                            "n_presence": int(len(pr)), "n_background": int(len(bg)), "current_cells": n_now,
                            "beats_null": bool(cv["auc_mean"] > cv["null_auc_mean"])}
        metrics["range_change_pct"] = {s: {"median": float(np.nanmedian(v)), "min": float(np.nanmin(v)),
                                           "max": float(np.nanmax(v)), "per_gcm": v}
                                       for s, v in change.items() if v}
        io.write_json(metrics_path, metrics)
        print(f"{slug}: AUC {cv['auc_mean']:.2f}±{cv['auc_sd']:.2f}, Boyce {cv['boyce_mean']:.2f}, "
              f"change ssp245 {metrics['range_change_pct'].get('ssp245', {}).get('median', float('nan')):.0f}%")
    _ = rng


if __name__ == "__main__":
    main()
