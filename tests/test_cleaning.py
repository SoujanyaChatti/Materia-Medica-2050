import numpy as np
import pandas as pd

from pipeline.lib import cleaning


def rec(**kw):
    base = {"species_slug": "a", "decimalLongitude": 22.5, "decimalLatitude": 39.5, "year": 2005,
            "coordinateUncertaintyInMeters": 100.0, "basisOfRecord": "HUMAN_OBSERVATION",
            "eventDate": "2005-06-01", "locality": "slope above village", "institutionCode": "iNat"}
    base.update(kw)
    return base


def test_each_filter_drops_exactly_its_record():
    rows = [
        rec(),                                                       # keep
        rec(decimalLongitude=None),                                  # missing
        rec(decimalLongitude=0.0, decimalLatitude=0.0),              # zero
        rec(decimalLongitude=21.82, decimalLatitude=39.07),          # country centroid
        rec(basisOfRecord="LIVING_SPECIMEN", decimalLatitude=39.6),  # cultivated in a garden
        rec(locality="Botanical Garden of Athens", decimalLatitude=39.7),
        rec(),                                                       # duplicate of first
        rec(year=1950, decimalLatitude=39.8),                        # too old
        rec(coordinateUncertaintyInMeters=20_000, decimalLatitude=39.9),
        rec(coordinateUncertaintyInMeters=None, decimalLatitude=40.0),  # unknown uncertainty is kept
    ]
    clean, log = cleaning.clean_occurrences(pd.DataFrame(rows))
    assert log["raw"] == 10
    assert log["missing_coords"] == 1
    assert log["zero_coords"] == 1
    assert log["country_centroid"] == 1
    assert log["institution"] == 2
    assert log["duplicate"] == 1
    assert log["before_min_year"] == 1
    assert log["coord_uncertainty"] == 1
    assert log["clean"] == len(clean) == 2


def test_missing_columns_raise():
    import pytest

    with pytest.raises(ValueError):
        cleaning.clean_occurrences(pd.DataFrame({"species_slug": ["a"]}))


def test_thin_keeps_one_per_cell_and_is_deterministic():
    rng = np.random.default_rng(0)
    df = pd.DataFrame({
        "species_slug": ["a"] * 50 + ["b"] * 50,
        "decimalLongitude": 22.0 + rng.uniform(0, 0.001, 100),  # all within one ~1 km cell
        "decimalLatitude": 39.0 + rng.uniform(0, 0.001, 100),
    })
    t1 = cleaning.thin(df, cell_km=1.0, seed=1)
    t2 = cleaning.thin(df, cell_km=1.0, seed=1)
    assert sorted(t1["species_slug"]) == ["a", "b"]
    pd.testing.assert_frame_equal(t1, t2)


def test_public_aggregation_never_returns_points():
    df = pd.DataFrame({"species_slug": ["a", "a", "a"], "x": [5_000.0, 9_999.0, 15_000.0], "y": [1.0, 2.0, 3.0]})
    g = cleaning.aggregate_public(df, cell_km=10)
    assert set(g.columns) >= {"ix", "iy", "n_records", "x0", "y0"}
    assert "x" not in g.columns and "y" not in g.columns
    assert sorted(g["n_records"]) == [1, 2]
    assert set(g["x0"]) == {0.0, 10_000.0}
