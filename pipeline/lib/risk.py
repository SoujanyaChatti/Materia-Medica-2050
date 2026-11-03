"""Composite risk score and its sensitivity analysis (pure numpy/pandas, unit-tested).

Components (each 0..1, higher = more at risk):
  range_loss  projected loss of suitable area by 2050: clip(-change% / 100, 0, 1),
              using the median across climate models under SSP2-4.5
  endemism    1 if endemic to Greece, else 0
  status      IUCN (or checklist) category mapped by config.STATUS_SCORE
  harvest     share of current range within 2 km of roads/settlements, raised to at
              least 0.5 when the species has a documented wild-harvest flag
"""
from __future__ import annotations

from typing import Mapping

import numpy as np
import pandas as pd

from . import config

COMPONENTS = ["range_loss", "endemism", "status", "harvest"]


def range_loss_component(change_pct) -> np.ndarray:
    return np.clip(-np.asarray(change_pct, dtype=float) / 100.0, 0.0, 1.0)


def status_component(categories) -> np.ndarray:
    return np.array([config.STATUS_SCORE.get(str(c).upper(), 0.5) for c in categories], dtype=float)


def harvest_component(share_near_access, wild_harvest_flag) -> np.ndarray:
    share = np.clip(np.asarray(share_near_access, dtype=float), 0.0, 1.0)
    flag = np.asarray(wild_harvest_flag, dtype=bool)
    return np.where(flag, np.maximum(share, 0.5), share)


def normalise_weights(weights: Mapping[str, float]) -> dict[str, float]:
    w = {k: float(weights[k]) for k in COMPONENTS}
    if any(v < 0 for v in w.values()):
        raise ValueError("weights must be non-negative")
    s = sum(w.values())
    if s <= 0:
        raise ValueError("weights must not all be zero")
    return {k: v / s for k, v in w.items()}


def composite(components: pd.DataFrame, weights: Mapping[str, float] = config.RISK_WEIGHTS) -> pd.Series:
    """Weighted sum of the four 0..1 components (weights normalised to sum 1)."""
    w = normalise_weights(weights)
    c = components[COMPONENTS].astype(float)
    if ((c < 0) | (c > 1)).any().any():
        raise ValueError("components must lie in [0, 1]")
    return sum(c[k] * w[k] for k in COMPONENTS)


def contributions(components: pd.DataFrame, weights: Mapping[str, float] = config.RISK_WEIGHTS) -> pd.DataFrame:
    w = normalise_weights(weights)
    return pd.DataFrame({k: components[k].astype(float) * w[k] for k in COMPONENTS})


def risk_class(score) -> np.ndarray:
    """1..5 on 0.2-wide bins (Low, Moderate, Elevated, High, Very high)."""
    s = np.clip(np.asarray(score, dtype=float), 0.0, 1.0)
    return np.minimum((s / 0.2).astype(int) + 1, 5)


def rank_desc(scores) -> np.ndarray:
    """1 = highest score. Ties broken by order (stable) so ranks are a permutation."""
    s = np.asarray(scores, dtype=float)
    order = np.argsort(-s, kind="stable")
    ranks = np.empty(len(s), dtype=int)
    ranks[order] = np.arange(1, len(s) + 1)
    return ranks


def kendall_tau(a, b) -> float:
    """Kendall's tau-a between two rankings (O(n^2); n is small)."""
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    n = len(a)
    if n < 2:
        return 1.0
    i, j = np.triu_indices(n, k=1)
    s = np.sign(a[i] - a[j]) * np.sign(b[i] - b[j])
    return float(s.sum() / (n * (n - 1) / 2))


def random_weight_sensitivity(components: pd.DataFrame, n_draws: int = config.SENSITIVITY_DRAWS,
                              top_n: int = config.TOP_N, seed: int = config.SEED) -> pd.DataFrame:
    """Draw weights uniformly from the simplex (Dirichlet(1,1,1,1)); report per species how often it
    stays in the top N and its 5th-95th percentile rank."""
    rng = np.random.default_rng(seed)
    c = components[COMPONENTS].to_numpy(dtype=float)
    W = rng.dirichlet(np.ones(len(COMPONENTS)), size=n_draws)       # (draws, 4)
    scores = W @ c.T                                                  # (draws, species)
    ranks = np.vstack([rank_desc(s) for s in scores])
    top = min(top_n, c.shape[0])
    return pd.DataFrame({
        "top10_stability": (ranks <= top).mean(axis=0),
        "rank_lo": np.percentile(ranks, 5, axis=0, method="nearest").astype(int),
        "rank_hi": np.percentile(ranks, 95, axis=0, method="nearest").astype(int),
    }, index=components.index)


def one_at_a_time_sensitivity(components: pd.DataFrame, weights: Mapping[str, float] = config.RISK_WEIGHTS,
                              perturb: float = config.SENSITIVITY_PERTURB, n_draws: int = config.SENSITIVITY_DRAWS,
                              seed: int = config.SEED, top_k: int = 3) -> dict:
    """Vary each weight by a factor U(1-p, 1+p) while the others rescale to keep the sum at 1.
    Returns Kendall's tau vs the baseline ranking per component, and the share of all draws
    in which the baseline top-k set is unchanged."""
    rng = np.random.default_rng(seed)
    base_w = normalise_weights(weights)
    base_rank = rank_desc(composite(components, base_w))
    base_top = set(np.where(base_rank <= top_k)[0])
    out: dict = {"components": {}, "top_k": top_k}
    same_top = []
    for k in COMPONENTS:
        taus = []
        for f in rng.uniform(1 - perturb, 1 + perturb, size=n_draws):
            wk = min(base_w[k] * f, 1.0)
            rest = 1.0 - base_w[k]
            w = {o: (base_w[o] * (1 - wk) / rest if rest > 0 else 0.0) for o in COMPONENTS if o != k}
            w[k] = wk
            r = rank_desc(composite(components, w))
            taus.append(kendall_tau(base_rank, r))
            same_top.append(set(np.where(r <= top_k)[0]) == base_top)
        taus = np.array(taus)
        out["components"][k] = {
            "tau_median": float(np.median(taus)),
            "tau_lo": float(np.percentile(taus, 5)),
            "tau_hi": float(np.percentile(taus, 95)),
        }
    st = np.array(same_top, dtype=float)
    # Bootstrap interval on the share so the site can print it with uncertainty.
    boots = [rng.choice(st, size=len(st), replace=True).mean() for _ in range(200)]
    out["top_k_unchanged"] = {"median": float(st.mean()), "min": float(np.percentile(boots, 5)),
                              "max": float(np.percentile(boots, 95))}
    return out


def score_interval(components: pd.DataFrame, range_loss_lo, range_loss_hi,
                   weights: Mapping[str, float] = config.RISK_WEIGHTS) -> tuple[pd.Series, pd.Series]:
    """Score with the range-loss component at the optimistic and pessimistic ends of the
    climate-model spread (all other components fixed)."""
    lo = components.copy()
    hi = components.copy()
    lo["range_loss"] = np.clip(np.minimum(range_loss_lo, range_loss_hi), 0.0, 1.0)
    hi["range_loss"] = np.clip(np.maximum(range_loss_lo, range_loss_hi), 0.0, 1.0)
    return composite(lo, weights), composite(hi, weights)
