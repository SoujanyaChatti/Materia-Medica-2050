"""Occurrence cleaning, thinning and public aggregation (pure pandas/numpy, unit-tested)."""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from . import config

# Approximate coordinates of country centroids we drop (GBIF often geocodes to these).
COUNTRY_CENTROIDS = [
    (21.82, 39.07),  # Greece (common centroid)
    (22.0, 39.0),
    (35.24, 38.96),  # Turkey
    (20.17, 41.15),  # Albania
    (25.49, 42.73),  # Bulgaria
    (21.75, 41.6),   # North Macedonia
]
CENTROID_TOLERANCE_DEG = 0.01
INSTITUTION_KEYWORDS = ("botanic", "botanical garden", "herbarium", "museum", "university", "institute", "arboretum")

REQUIRED_COLUMNS = ["species_slug", "decimalLongitude", "decimalLatitude", "year", "coordinateUncertaintyInMeters", "basisOfRecord"]


def clean_occurrences(df: pd.DataFrame, min_year: int = config.MIN_YEAR,
                      max_uncertainty_m: float = config.MAX_COORD_UNCERTAINTY_M) -> tuple[pd.DataFrame, dict]:
    """Apply the PRD cleaning filters in order. Returns (clean_df, counts_dropped_per_filter)."""
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"missing columns: {missing}")
    log: dict[str, int] = {"raw": int(len(df))}
    out = df.copy()

    def step(name: str, mask: pd.Series) -> None:
        nonlocal out
        log[name] = int((~mask).sum())
        out = out[mask]

    lon, lat = "decimalLongitude", "decimalLatitude"
    step("missing_coords", out[lon].notna() & out[lat].notna())
    step("zero_coords", (out[lon] != 0) & (out[lat] != 0))
    step("invalid_coords", out[lon].between(-180, 180) & out[lat].between(-90, 90))

    near_centroid = pd.Series(False, index=out.index)
    for cx, cy in COUNTRY_CENTROIDS:
        near_centroid |= ((out[lon] - cx).abs() < CENTROID_TOLERANCE_DEG) & ((out[lat] - cy).abs() < CENTROID_TOLERANCE_DEG)
    step("country_centroid", ~near_centroid)

    inst_text = pd.Series("", index=out.index)
    for col in ("locality", "institutionCode", "habitat"):
        if col in out.columns:
            inst_text = inst_text + " " + out[col].fillna("").astype(str).str.lower()
    is_inst = inst_text.str.contains("|".join(INSTITUTION_KEYWORDS), regex=True)
    is_living = out["basisOfRecord"].fillna("").str.upper().isin(["LIVING_SPECIMEN", "FOSSIL_SPECIMEN"])
    step("institution", ~(is_inst | is_living))

    key_cols = ["species_slug", lon, lat]
    if "eventDate" in out.columns:
        key_cols.append("eventDate")
    dup = out.duplicated(subset=key_cols)
    step("duplicate", ~dup)

    step("before_min_year", out["year"].fillna(0) >= min_year)
    unc = out["coordinateUncertaintyInMeters"]
    step("coord_uncertainty", unc.isna() | (unc <= max_uncertainty_m))

    log["clean"] = int(len(out))
    return out.reset_index(drop=True), log


def _cell_index(lon: np.ndarray, lat: np.ndarray, cell_km: float, ref_lat: float = 38.5) -> tuple[np.ndarray, np.ndarray]:
    """Index of an approximately equal-area cell. Exact LAEA gridding happens in stage 07 with pyproj."""
    dlat = cell_km / 110.574
    dlon = cell_km / (111.320 * math.cos(math.radians(ref_lat)))
    return np.floor(lon / dlon).astype(np.int64), np.floor(lat / dlat).astype(np.int64)


def thin(df: pd.DataFrame, cell_km: float = config.THIN_CELL_KM, seed: int = config.SEED) -> pd.DataFrame:
    """Keep one random record per species per cell to reduce sampling bias. Deterministic for a seed."""
    if df.empty:
        return df.copy()
    ix, iy = _cell_index(df["decimalLongitude"].to_numpy(), df["decimalLatitude"].to_numpy(), cell_km)
    tmp = df.assign(_ix=ix, _iy=iy)
    tmp = tmp.sample(frac=1.0, random_state=seed)
    tmp = tmp.drop_duplicates(subset=["species_slug", "_ix", "_iy"], keep="first")
    return tmp.drop(columns=["_ix", "_iy"]).sort_index().reset_index(drop=True)


def grid_index(x, y, cell_m: float) -> tuple[np.ndarray, np.ndarray]:
    """Cell index on a square grid in projected metres (EPSG:3035 in the pipeline)."""
    return (np.floor(np.asarray(x, dtype=float) / cell_m).astype(np.int64),
            np.floor(np.asarray(y, dtype=float) / cell_m).astype(np.int64))


def aggregate_public(df: pd.DataFrame, x_col: str = "x", y_col: str = "y",
                     cell_km: float = config.PUBLIC_CELL_KM) -> pd.DataFrame:
    """Aggregate projected points (metres) to ~10 km cells for publication. Returns one row per
    species x cell with a record count and the cell's south-west corner. Exact points never leave."""
    cell_m = cell_km * 1000.0
    ix, iy = grid_index(df[x_col], df[y_col], cell_m)
    g = (pd.DataFrame({"species_slug": df["species_slug"].to_numpy(), "ix": ix, "iy": iy})
         .groupby(["species_slug", "ix", "iy"]).size().rename("n_records").reset_index())
    g["x0"] = g["ix"] * cell_m
    g["y0"] = g["iy"] * cell_m
    return g
