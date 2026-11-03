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
    todo = df.loc[df["identification_source"].fillna("").str.contains(r"\[TODO", regex=True), "slug"].tolist()
    if todo:
        print(f"WARNING: {len(todo)} species still lack an identification citation: {todo}")
    if not 25 <= len(df) <= 40:
        print(f"WARNING: PRD targets 25-40 species; list has {len(df)}")
    return problems


def resolve(df: pd.DataFrame) -> pd.DataFrame:
    from pygbif import species as gbif_species

    keys, statuses, matched = [], [], []
    for name in df["accepted_name"]:
        r = gbif_species.name_backbone(name=name, rank="species", kingdom="Plantae", strict=False)
        keys.append(r.get("usageKey"))
        statuses.append(r.get("status"))
        matched.append(r.get("scientificName"))
    out = df.copy()
    out["gbif_taxon_key"] = keys
    out["gbif_status"] = statuses
    out["gbif_matched_name"] = matched
    unresolved = out.loc[out["gbif_taxon_key"].isna(), "accepted_name"].tolist()
    if unresolved:
        raise SystemExit(f"GBIF backbone could not resolve: {unresolved}")
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
