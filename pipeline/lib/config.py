"""Single source of truth for paths, seeds and modelling choices.

Every stage imports from here so a reviewer can audit all decisions in one file.
"""
from __future__ import annotations

import os
import random
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
RAW = DATA / "raw"
CURATED = DATA / "curated"
PROCESSED = DATA / "processed"
OUTPUTS = ROOT / "outputs"
METRICS = OUTPUTS / "metrics"
RASTERS = OUTPUTS / "rasters"
SITE_DATA = ROOT / "site" / "public" / "data"
SCHEMA_DIR = ROOT / "site" / "schema"
MANIFEST = DATA / "manifest.yml"

SEED = 20261102

# --- Study area -----------------------------------------------------------
# Greece plus a buffer so range-edge species get records from neighbours.
GREECE_ISO2 = "GR"
STUDY_BBOX = (19.0, 34.5, 30.0, 42.0)  # lon_min, lat_min, lon_max, lat_max
OCCURRENCE_BUFFER_BBOX = (18.5, 34.0, 30.5, 42.5)
EQUAL_AREA_CRS = "EPSG:3035"   # ETRS89-LAEA, metres
GREEK_GRID_CRS = "EPSG:2100"   # GGRS87 / Greek Grid, used for buffers

# --- Occurrence cleaning (stage 02) ---------------------------------------
MIN_YEAR = 1970
MAX_COORD_UNCERTAINTY_M = 5_000
THIN_CELL_KM = 1.0            # one record per ~1 km cell
PUBLIC_CELL_KM = 10.0         # published occurrences: ~10 km cells, never points
MIN_RECORDS_RELIABLE = 30     # fewer -> "low-confidence model"

# --- Environment (stage 03) -----------------------------------------------
CLIMATE_SOURCE = "worldclim"  # "worldclim" (PRD fallback, default) or "chelsa"
WORLDCLIM_RES = "2.5m"        # 2.5 arc-minutes (~4.6 km); "30s" for ~1 km if disk allows
FUTURE_PERIOD = "2041-2060"
BASELINE_PERIOD = "1970-2000"  # WorldClim 2.1 baseline
SCENARIOS = {
    "ssp245": {"label": "2050 moderate", "long": "SSP2-4.5"},
    "ssp585": {"label": "2050 high", "long": "SSP5-8.5"},
}
# Three CMIP6 GCMs spanning climate sensitivity (low / mid / high).
GCMS = ["MPI-ESM1-2-HR", "MRI-ESM2-0", "IPSL-CM6A-LR"]
MAX_ABS_CORRELATION = 0.7

# --- Models (stage 04) ----------------------------------------------------
CV_FOLDS = 5
CV_BLOCK_KM = 25.0
N_BACKGROUND = 10_000
AUC_ADEQUATE = 0.75

# --- Risk (stage 05) ------------------------------------------------------
RISK_WEIGHTS = {"range_loss": 0.40, "endemism": 0.20, "status": 0.20, "harvest": 0.20}
HARVEST_BUFFER_M = 2_000
SENSITIVITY_DRAWS = 1_000
SENSITIVITY_PERTURB = 0.5     # each weight varied +/-50% in the one-at-a-time analysis
TOP_N = 10
# IUCN category -> 0..1. DD/NE score at the midpoint and are flagged on the site.
STATUS_SCORE = {"LC": 0.0, "NT": 0.25, "VU": 0.5, "EN": 0.75, "CR": 1.0, "DD": 0.5, "NE": 0.5}

# --- Cultivation (stage 06) -----------------------------------------------
# CORINE 2018 codes: 2xx agricultural, 324 transitional woodland-shrub
CORINE_CULTIVABLE = {211, 212, 213, 221, 222, 223, 231, 241, 242, 243, 244, 324}
MODEL_AGREEMENT = 0.5         # suitable under more than half of GCMs
WILD_POPULATION_BUFFER_KM = 5.0


def seed_everything(seed: int = SEED) -> np.random.Generator:
    random.seed(seed)
    np.random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)
    return np.random.default_rng(seed)


def only_species() -> set[str] | None:
    """ONLY_SPECIES=slug1,slug2 limits stages 04-06 to those species (smoke tests)."""
    v = os.environ.get("ONLY_SPECIES", "").strip()
    return {x.strip() for x in v.split(",") if x.strip()} or None


def force() -> bool:
    return os.environ.get("FORCE", "") not in ("", "0")


def ensure_dirs() -> None:
    for p in (RAW, PROCESSED, METRICS, RASTERS, SITE_DATA):
        p.mkdir(parents=True, exist_ok=True)
