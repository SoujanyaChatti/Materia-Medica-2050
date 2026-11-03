"""Stage 03 — environmental layers.

Downloads WorldClim 2.1 bioclim (baseline + CMIP6 2041-2060 for each GCM x SSP) and Copernicus
DEM GLO-90 tiles, crops everything to the study box on the climate grid, adds elevation and
slope, and keeps a low-collinearity subset of bioclim variables (|r| < 0.7).
Outputs: data/processed/env/current.tif, data/processed/env/<gcm>_<ssp>.tif, env/meta.json
"""
from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402

from pipeline.lib import config, io  # noqa: E402

ENV = config.PROCESSED / "env"
META = ENV / "meta.json"
WC_BASE = "https://geodata.ucdavis.edu/climate/worldclim/2_1/base/wc2.1_{res}_bio.zip"
WC_FUT = "https://geodata.ucdavis.edu/cmip6/{res}/{gcm}/{ssp}/wc2.1_{res}_bioc_{gcm}_{ssp}_{period}.tif"
DEM_TILE = ("https://copernicus-dem-90m.s3.amazonaws.com/Copernicus_DSM_COG_30_N{lat:02d}_00_E{lon:03d}_00_DEM/"
            "Copernicus_DSM_COG_30_N{lat:02d}_00_E{lon:03d}_00_DEM.tif")
# Preference order when two variables are collinear: keep the more interpretable one.
PRIORITY = [1, 12, 5, 6, 15, 4, 7, 2, 3, 8, 9, 10, 11, 13, 14, 16, 17, 18, 19]


def crop(src_path: Path, bands=None):
    import rasterio
    from rasterio.windows import from_bounds

    with rasterio.open(src_path) as src:
        win = from_bounds(*config.STUDY_BBOX, transform=src.transform).round_offsets().round_lengths()
        arr = src.read(bands, window=win, masked=True).astype("float32")
        transform = src.window_transform(win)
        crs = src.crs
    return np.ma.filled(arr, np.nan), transform, crs


def baseline() -> tuple[np.ndarray, object, object]:
    res = config.WORLDCLIM_RES
    z = io.download(WC_BASE.format(res=res), config.RAW / "worldclim" / f"wc2.1_{res}_bio.zip")
    out_dir = config.RAW / "worldclim" / f"base_{res}"
    if not out_dir.exists():
        with zipfile.ZipFile(z) as f:
            f.extractall(out_dir)
    layers = []
    transform = crs = None
    for i in range(1, 20):
        a, transform, crs = crop(out_dir / f"wc2.1_{res}_bio_{i}.tif", 1)
        layers.append(a)
    return np.stack(layers), transform, crs


def select_variables(stack: np.ndarray) -> list[int]:
    """Greedy: walk PRIORITY, keep a variable if |r| < threshold with all kept ones."""
    flat = stack.reshape(stack.shape[0], -1)
    ok = np.all(np.isfinite(flat), axis=0)
    corr = np.corrcoef(flat[:, ok])
    keep: list[int] = []
    for v in PRIORITY:
        if all(abs(corr[v - 1, k - 1]) < config.MAX_ABS_CORRELATION for k in keep):
            keep.append(v)
    return keep


def terrain(transform, shape, crs) -> tuple[np.ndarray, np.ndarray]:
    """Mean elevation and mean slope (degrees) per climate cell from Copernicus GLO-90."""
    import rasterio
    from rasterio.merge import merge
    from rasterio.warp import Resampling, reproject

    x0, y0, x1, y1 = config.STUDY_BBOX
    tiles = []
    for lat in range(int(np.floor(y0)), int(np.ceil(y1))):
        for lon in range(int(np.floor(x0)), int(np.ceil(x1))):
            dest = config.RAW / "dem" / f"N{lat:02d}_E{lon:03d}.tif"
            try:
                io.download(DEM_TILE.format(lat=lat, lon=lon), dest)
                tiles.append(dest)
            except Exception:  # sea-only tiles do not exist
                continue
    srcs = [rasterio.open(t) for t in tiles]
    mosaic, mtrans = merge(srcs, bounds=config.STUDY_BBOX, nodata=np.nan)
    for s in srcs:
        s.close()
    dem = mosaic[0].astype("float32")
    # slope on the 90 m grid (metres per degree varies with latitude)
    lat_c = np.deg2rad((y0 + y1) / 2)
    dx = abs(mtrans.a) * 111_320 * np.cos(lat_c)
    dy = abs(mtrans.e) * 110_574
    gy, gx = np.gradient(dem, dy, dx)
    slope = np.degrees(np.arctan(np.hypot(gx, gy))).astype("float32")
    out = []
    for a in (dem, slope):
        dst = np.full(shape, np.nan, dtype="float32")
        reproject(a, dst, src_transform=mtrans, src_crs="EPSG:4326", dst_transform=transform, dst_crs=crs,
                  resampling=Resampling.average, src_nodata=np.nan, dst_nodata=np.nan)
        out.append(dst)
    return out[0], out[1]


def write_stack(path: Path, arr: np.ndarray, transform, crs, names: list[str]) -> None:
    import rasterio

    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(path, "w", driver="GTiff", height=arr.shape[1], width=arr.shape[2], count=arr.shape[0],
                       dtype="float32", crs=crs, transform=transform, nodata=np.nan, compress="deflate") as dst:
        dst.write(arr.astype("float32"))
        for i, n in enumerate(names, start=1):
            dst.set_band_description(i, n)


def main() -> None:
    config.ensure_dirs()
    if io.done(META):
        print(f"cached: {META}")
        return
    base, transform, crs = baseline()
    keep = select_variables(base)
    names = [f"bio{v}" for v in keep] + ["elevation", "slope"]
    print(f"selected bioclim variables (|r| < {config.MAX_ABS_CORRELATION}): {names[:-2]}")
    elev, slope = terrain(transform, base.shape[1:], crs)
    land = np.isfinite(base[0])
    elev[~land] = np.nan
    slope[~land] = np.nan
    write_stack(ENV / "current.tif", np.concatenate([base[[v - 1 for v in keep]], elev[None], slope[None]]),
                transform, crs, names)

    futures = []
    for ssp in config.SCENARIOS:
        for gcm in config.GCMS:
            url = WC_FUT.format(res=config.WORLDCLIM_RES, gcm=gcm, ssp=ssp, period=config.FUTURE_PERIOD)
            src = io.download(url, config.RAW / "worldclim" / Path(url).name)
            fut, _, _ = crop(src, [v for v in keep])
            write_stack(ENV / f"{gcm}_{ssp}.tif", np.concatenate([fut, elev[None], slope[None]]), transform, crs, names)
            futures.append({"gcm": gcm, "ssp": ssp, "file": f"{gcm}_{ssp}.tif"})
            print(f"wrote {gcm} {ssp}")

    meta = {"variables": names, "source": config.CLIMATE_SOURCE, "resolution": config.WORLDCLIM_RES,
            "baseline_period": config.BASELINE_PERIOD, "future_period": config.FUTURE_PERIOD,
            "futures": futures}
    io.write_json(META, meta)
    io.update_manifest("environment", {"worldclim": "2.1", "resolution": config.WORLDCLIM_RES,
                                       "gcms": config.GCMS, "dem": "Copernicus GLO-90", "variables": names})
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
