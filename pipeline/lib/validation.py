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
