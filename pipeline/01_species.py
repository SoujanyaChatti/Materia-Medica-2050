"""Stage 01 — species list.

Reads the hand-curated data/curated/species.csv, checks it, and resolves each accepted name
against the GBIF Backbone to get a taxonKey for stage 02.
Output: data/processed/species.parquet
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd  # noqa: E402

from pipeline.lib import config, io  # noqa: E402

OUT = config.PROCESSED / "species.parquet"
CONFIDENCE = {"certain", "probable", "disputed"}


def check(df: pd.DataFrame) -> list[str]:
    problems = []
    if df["slug"].duplicated().any():
        problems.append(f"duplicate slugs: {df.loc[df['slug'].duplicated(), 'slug'].tolist()}")
    bad = df.loc[~df["identification_confidence"].isin(CONFIDENCE), "slug"].tolist()
    if bad:
        problems.append(f"identification_confidence must be one of {sorted(CONFIDENCE)}: {bad}")
    todo = df.loc[df["identification_source"].fillna("").str.strip().eq(""), "slug"].tolist()
    if todo:
        print(f"WARNING: {len(todo)} species still lack an identification citation: {todo}")
    if not 25 <= len(df) <= 40:
        print(f"WARNING: PRD targets 25-40 species; list has {len(df)}")
    return problems


BACKBONE = "d7dddbf4-2cf0-4f39-9b2a-bb099caae36c"   # GBIF Backbone Taxonomy
COL_XR = "7ddf754f-d193-4cc9-b351-99906754a03b"     # Catalogue of Life eXtended Release (GBIF default since 2026)


def _match(name: str, checklist: str) -> dict:
    from pygbif import species as gbif_species

    r = gbif_species.name_backbone(scientificName=name, taxonRank="species", kingdom="Plantae", strict=False,
                                   checklistKey=checklist)
    u = r.get("usage") or {}
    # A synonym match points at its accepted name; occurrence downloads index records by the accepted key.
    acc = r.get("acceptedUsage") or u
    return {"key": acc.get("key"), "name": acc.get("canonicalName") or acc.get("name"), "status": u.get("status"),
            "match": (r.get("diagnostics") or {}).get("matchType")}


def model_names(row) -> list[str]:
    """Species whose records are pooled for this plant (model_taxa), else the accepted binomial."""
    taxa = [t.strip() for t in str(row.get("model_taxa", "") or "").split(";") if t.strip()]
    return taxa or [" ".join(row["accepted_name"].split()[:2])]


def resolve(df: pd.DataFrame) -> pd.DataFrame:
    """Resolve every modelled name in the GBIF Backbone (numeric keys) and in the Catalogue of Life
    XR (alphanumeric keys, used by occurrence downloads since GBIF's 2026 taxonomy switch)."""
    out = df.copy()
    bb_keys, bb_status, bb_names, col_keys, col_names, unresolved = [], [], [], [], [], []
    for _, row in df.iterrows():
        names = model_names(row)
        bb = [_match(n, BACKBONE) for n in names]
        col = [_match(n, COL_XR) for n in names]
        for n, m1, m2 in zip(names, bb, col):
            print(f"{row['slug']}: {n} -> backbone {m1['key']} ({m1['status']}), COL {m2['key']} '{m2['name']}' [{m2['match']}]")
            if not m1["key"] and not m2["key"]:
                unresolved.append(n)
        bb_keys.append(next((m["key"] for m in bb if m["key"]), None))
        bb_status.append(bb[0]["status"])
        bb_names.append(";".join(m["name"] for m in bb if m["name"]))
        col_keys.append(";".join(str(m["key"]) for m in col if m["key"]))
        col_names.append(";".join(m["name"] for m in col if m["name"]))
    out["gbif_taxon_key"] = bb_keys
    out["gbif_status"] = bb_status
    out["gbif_matched_name"] = bb_names
    out["col_key"] = col_keys
    out["col_name"] = col_names
    out["model_names"] = [";".join(model_names(r)) for _, r in df.iterrows()]
    if unresolved:
        raise SystemExit(f"GBIF could not resolve: {unresolved}")
    return out


def main() -> None:
    config.ensure_dirs()
    if io.done(OUT):
        print(f"cached: {OUT}")
        return
    df = pd.read_csv(config.CURATED / "species.csv", dtype=str, keep_default_na=False)
    problems = check(df)
    if problems:
        raise SystemExit("species.csv problems:\n  " + "\n  ".join(problems))
    df = resolve(df)
    df.to_parquet(OUT, index=False)
    io.update_manifest("species", {"n_species": int(len(df)), "source": "data/curated/species.csv"})
    print(f"wrote {OUT} ({len(df)} species)")


if __name__ == "__main__":
    main()
