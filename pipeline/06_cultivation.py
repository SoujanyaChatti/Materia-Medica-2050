"""Stage 06 — cultivation suitability in 2050.

A cell is a candidate cultivation zone for a species and scenario when it is:
  * suitable in 2050 under more than half of the climate models,
  * agricultural or transitional land in CORINE 2018 (config.CORINE_CULTIVABLE),
  * mostly outside Natura 2000,
  * at least 5 km from current wild occurrences (avoid genetic contamination).

Inputs:
  data/raw/corine/*.tif        CORINE Land Cover 2018 raster 100 m (EPSG:3035); free Copernicus login,
                               downloaded by hand (see README). Any file name; only the Greece window is read.
  data/raw/natura2000/**.gpkg  EEA Natura 2000 (end-2023) GeoPackage, public download (see README).
Outputs: outputs/rasters/<slug>/cult_<ssp>.tif, outputs/rasters/natura_frac.tif,
         outputs/cultivation.csv (area km^2, median and range across thresholds)
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from pipeline.lib import config, io  # noqa: E402

CORINE_DIR = config.RAW / "corine"
NATURA_DIR = config.RAW / "natura2000"


def _find(folder: Path, pattern: str) -> Path | None:
    hits = sorted(folder.rglob(pattern)) if folder.exists() else []
    return max(hits, key=lambda h: h.stat().st_size) if hits else None
OUT = config.OUTPUTS / "cultivation.csv"


def grid():
    import rasterio

    with rasterio.open(config.PROCESSED / "env" / "current.tif") as src:
        return src.profile, src.transform, (src.height, src.width), src.crs, src.read(1)


def corine_cultivable_fraction(path: Path, transform, shape, crs) -> np.ndarray:
    """Share of each climate cell that is CORINE agricultural/transitional land (config.CORINE_CULTIVABLE)."""
    import rasterio
    from rasterio.warp import Resampling, reproject, transform_bounds
    from rasterio.windows import from_bounds

    # The 100 m raster stores the class index 1..44 of the standard legend (48 = no data);
    # some distributions store the 3-digit CLC code directly. Handle both.
    codes = np.array([0, 111, 112, 121, 122, 123, 124, 131, 132, 133, 141, 142, 211, 212, 213, 221, 222, 223, 231,
                      241, 242, 243, 244, 311, 312, 313, 321, 322, 323, 324, 331, 332, 333, 334, 335, 411, 412,
                      421, 422, 423, 511, 512, 521, 522, 523], dtype=np.int32)
    with rasterio.open(path) as src:
        b = transform_bounds("EPSG:4326", src.crs, *config.STUDY_BBOX)
        win = from_bounds(*b, transform=src.transform).round_offsets().round_lengths()
        win = win.intersection(rasterio.windows.Window(0, 0, src.width, src.height))
        clc = src.read(1, window=win).astype(np.int32)
        wtrans = src.window_transform(win)
        is_code = clc.max() > 100
        clc_code = clc if is_code else np.where(clc < len(codes), codes[np.clip(clc, 0, len(codes) - 1)], 0)
        valid = clc_code > 0
        ok = np.where(valid, np.isin(clc_code, list(config.CORINE_CULTIVABLE)), np.nan).astype("float32")
        dst = np.full(shape, np.nan, dtype="float32")
        reproject(ok, dst, src_transform=wtrans, src_crs=src.crs, dst_transform=transform, dst_crs=crs,
                  resampling=Resampling.average, src_nodata=np.nan, dst_nodata=np.nan)
    return np.nan_to_num(dst, nan=0.0)


def natura_fraction(path: Path, transform, shape, crs) -> np.ndarray:
    import geopandas as gpd
    from rasterio.features import rasterize

    # Supersample 10x then average for a fractional cover.
    import pyogrio

    layers = [l for l, g in pyogrio.list_layers(path) if g and "POLYGON" in str(g).upper()]
    layer = layers[0] if layers else None
    n = gpd.read_file(path, layer=layer)
    if "MS" in n.columns:  # member-state column in the EEA dataset
        n = n[n["MS"] == "GR"]
    n = n.to_crs(crs)
    f = 10
    fine = rasterize(((g, 1) for g in n.geometry), out_shape=(shape[0] * f, shape[1] * f),
                     transform=transform * transform.scale(1 / f, 1 / f), fill=0, dtype="uint8")
    return fine.reshape(shape[0], f, shape[1], f).mean(axis=(1, 3)).astype("float32")


def cell_area_km2(transform, shape) -> np.ndarray:
    rows = np.arange(shape[0])
    lat = transform.f + (rows + 0.5) * transform.e
    dx = abs(transform.a) * 111.320 * np.cos(np.radians(lat))
    dy = abs(transform.e) * 110.574
    return np.repeat((dx * dy)[:, None], shape[1], axis=1)


def wild_buffer_mask(occ: pd.DataFrame, transform, shape) -> np.ndarray:
    """True for cells within WILD_POPULATION_BUFFER_KM of a current wild occurrence."""
    m = np.zeros(shape, dtype=bool)
    if occ.empty:
        return m
    lat_c = np.radians(occ["decimalLatitude"].mean())
    rx = int(np.ceil(config.WILD_POPULATION_BUFFER_KM / (abs(transform.a) * 111.32 * np.cos(lat_c))))
    ry = int(np.ceil(config.WILD_POPULATION_BUFFER_KM / (abs(transform.e) * 110.574)))
    cols = ((occ["decimalLongitude"] - transform.c) / transform.a).astype(int).to_numpy()
    rows = ((occ["decimalLatitude"] - transform.f) / transform.e).astype(int).to_numpy()
    for r, c in zip(rows, cols):
        m[max(r - ry, 0):r + ry + 1, max(c - rx, 0):c + rx + 1] = True
    return m


def main() -> None:
    import rasterio

    config.ensure_dirs()
    if io.done(OUT):
        print(f"cached: {OUT}")
        return
    corine, natura_path = _find(CORINE_DIR, "*.tif"), _find(NATURA_DIR, "*.gpkg")
    if corine is None or natura_path is None:
        raise SystemExit("missing CORINE raster in data/raw/corine/ or Natura 2000 GeoPackage in "
                         "data/raw/natura2000/ — see README 'Manual downloads'")
    profile, transform, shape, crs, first = grid()
    import importlib.util
    spec = importlib.util.spec_from_file_location("s04", Path(__file__).with_name("04_models.py"))
    s04 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(s04)
    land = np.isfinite(first) & s04.greece_mask(profile)   # candidate zones are inside Greece only
    cult_land = corine_cultivable_fraction(corine, transform, shape, crs) >= 0.5
    natura = natura_fraction(natura_path, transform, shape, crs)
    print(f"land cells {int(land.sum())}, CORINE cultivable cells {int((cult_land & land).sum())}, "
          f"cells mostly in Natura 2000 {int(((natura >= 0.5) & land).sum())}")
    p = profile.copy()
    p.update(count=1, dtype="float32", nodata=np.nan)
    with rasterio.open(config.RASTERS / "natura_frac.tif", "w", **p) as dst:
        dst.write(natura, 1)
    area = cell_area_km2(transform, shape)
    occ = pd.read_parquet(config.PROCESSED / "occurrences_clean.parquet")

    rows = []
    slugs = set(occ["species_slug"].unique()) & (config.only_species() or set(occ["species_slug"].unique()))
    for slug_dir in sorted(d for d in config.RASTERS.iterdir() if d.is_dir() and d.name in slugs):
        slug = slug_dir.name
        wild = wild_buffer_mask(occ[occ["species_slug"] == slug], transform, shape)
        row = {"slug": slug}
        for ssp in config.SCENARIOS:
            bins = []
            for gcm in config.GCMS:
                f = slug_dir / f"{gcm}_{ssp}_bin.tif"
                if f.exists():
                    with rasterio.open(f) as src:
                        bins.append(src.read(1) == 1)
            if not bins:
                continue
            agree = np.mean(bins, axis=0)
            base = land & cult_land & (natura < 0.5) & ~wild
            cult = base & (agree > config.MODEL_AGREEMENT)
            # Interval: any-model (optimistic) and all-model (strict) agreement.
            lo = float(area[base & (agree >= 1.0)].sum())
            hi = float(area[base & (agree > 0)].sum())
            q = profile.copy()
            q.update(count=1, dtype="uint8", nodata=255)
            with rasterio.open(slug_dir / f"cult_{ssp}.tif", "w", **q) as dst:
                dst.write(np.where(land, cult.astype("uint8"), 255), 1)
            row.update({f"area_{ssp}": float(area[cult].sum()), f"area_{ssp}_lo": lo, f"area_{ssp}_hi": hi})
        rows.append(row)
        print(f"{slug}: cultivation area ssp245 ≈ {row.get('area_ssp245', 0):.0f} km²")
    pd.DataFrame(rows).to_csv(OUT, index=False)


if __name__ == "__main__":
    main()
