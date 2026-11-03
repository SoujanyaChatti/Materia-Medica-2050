"""Stage 02 — occurrences.

Requests one DOI'd GBIF download for all species (Greece plus a buffer box), cleans it with the
PRD filters, and thins to one record per ~1 km cell per species.
Outputs: data/processed/occurrences_clean.parquet, outputs/metrics/<slug>.json (record counts)
Needs GBIF_USER / GBIF_PWD / GBIF_EMAIL in .env.
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
COLUMNS = ["taxonKey", "speciesKey", "decimalLongitude", "decimalLatitude", "coordinateUncertaintyInMeters",
           "year", "eventDate", "basisOfRecord", "institutionCode", "locality", "habitat", "countryCode",
           "occurrenceStatus"]


def bbox_wkt(b) -> str:
    x0, y0, x1, y1 = b
    return f"POLYGON(({x0} {y0},{x1} {y0},{x1} {y1},{x0} {y1},{x0} {y0}))"


def request_download(taxon_keys: list[int]) -> str:
    from pygbif import occurrences as occ

    queries = [
        f"taxonKey in {taxon_keys}",
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


def main() -> None:
    load_dotenv(config.ROOT / ".env")
    config.ensure_dirs()
    rng_seed = config.SEED
    if io.done(OUT):
        print(f"cached: {OUT}")
        return
    species = pd.read_parquet(config.PROCESSED / "species.parquet")
    key_to_slug = {int(k): s for k, s in zip(species["gbif_taxon_key"], species["slug"])}

    manifest = io.read_manifest()
    dl_key = manifest.get("gbif", {}).get("download_key")
    if not dl_key or config.force():
        dl_key = request_download(sorted(key_to_slug))
        io.update_manifest("gbif", {"download_key": dl_key})
    zip_path = config.RAW / f"{dl_key}.zip"
    doi = manifest.get("gbif", {}).get("doi", "")
    if not zip_path.exists():
        zip_path, doi = wait_and_fetch(dl_key)
        io.update_manifest("gbif", {"doi": doi, "download_key": dl_key})

    with zipfile.ZipFile(zip_path) as z:
        csv_name = next(n for n in z.namelist() if n.endswith(".csv"))
        with z.open(csv_name) as f:
            raw = pd.read_csv(f, sep="\t", usecols=lambda c: c in COLUMNS, low_memory=False, on_bad_lines="skip")

    # Map records to curated species (accepted taxonKey or its speciesKey).
    raw["species_slug"] = raw["speciesKey"].map(key_to_slug).fillna(raw["taxonKey"].map(key_to_slug))
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
