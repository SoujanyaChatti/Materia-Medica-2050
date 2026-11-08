"""Stage 08: action layers for the website, derived only from stage-07 exports and curated CSVs.

Writes two files into site/public/data/ (no new science; a spatial join and a citation parse):

1. layers/grower_cells.json  {cell_id: {"ssp245": "<base-36 bitmask over species.json order>"}}
   A grid cell lists a species when the cell's centre falls inside that species' 2050 cultivation zone.
   Stage 07 builds each zone as a union of whole grid cells, so the centre test is exact; it is checked
   against the per-cell cultivation counts (cult_<scenario>) that stage 07 already writes. Stage 07
   exports zone outlines for SSP2-4.5 only, so only that scenario is indexed.

2. lineage.json  one entry per plant: the Dioscorides chapter, every candidate identification with
   the authority who proposed, preferred or rejected it, and the authority's date, so the site can
   draw five centuries of identification as a timeline. Dates are the authority's main botanical or
   Dioscoridean work and are approximate (marked "c.").

Standard library only, so it runs without the modelling environment:  python pipeline/08_action_layers.py
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "site" / "public" / "data"
CURATED = ROOT / "data" / "curated"
SCENARIOS = ("ssp245",)  # stage 07 writes cultivation.geojson for SSP2-4.5 only

# Authority -> (year of the work we cite or that Sprengel cites, short label). Approximate dates of
# each author's principal herbal / commentary; used only to order the timeline.
AUTHORITIES: list[tuple[str, int, str]] = [
    (r"\bBrunfels", 1530, "Brunfels, Herbarum vivae eicones"),
    (r"\bTragus|\bBock\b", 1539, "Tragus (Bock), New Kreütter Buch"),
    (r"\bFuchs", 1542, "Fuchs, De historia stirpium"),
    (r"\bMatthiol", 1554, "Matthiolus, Commentarii in Dioscoridem"),
    (r"\bAnguillara", 1561, "Anguillara, Semplici"),
    (r"\bDodon", 1583, "Dodonaeus, Stirpium historiae"),
    (r"\bLobel", 1576, "Lobel, Plantarum seu stirpium historia"),
    (r"\bDalecham", 1586, "Dalechamps, Historia generalis plantarum"),
    (r"\bColumna", 1592, "Fabius Columna, Phytobasanos"),
    (r"\bClusius", 1601, "Clusius, Rariorum plantarum historia"),
    (r"\bBauhin", 1623, "C. Bauhin, Pinax"),
    (r"\bTournefort", 1700, "Tournefort, Institutiones rei herbariae"),
    (r"\bLinn", 1753, "Linnaeus, Species plantarum"),
    (r"\bSibthorp", 1806, "Sibthorp, Flora Graeca"),
    (r"\bSprengel", 1830, "Sprengel, Dioscorides commentary"),
    (r"\bFraas", 1845, "Fraas, Synopsis plantarum florae classicae"),
    (r"\bWellmann", 1906, "Wellmann, De materia medica (ed.)"),
    (r"\bBeck\b", 2005, "Beck, De materia medica (transl.)"),
    (r"\bOsbaldeston", 2000, "Osbaldeston, De materia medica (transl.)"),
    (r"\bDimopoulos", 2013, "Dimopoulos et al., Vascular plants of Greece"),
    (r"\bEMA\b|HMPC", 2010, "EMA / HMPC herbal monograph"),
    (r"\bWCVP|POWO", 2021, "WCVP / POWO (Kew)"),
]
# Who is being *reported*: "X, cited by Sprengel" means X proposed it and Sprengel is our witness.
STANCE = [
    (re.compile(r"rejected|hallucinat|supersed", re.I), "rejected"),
    (re.compile(r"preferred|placet|accept", re.I), "preferred"),
    (re.compile(r"unverified", re.I), "unverified"),
]


def load(rel: str):
    return json.loads((WEB / rel).read_text(encoding="utf-8"))


# ---------------------------------------------------------------- geometry (lon/lat, planar is fine at 10 km)
def point_in_ring(x: float, y: float, ring: list[list[float]]) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def point_in_polygon(x: float, y: float, poly: list[list[list[float]]]) -> bool:
    return point_in_ring(x, y, poly[0]) and not any(point_in_ring(x, y, h) for h in poly[1:])


def polygons(geom: dict) -> list[list[list[list[float]]]]:
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    if geom["type"] == "MultiPolygon":
        return geom["coordinates"]
    return []


def bbox(ring):
    xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
    return min(xs), min(ys), max(xs), max(ys)


def overlaps(cell_ring, cell_box, poly, poly_box) -> bool:
    """Zones are unions of whole grid cells, so the cell centre decides membership exactly."""
    if poly_box[2] < cell_box[0] or poly_box[0] > cell_box[2] or poly_box[3] < cell_box[1] or poly_box[1] > cell_box[3]:
        return False
    xs = [p[0] for p in cell_ring[:-1]]; ys = [p[1] for p in cell_ring[:-1]]
    return point_in_polygon(sum(xs) / len(xs), sum(ys) / len(ys), poly)


def grower_cells() -> dict:
    species = load("species.json")
    species.sort(key=lambda s: s["risk"]["rank"])  # same order the site and the risk-cell bitmasks use
    grid = load("layers/greece_risk_grid.geojson")
    cells = [(str(f["properties"]["id"]), f["geometry"]["coordinates"][0]) for f in grid["features"]]
    cell_boxes = [bbox(r) for _, r in cells]
    out: dict[str, dict[str, str]] = {}
    for scen in SCENARIOS:
        masks = [0] * len(cells)
        for idx, sp in enumerate(species):
            path = WEB / "layers" / sp["slug"] / "cultivation.geojson"
            if not path.exists():
                continue
            fc = json.loads(path.read_text(encoding="utf-8"))
            polys = [p for f in fc["features"] if f["properties"].get("scenario") == scen for p in polygons(f["geometry"])]
            pboxes = [bbox(p[0]) for p in polys]
            for ci, (_, ring) in enumerate(cells):
                if any(overlaps(ring, cell_boxes[ci], p, pb) for p, pb in zip(polys, pboxes)):
                    masks[ci] |= 1 << idx
        for ci, (cid, _) in enumerate(cells):
            if masks[ci]:
                out.setdefault(cid, {})[scen] = base36(masks[ci])
    return out


def base36(n: int) -> str:
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    s = ""
    while n:
        n, r = divmod(n, 36)
        s = digits[r] + s
    return s or "0"


# ---------------------------------------------------------------- lineage
def authorities_in(text: str) -> list[tuple[int, str]]:
    found = []
    for pat, year, label in AUTHORITIES:
        m = re.search(pat, text)
        if m:
            found.append((m.start(), year, label))
    found.sort()
    return [(y, l) for _, y, l in found]


def lineage() -> list[dict]:
    species = {r["slug"]: r for r in csv.DictReader((CURATED / "species.csv").open(encoding="utf-8"))}
    rows = list(csv.DictReader((CURATED / "identifications.csv").open(encoding="utf-8")))
    out = []
    for slug, sp in species.items():
        claims = []
        for r in (x for x in rows if x["slug"] == slug):
            for part in [p.strip() for p in r["source"].split(" | ") if p.strip()]:
                auth = authorities_in(part)
                if not auth:
                    continue
                year, label = auth[0]
                if r["role"] == "modelled":
                    # Sources behind our own identification: cited, not a stance we parse from prose.
                    stance, witness = "cited", None
                else:
                    stance = next((s for rx, s in STANCE if rx.search(part[:160])), "proposed")
                    # "X, cited by Sprengel": X proposed it, the later authority is our witness.
                    witness = auth[1][1] if len(auth) > 1 and auth[1][1] != label else None
                claims.append({
                    "taxon": r["candidate_name"], "role": r["role"], "year": year, "authority": label,
                    "witness": witness, "stance": stance,
                    "source": part[:400],
                })
        # De-duplicate identical (authority, taxon) claims; keep the first (longest-context) one.
        seen, uniq = set(), []
        for c in sorted(claims, key=lambda c: (c["year"], c["taxon"])):
            k = (c["authority"], c["taxon"].split(" (")[0])
            if k not in seen:
                seen.add(k); uniq.append(c)
        out.append({
            "slug": slug, "greek_name": sp["greek_name"], "greek_translit": sp["greek_translit"],
            "book": int(sp["dmm_book"]), "chapter": int(sp["dmm_chapter"]) if sp["dmm_chapter"] else None,
            "accepted_name": sp["accepted_name"], "common_name_en": sp["common_name_en"],
            "confidence": sp["identification_confidence"], "ema": (sp.get("ema_monograph") or "").lower() == "yes",
            "n_candidates": len({r["candidate_name"].split(" (")[0] for r in rows if r["slug"] == slug}),
            "claims": uniq,
        })
    return out


def main() -> int:
    cells_risk = load("layers/greece_risk_cells.json")
    grower = grower_cells()
    # Validation: our per-cell species count must match stage 07's cult_<scenario> count.
    bad = 0
    for cid, props in cells_risk.items():
        for scen in SCENARIOS:
            expect = int(props.get(f"cult_{scen}", 0) or 0)
            got = bin(int(grower.get(cid, {}).get(scen, "0"), 36)).count("1")
            bad += expect != got
    total = sum(1 for c in cells_risk.values() for s in SCENARIOS if c.get(f"cult_{s}"))
    print(f"grower_cells: {len(grower)} cells with candidates; {bad} cell-scenario mismatches vs stage 07 (of {total} non-empty)")
    (WEB / "layers" / "grower_cells.json").write_text(json.dumps(grower, separators=(",", ":")), encoding="utf-8")

    lin = lineage()
    (WEB / "lineage.json").write_text(json.dumps(lin, ensure_ascii=False, indent=1), encoding="utf-8")
    n_claims = sum(len(x["claims"]) for x in lin)
    years = [c["year"] for x in lin for c in x["claims"]]
    print(f"lineage: {len(lin)} plants, {n_claims} dated claims, {min(years)}-{max(years)}")
    return 1 if bad > total * 0.05 else 0


if __name__ == "__main__":
    sys.exit(main())
