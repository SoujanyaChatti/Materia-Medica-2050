import copy
import json

import pytest

from pipeline.lib import config, schema

PRD_EXAMPLE = {
    "slug": "sideritis-syriaca",
    "accepted_name": "Sideritis syriaca L.",
    "common_name_en": "Greek mountain tea",
    "dioscorides": {"book": 3, "chapter": 33, "greek_name": "σιδηρῖτις", "excerpt": "...", "edition": "Wellmann 1906–1914"},
    "identification": {"confidence": "probable", "source": "citation string"},
    "endemic_greece": False,
    "conservation_status": {"category": "NT", "source": "IUCN"},
    "ema_monograph": {"exists": True, "use": "traditional use statement", "url": "..."},
    "records": {"raw": 812, "clean": 214, "low_confidence_model": False},
    "model": {"auc_mean": 0.86, "auc_sd": 0.04, "boyce_mean": 0.71},
    "range_change_pct": {"ssp245": {"median": -38, "min": -22, "max": -55}, "ssp585": {"median": -51, "min": -34, "max": -70}},
    "risk": {"score": 0.74, "rank": 3, "top10_stability": 0.92,
             "components": {"range_loss": 0.8, "endemism": 0.0, "status": 0.6, "harvest": 0.9}},
    "cultivation_area_km2": 1240,
    "caveats": ["GBIF records cluster near Mt Olympus trails"],
}


def test_prd_example_is_valid():
    assert schema.errors("species", PRD_EXAMPLE) == []


@pytest.mark.parametrize("field", ["ema_monograph", "conservation_status"])
def test_optional_fields_may_be_missing_or_null(field):
    doc = copy.deepcopy(PRD_EXAMPLE)
    doc.pop(field)
    assert schema.errors("species", doc) == []
    doc[field] = None
    assert schema.errors("species", doc) == []


def test_schema_catches_bad_values():
    doc = copy.deepcopy(PRD_EXAMPLE)
    doc["identification"]["confidence"] = "maybe"
    doc["risk"]["score"] = 1.7
    del doc["caveats"]
    errs = schema.errors("species", doc)
    assert len(errs) == 3


def test_site_data_validates():
    """Whatever is in site/public/data (sample or real export) must satisfy the contract."""
    if not (config.SITE_DATA / "meta.json").exists():
        pytest.skip("no exported data yet (run `make sample` or `make web`)")
    assert schema.validate_export(config.SITE_DATA) == []


def test_sample_data_is_labelled_and_has_no_points():
    meta_path = config.SITE_DATA / "meta.json"
    if not meta_path.exists():
        pytest.skip("no exported data yet")
    for p in (config.SITE_DATA / "layers").rglob("*.geojson"):
        for f in json.loads(p.read_text())["features"]:
            assert f["geometry"]["type"] != "Point", f"{p} publishes exact points"
