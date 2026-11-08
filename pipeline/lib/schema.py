"""Validate the website export against the JSON Schemas in site/schema/."""
from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator

from . import config

SCHEMAS = {
    "species": "species.schema.json",
    "species_list": "species-list.schema.json",
    "meta": "meta.schema.json",
    "feature_collection": "feature-collection.schema.json",
    "identification": "identification.schema.json",
}


def load_schema(name: str) -> dict:
    return json.loads((config.SCHEMA_DIR / SCHEMAS[name]).read_text(encoding="utf-8"))


def _validator(name: str) -> Draft202012Validator:
    from referencing import Registry, Resource

    resources = []
    for fname in SCHEMAS.values():
        s = json.loads((config.SCHEMA_DIR / fname).read_text(encoding="utf-8"))
        resources.append((s["$id"], Resource.from_contents(s)))
    return Draft202012Validator(load_schema(name), registry=Registry().with_resources(resources))


def errors(name: str, instance) -> list[str]:
    return [f"{'/'.join(map(str, e.path)) or '<root>'}: {e.message}" for e in _validator(name).iter_errors(instance)]


def validate_export(data_dir: Path = config.SITE_DATA) -> list[str]:
    """Validate every file the site reads. Returns a list of problems (empty = valid)."""
    problems: list[str] = []

    def check(name: str, path: Path) -> object | None:
        if not path.exists():
            problems.append(f"missing {path.relative_to(data_dir)}")
            return None
        obj = json.loads(path.read_text(encoding="utf-8"))
        problems.extend(f"{path.relative_to(data_dir)}: {m}" for m in errors(name, obj))
        return obj

    check("meta", data_dir / "meta.json")
    lst = check("species_list", data_dir / "species.json") or []
    for item in lst:
        slug = item.get("slug")
        check("species", data_dir / "species" / f"{slug}.json")
        for layer in ("occurrences", "range_now", "range_2050_ssp245", "range_2050_ssp585", "cultivation"):
            p = data_dir / "layers" / slug / f"{layer}.geojson"
            check("feature_collection", p)
            if p.exists() and p.stat().st_size > 300_000:
                problems.append(f"{p.relative_to(data_dir)}: {p.stat().st_size} bytes exceeds 300 KB")
    grid = data_dir / "layers" / "greece_risk_grid.geojson"
    check("feature_collection", grid)
    cells = data_dir / "layers" / "greece_risk_cells.json"
    if not cells.exists():
        problems.append("layers/greece_risk_cells.json missing")
    for f in (grid, cells):
        if f.exists() and f.stat().st_size > 300_000:
            problems.append(f"{f.relative_to(data_dir)}: {f.stat().st_size} bytes exceeds 300 KB")
    if (data_dir / "identification.json").exists():
        check("identification", data_dir / "identification.json")
    return problems
