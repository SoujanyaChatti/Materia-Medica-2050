"""Stage 03 — environmental layers.

WorldClim 2.1 bioclim at 2.5 arc-minutes: baseline (1970-2000) plus CMIP6 2041-2060 for 3 GCMs x
SSP2-4.5/SSP5-8.5, and Copernicus DEM GLO-90 elevation/slope. Nothing global is ever stored: every
layer is read straight from the provider over HTTP (GDAL /vsicurl/ range requests) using a window
cropped to the study box, so only the Greece window is transferred. The baseline needs all 19
variables (to choose a low-collinearity subset, |r| < 0.7); futures fetch only the chosen variables.
Outputs: data/processed/env/current.tif, data/processed/env/<gcm>_<ssp>.tif, env/meta.json
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402

from pipeline.lib import config, io  # noqa: E402

ENV = config.PROCESSED / "env"
META = ENV / "meta.json"
WC_BASE = "/vsizip//vsicurl/https://geodata.ucdavis.edu/climate/worldclim/2_1/base/wc2.1_{res}_bio.zip/wc2.1_{res}_bio_{i}.tif"
WC_FUT = "/vsicurl/https://geodata.ucdavis.edu/cmip6/{res}/{gcm}/{ssp}/wc2.1_{res}_bioc_{gcm}_{ssp}_{period}.tif"
DEM_TILE = ("/vsicurl/https://copernicus-dem-90m.s3.amazonaws.com/Copernicus_DSM_COG_30_N{lat:02d}_00_E{lon:03d}_00_DEM/"
            "Copernicus_DSM_COG_30_N{lat:02d}_00_E{lon:03d}_00_DEM.tif")
DEM_PX_PER_DEG = 300   # read GLO-90 COG overviews at ~360 m, enough for 4.6 km cell means
GDAL_ENV = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.zip",
                GDAL_HTTP_MAX_RETRY="5", GDAL_HTTP_RETRY_DELAY="3", VSI_CACHE="TRUE")
# Preference order when two variables are collinear: keep the more interpretable one.
PRIORITY = [1, 12, 5, 6, 15, 4, 7, 2, 3, 8, 9, 10, 11, 13, 14, 16, 17, 18, 19]


def crop(src_path: str, bands=None):
    """Read only the study-box window of a (remote) raster."""
    import rasterio
    from rasterio.windows import from_bounds

    with rasterio.Env(**GDAL_ENV), rasterio.open(src_path) as src:
        win = from_bounds(*config.STUDY_BBOX, transform=src.transform).round_offsets().round_lengths()
        arr = src.read(bands, window=win, masked=True).astype("float32")
        transform = src.window_transform(win)
        crs = src.crs
    return np.ma.filled(arr, np.nan), transform, crs


def baseline() -> tuple[np.ndarray, object, object]:
    res = config.WORLDCLIM_RES
    layers = []
    transform = crs = None
    for i in range(1, 20):
        t = time.time()
        a, transform, crs = crop(WC_BASE.format(res=res, i=i), 1)
        layers.append(a)
        print(f"baseline bio{i}: {a.shape} in {time.time() - t:.1f}s")
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
    """Mean elevation and mean slope (degrees) per climate cell from Copernicus GLO-90 COG overviews."""
    import rasterio
    from rasterio.enums import Resampling as R
    from rasterio.transform import from_origin
    from rasterio.warp import Resampling, reproject

    x0, y0, x1, y1 = config.STUDY_BBOX
    n = DEM_PX_PER_DEG
    W, H = int(round((x1 - x0) * n)), int(round((y1 - y0) * n))
    dem = np.full((H, W), np.nan, dtype="float32")
    mtrans = from_origin(x0, y1, 1 / n, 1 / n)
    got = 0
    for lat in range(int(np.floor(y0)), int(np.ceil(y1))):
        for lon in range(int(np.floor(x0)), int(np.ceil(x1))):
            try:
                with rasterio.Env(**GDAL_ENV), rasterio.open(DEM_TILE.format(lat=lat, lon=lon)) as src:
                    a = src.read(1, out_shape=(n, n), resampling=R.average, masked=True).astype("float32")
            except Exception:  # sea-only tiles do not exist
                continue
            r0 = int(round((y1 - (lat + 1)) * n)); c0 = int(round((lon - x0) * n))
            rs, cs = max(r0, 0), max(c0, 0)
            re, ce = min(r0 + n, H), min(c0 + n, W)
            if re > rs and ce > cs:
                dem[rs:re, cs:ce] = np.ma.filled(a, np.nan)[rs - r0:re - r0, cs - c0:ce - c0]
                got += 1
    print(f"DEM: {got} GLO-90 tiles read at {1 / n * 3600:.0f} arc-seconds")
    # slope (metres per degree varies with latitude)
    lat_c = np.deg2rad((y0 + y1) / 2)
    dx = (1 / n) * 111_320 * np.cos(lat_c)
    dy = (1 / n) * 110_574
    gy, gx = np.gradient(np.nan_to_num(dem, nan=0.0), dy, dx)
    slope = np.degrees(np.arctan(np.hypot(gx, gy))).astype("float32")
    slope[~np.isfinite(dem)] = np.nan
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
            out = ENV / f"{gcm}_{ssp}.tif"
            if out.exists() and not config.force():
                futures.append({"gcm": gcm, "ssp": ssp, "file": out.name}); print(f"cached: {out.name}")
                continue
            t = time.time()
            url = WC_FUT.format(res=config.WORLDCLIM_RES, gcm=gcm, ssp=ssp, period=config.FUTURE_PERIOD)
            fut, _, _ = crop(url, [v for v in keep])
            write_stack(ENV / f"{gcm}_{ssp}.tif", np.concatenate([fut, elev[None], slope[None]]), transform, crs, names)
            futures.append({"gcm": gcm, "ssp": ssp, "file": f"{gcm}_{ssp}.tif"})
            print(f"wrote {gcm} {ssp} in {time.time() - t:.1f}s")

    meta = {"variables": names, "gcms": config.GCMS, "scenarios": list(config.SCENARIOS), "source": config.CLIMATE_SOURCE, "resolution": config.WORLDCLIM_RES,
            "baseline_period": config.BASELINE_PERIOD, "future_period": config.FUTURE_PERIOD,
            "futures": futures}
    io.write_json(META, meta)
    io.update_manifest("environment", {"worldclim": "2.1", "resolution": config.WORLDCLIM_RES,
                                       "gcms": config.GCMS, "dem": "Copernicus GLO-90", "variables": names})
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
