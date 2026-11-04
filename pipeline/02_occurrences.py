"""Stage 02 — occurrences.

Requests ONE DOI'd GBIF download of all vascular plants (Tracheophyta) in Greece plus a buffer box.
Downloading the whole group (not just the curated species) means:
  * the download can be submitted before the species list is final, and stays valid as it grows;
  * the same download provides the target-group background for the models (all plant records
    share the curated species' sampling bias).
Then cleans with the PRD filters and thins to one record per ~1 km cell per species.
Outputs: data/processed/occurrences_clean.parquet, data/processed/background.parquet,
         outputs/metrics/<slug>.json (record counts)
Needs GBIF_USER / GBIF_PWD / GBIF_EMAIL in .env.
`python pipeline/02_occurrences.py --submit` only submits the request and records its key.
"""
from __future__ import annotations

import json
import os
import sys
import time
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

from pipeline.lib import cleaning, config, io  # noqa: E402

OUT = config.PROCESSED / "occurrences_clean.parquet"
BG_OUT = config.PROCESSED / "background.parquet"
TRACHEOPHYTA_KEY = 7707728  # GBIF Backbone: phylum Tracheophyta (vascular plants)
COLUMNS = ["taxonKey", "speciesKey", "species", "decimalLongitude", "decimalLatitude", "coordinateUncertaintyInMeters",
           "year", "eventDate", "basisOfRecord", "institutionCode", "locality", "habitat", "countryCode",
           "occurrenceStatus"]


def bbox_wkt(b) -> str:
    x0, y0, x1, y1 = b
    return f"POLYGON(({x0} {y0},{x1} {y0},{x1} {y1},{x0} {y1},{x0} {y0}))"


def request_download() -> str:
    from pygbif import occurrences as occ

    queries = [
        f"taxonKey = {TRACHEOPHYTA_KEY}",
        "hasCoordinate = TRUE",
        "hasGeospatialIssue = FALSE",
        "occurrenceStatus = PRESENT",
        f"geometry within {bbox_wkt(config.OCCURRENCE_BUFFER_BBOX)}",
    ]
    key, _ = occ.download(queries, format="SIMPLE_CSV",
                          user=os.environ["GBIF_USER"], pwd=os.environ["GBIF_PWD"], email=os.environ["GBIF_EMAIL"])
    return key


def wait_and_fetch(key: str) -> tuple[Path, str]:
    from pygbif import occurrences as occ

    while True:
        meta = occ.download_meta(key)
        status = meta["status"]
        print(f"GBIF download {key}: {status}")
        if status == "SUCCEEDED":
            break
        if status in ("FAILED", "KILLED", "CANCELLED"):
            raise SystemExit(f"GBIF download {key} {status}")
        time.sleep(60)
    occ.download_get(key, path=str(config.RAW))
    return config.RAW / f"{key}.zip", meta.get("doi", "")


def submit() -> str:
    """Submit the download once; reuse the recorded key on later runs (RESUBMIT=1 resubmits)."""
    manifest = io.read_manifest()
    dl_key = manifest.get("gbif", {}).get("download_key")
    # FORCE=1 re-processes the existing download; only RESUBMIT=1 asks GBIF for a new one (new DOI).
    if not dl_key or os.environ.get("RESUBMIT") == "1":
        dl_key = request_download()
        io.update_manifest("gbif", {"download_key": dl_key, "predicate": f"taxonKey={TRACHEOPHYTA_KEY}; "
                                    f"bbox {config.OCCURRENCE_BUFFER_BBOX}; hasCoordinate; no geospatial issue; PRESENT"})
        print(f"submitted GBIF download {dl_key}")
    else:
        print(f"GBIF download already submitted: {dl_key}")
    return dl_key


def main() -> None:
    load_dotenv(config.ROOT / ".env")
    config.ensure_dirs()
    rng_seed = config.SEED
    if "--submit" in sys.argv:
        submit()
        return
    if io.done(OUT) and BG_OUT.exists():
        print(f"cached: {OUT}")
        return
    species = pd.read_parquet(config.PROCESSED / "species.parquet")

    manifest = io.read_manifest()
    dl_key = submit()
    zip_path = config.RAW / f"{dl_key}.zip"
    doi = manifest.get("gbif", {}).get("doi", "")
    if not zip_path.exists():
        zip_path, doi = wait_and_fetch(dl_key)
        io.update_manifest("gbif", {"doi": doi, "download_key": dl_key})

    with zipfile.ZipFile(zip_path) as z:
        csv_name = next(n for n in z.namelist() if n.endswith(".csv"))
        with z.open(csv_name) as f:
            allp = pd.read_csv(f, sep="\t", usecols=lambda c: c in COLUMNS, low_memory=False, on_bad_lines="skip",
                               quoting=3)
    print(f"GBIF download rows (all vascular plants): {len(allp)}")

    # Target-group background: every vascular-plant record, cleaned with the same filters and thinned
    # to one record per ~1 km cell (regardless of species).
    bgdf = allp.assign(species_slug="__all__")
    bg_clean, _ = cleaning.clean_occurrences(bgdf)
    bg = cleaning.thin(bg_clean, seed=rng_seed)[["decimalLongitude", "decimalLatitude"]]
    bg.to_parquet(BG_OUT, index=False)
    print(f"wrote {BG_OUT} ({len(bg)} background cells)")

    # Map records to curated species (accepted taxonKey or its speciesKey).
    raw = allp.copy()
    # Since 2026 GBIF downloads carry Catalogue of Life (COL XR) keys; stage 01 resolved each species
    # there. Match on the accepted COL species key, then fall back to the canonical name.
    col_to_slug, name_to_slug = {}, {}
    for _, sp in species.iterrows():
        for k in str(sp["col_key"]).split(";"):
            if k:
                col_to_slug[k] = sp["slug"]
        for col in ("model_names", "gbif_matched_name", "col_name"):
            for n in str(sp.get(col, "") or "").split(";"):
                if n.strip():
                    name_to_slug[" ".join(n.split()[:2])] = sp["slug"]
    raw["species_slug"] = (raw["speciesKey"].astype(str).map(col_to_slug)
                           .fillna(raw["species"].map(name_to_slug)))
    raw = raw[raw["species_slug"].notna()]

    per_species = []
    for slug, g in raw.groupby("species_slug"):
        clean, log = cleaning.clean_occurrences(g)
        thinned = cleaning.thin(clean, seed=rng_seed)
        log["thinned"] = int(len(thinned))
        log["low_confidence_model"] = bool(len(thinned) < config.MIN_RECORDS_RELIABLE)
        metrics_path = config.METRICS / f"{slug}.json"
        existing = json.loads(metrics_path.read_text()) if metrics_path.exists() else {}
        existing["records"] = log
        io.write_json(metrics_path, existing)
        per_species.append(thinned)
        print(f"{slug}: raw {log['raw']} -> clean {log['clean']} -> thinned {log['thinned']}")

    missing = set(species["slug"]) - set(raw["species_slug"])
    for slug in missing:
        print(f"WARNING: no GBIF records for {slug}; it stays in the list flagged low-confidence")
        io.write_json(config.METRICS / f"{slug}.json", {"records": {"raw": 0, "clean": 0, "thinned": 0,
                                                                    "low_confidence_model": True}})

    out = pd.concat(per_species, ignore_index=True) if per_species else pd.DataFrame(columns=COLUMNS + ["species_slug"])
    out.to_parquet(OUT, index=False)
    print(f"wrote {OUT} ({len(out)} records); GBIF DOI {doi}")


if __name__ == "__main__":
    main()
