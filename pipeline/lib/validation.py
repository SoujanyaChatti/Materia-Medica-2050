"""Model evaluation helpers: spatial blocks, AUC, TSS and the continuous Boyce index."""
from __future__ import annotations

import math

import numpy as np


def spatial_blocks(lon, lat, block_km: float, n_folds: int, seed: int) -> np.ndarray:
    """Assign each point to a fold by ~block_km square blocks; whole blocks go to one fold."""
    lon = np.asarray(lon, dtype=float)
    lat = np.asarray(lat, dtype=float)
    dlat = block_km / 110.574
    dlon = block_km / (111.320 * math.cos(math.radians(float(np.nanmean(lat)) if len(lat) else 38.5)))
    bx = np.floor(lon / dlon).astype(np.int64)
    by = np.floor(lat / dlat).astype(np.int64)
    keys = bx * 1_000_003 + by
    uniq = np.unique(keys)
    rng = np.random.default_rng(seed)
    fold_of_block = dict(zip(uniq, rng.permutation(len(uniq)) % n_folds))
    return np.array([fold_of_block[k] for k in keys], dtype=int)


def auc(y_true, y_score) -> float:
    """Rank-based ROC AUC (Mann-Whitney U), no sklearn needed."""
    y = np.asarray(y_true, dtype=bool)
    s = np.asarray(y_score, dtype=float)
    n1, n0 = y.sum(), (~y).sum()
    if n1 == 0 or n0 == 0:
        return float("nan")
    order = np.argsort(s, kind="mergesort")
    ranks = np.empty(len(s), dtype=float)
    # average ranks for ties
    sorted_s = s[order]
    i = 0
    while i < len(s):
        j = i
        while j + 1 < len(s) and sorted_s[j + 1] == sorted_s[i]:
            j += 1
        ranks[order[i:j + 1]] = (i + j) / 2.0 + 1
        i = j + 1
    return float((ranks[y].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))


def max_tss(y_true, y_score) -> tuple[float, float]:
    """Maximum true skill statistic and the threshold that achieves it."""
    y = np.asarray(y_true, dtype=bool)
    s = np.asarray(y_score, dtype=float)
    best, thr = -1.0, 0.5
    for t in np.unique(np.quantile(s, np.linspace(0, 1, 101))):
        pred = s >= t
        sens = (pred & y).sum() / max(y.sum(), 1)
        spec = (~pred & ~y).sum() / max((~y).sum(), 1)
        if sens + spec - 1 > best:
            best, thr = sens + spec - 1, float(t)
    return float(best), thr


def boyce_index(presence_scores, background_scores, n_windows: int = 101, window: float = 0.1) -> float:
    """Continuous Boyce index (Hirzel et al. 2006): Spearman correlation between moving-window
    suitability and the predicted-to-expected ratio of presences."""
    p = np.asarray(presence_scores, dtype=float)
    b = np.asarray(background_scores, dtype=float)
    lo, hi = min(p.min(), b.min()), max(p.max(), b.max())
    centres = np.linspace(lo + window * (hi - lo) / 2, hi - window * (hi - lo) / 2, n_windows)
    half = window * (hi - lo) / 2
    pe = []
    for c in centres:
        fp = ((p >= c - half) & (p <= c + half)).mean()
        fb = ((b >= c - half) & (b <= c + half)).mean()
        pe.append(fp / fb if fb > 0 else np.nan)
    pe = np.array(pe)
    ok = ~np.isnan(pe)
    if ok.sum() < 3:
        return float("nan")
    from scipy.stats import spearmanr  # local import keeps the module light for tests
    return float(spearmanr(centres[ok], pe[ok]).statistic)


def distance_baseline_auc(y, lon, lat, folds) -> dict:
    """Distance-only baseline under the same spatial-block CV as the models.

    For each held-out fold, a test point's suitability is the inverse of its distance to the nearest
    training presence (equal-area metres, EPSG:3035). Presences vs background, AUC per fold.
    """
    from pyproj import Transformer
    from scipy.spatial import cKDTree

    y = np.asarray(y, dtype=int)
    x, yy = Transformer.from_crs("EPSG:4326", "EPSG:3035", always_xy=True).transform(np.asarray(lon), np.asarray(lat))
    pts = np.c_[x, yy]
    aucs = []
    for k in np.unique(folds):
        test, train_pres = folds == k, (folds != k) & (y == 1)
        if y[test].sum() < 2 or (y[test] == 0).sum() < 2 or train_pres.sum() < 5:
            continue
        d, _ = cKDTree(pts[train_pres]).query(pts[test])
        aucs.append(auc(y[test], 1.0 / (1.0 + d)))
    return {"auc_mean": float(np.mean(aucs)) if aucs else float("nan"),
            "auc_sd": float(np.std(aucs)) if aucs else float("nan"), "folds_used": len(aucs),
            "method": "inverse distance to nearest training record, same spatial-block folds"}


def model_grade(n_records: int, auc_mean: float, baseline_auc: float, min_reliable: int = 30,
                auc_adequate: float = 0.75) -> str:
    """'data gap' (<10 records), 'standard' (>=30 records, AUC >= 0.75 and beats the distance baseline), else 'low'."""
    if n_records < 10:
        return "data gap"
    ok = (n_records >= min_reliable and np.isfinite(auc_mean) and auc_mean >= auc_adequate
          and (not np.isfinite(baseline_auc) or auc_mean > baseline_auc))
    return "standard" if ok else "low"
