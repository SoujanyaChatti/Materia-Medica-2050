import numpy as np
import pandas as pd
import pytest

from pipeline.lib import risk, validation


@pytest.fixture
def comps():
    return pd.DataFrame({
        "range_loss": [0.8, 0.4, 0.1, 0.6, 0.0],
        "endemism":   [1.0, 0.0, 0.0, 1.0, 0.0],
        "status":     [0.25, 0.0, 0.5, 0.0, 0.0],
        "harvest":    [0.9, 0.5, 0.2, 0.1, 0.0],
    }, index=list("abcde"))


def test_components():
    assert np.allclose(risk.range_loss_component([-38, 12, -150]), [0.38, 0.0, 1.0])
    assert np.allclose(risk.status_component(["LC", "nt", "CR", "??"]), [0.0, 0.25, 1.0, 0.5])
    assert np.allclose(risk.harvest_component([0.2, 0.7, 0.2], [True, True, False]), [0.5, 0.7, 0.2])


def test_composite_is_weighted_mean(comps):
    w = {"range_loss": 0.4, "endemism": 0.2, "status": 0.2, "harvest": 0.2}
    s = risk.composite(comps, w)
    assert s["a"] == pytest.approx(0.4 * 0.8 + 0.2 * 1 + 0.2 * 0.25 + 0.2 * 0.9)
    assert s["e"] == 0
    # weights are normalised, so scaling them changes nothing
    assert np.allclose(s, risk.composite(comps, {k: v * 7 for k, v in w.items()}))
    assert np.allclose(risk.contributions(comps, w).sum(axis=1), s)


def test_composite_rejects_out_of_range(comps):
    bad = comps.copy()
    bad.loc["a", "harvest"] = 1.5
    with pytest.raises(ValueError):
        risk.composite(bad)
    with pytest.raises(ValueError):
        risk.normalise_weights({"range_loss": 0, "endemism": 0, "status": 0, "harvest": 0})


def test_class_and_rank():
    assert list(risk.risk_class([0.0, 0.19, 0.2, 0.61, 0.8, 1.0])) == [1, 1, 2, 4, 5, 5]
    assert list(risk.rank_desc([0.2, 0.9, 0.5])) == [3, 1, 2]


def test_kendall():
    assert risk.kendall_tau([1, 2, 3, 4], [1, 2, 3, 4]) == 1.0
    assert risk.kendall_tau([1, 2, 3, 4], [4, 3, 2, 1]) == -1.0


def test_random_weight_sensitivity_is_seeded_and_bounded(comps):
    a = risk.random_weight_sensitivity(comps, n_draws=200, top_n=2, seed=3)
    b = risk.random_weight_sensitivity(comps, n_draws=200, top_n=2, seed=3)
    pd.testing.assert_frame_equal(a, b)
    assert a["top10_stability"].between(0, 1).all()
    assert (a["rank_lo"] <= a["rank_hi"]).all()
    assert a.loc["e", "top10_stability"] == 0  # all-zero species never makes top 2
    assert a["top10_stability"].sum() == pytest.approx(2.0)  # exactly top_n slots per draw


def test_one_at_a_time(comps):
    out = risk.one_at_a_time_sensitivity(comps, n_draws=50, seed=1)
    for v in out["components"].values():
        assert -1 <= v["tau_lo"] <= v["tau_median"] <= v["tau_hi"] <= 1
    assert 0 <= out["top_k_unchanged"]["median"] <= 1


def test_score_interval_brackets_score(comps):
    lo, hi = risk.score_interval(comps, comps["range_loss"] - 0.1, (comps["range_loss"] + 0.1).clip(upper=1))
    s = risk.composite(comps)
    assert (lo <= s + 1e-12).all() and (s <= hi + 1e-12).all()


def test_validation_metrics():
    y = np.array([1, 1, 1, 0, 0, 0])
    assert validation.auc(y, [0.9, 0.8, 0.7, 0.3, 0.2, 0.1]) == 1.0
    assert validation.auc(y, [0.5] * 6) == 0.5
    tss, _ = validation.max_tss(y, [0.9, 0.8, 0.7, 0.3, 0.2, 0.1])
    assert tss == pytest.approx(1.0)
    folds = validation.spatial_blocks(np.r_[np.full(10, 22.0), np.full(10, 25.0)], np.full(20, 38.0), 25, 5, 0)
    assert len(set(folds[:10])) == 1 and len(set(folds[10:])) == 1  # a block stays in one fold


def test_distance_baseline_and_grade():
    import numpy as np
    from pipeline.lib import validation
    rng = np.random.default_rng(0)
    # presences clustered in one corner, background everywhere: distance baseline should beat chance
    lon = np.r_[rng.uniform(21, 22, 200), rng.uniform(20, 28, 2000)]
    lat = np.r_[rng.uniform(37, 38, 200), rng.uniform(35, 41, 2000)]
    y = np.r_[np.ones(200), np.zeros(2000)].astype(int)
    folds = validation.spatial_blocks(lon, lat, 25, 5, 1)
    r = validation.distance_baseline_auc(y, lon, lat, folds)
    assert r["folds_used"] >= 3 and r["auc_mean"] > 0.7
    assert validation.model_grade(5, 0.9, 0.5) == "data gap"
    assert validation.model_grade(40, 0.9, 0.8) == "standard"
    assert validation.model_grade(40, 0.9, 0.95) == "low"
    assert validation.model_grade(20, 0.9, 0.5) == "low"
