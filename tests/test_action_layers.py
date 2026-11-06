"""Stage 08: geometry helpers, bitmask encoding, and the grower index against stage 07's counts."""
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("action_layers", ROOT / "pipeline" / "08_action_layers.py")
al = importlib.util.module_from_spec(spec)
spec.loader.exec_module(al)

SQUARE = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
HOLE = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]


def test_point_in_polygon_with_hole():
    assert al.point_in_polygon(2, 2, [SQUARE, HOLE])
    assert not al.point_in_polygon(5, 5, [SQUARE, HOLE])
    assert not al.point_in_polygon(11, 5, [SQUARE])


def test_base36_roundtrip():
    for n in (1, 2, 35, 36, 2**31 + 7, 2**52 - 1):
        assert int(al.base36(n), 36) == n


def test_authorities_ordered_by_mention():
    found = al.authorities_in("Matthiolus, rejected by Sprengel 1830, vol. 2, p. 588")
    assert [label.split(",")[0] for _, label in found] == ["Matthiolus", "Sprengel"]


WEB = ROOT / "site" / "public" / "data"


@pytest.mark.skipif(not (WEB / "layers" / "greece_risk_cells.json").exists(), reason="no web export")
def test_grower_index_matches_stage07_counts():
    grower = al.grower_cells()
    cells = json.loads((WEB / "layers" / "greece_risk_cells.json").read_text())
    for cid, props in cells.items():
        expect = int(props.get("cult_ssp245", 0) or 0)
        got = bin(int(grower.get(cid, {}).get("ssp245", "0"), 36)).count("1")
        assert got == expect, cid


@pytest.mark.skipif(not (ROOT / "data" / "curated" / "identifications.csv").exists(), reason="no curated data")
def test_lineage_covers_every_species_and_stances_are_known():
    lin = al.lineage()
    assert len(lin) == len(json.loads((WEB / "species.json").read_text()))
    stances = {c["stance"] for p in lin for c in p["claims"]}
    assert stances <= {"cited", "proposed", "preferred", "rejected", "unverified"}
    # Our own identification's sources are never parsed as a stance.
    assert all(c["stance"] == "cited" for p in lin for c in p["claims"] if c["role"] == "modelled")
