# Dioscorides' Plants, Then and Now

**The plants that founded Western pharmacy, mapped then and now: what we stand to lose, and where to save it.**

We assess which medicinal plants described in Dioscorides' *De Materia Medica* (1st century CE) that grow wild in Greece face the greatest combined risk from 2050 climate change and harvesting pressure, and where they could be cultivated instead. The project is a reproducible Python pipeline plus a static website. EthnoHack 2026, Track 3.

> Research prototype. Not medical advice. Results are model-based hypotheses.

## Quick start

```bash
# Website only, with clearly labelled SAMPLE data (no pipeline, no credentials)
cd site && npm ci && npm run data:sample && npm run dev     # http://localhost:4321

# Full reproduction from raw downloads
cp .env.example .env            # GBIF account; IUCN token optional
make env && conda activate dioscorides
make all                        # data → models → risk → web export → tests → site build
```

`make help` lists every target. Each stage is idempotent and cached; `FORCE=1 make <target>` recomputes.

## Repository

```text
data/curated/       species.csv, identifications.csv (hand-curated, committed)
data/raw/           downloads (git-ignored)      data/processed/  intermediate (git-ignored)
data/manifest.yml   GBIF download DOI, data versions (written by the pipeline)
pipeline/01–07      one script per stage; shared, unit-tested logic in pipeline/lib/
outputs/            metrics/<slug>.json, risk.csv, sensitivity.json, cultivation.csv, rasters/
site/               Astro + React islands + MapLibre + Tailwind; reads site/public/data/
site/schema/        JSON Schema for every file the site reads (the data contract)
tests/              cleaning filters, risk maths, export schema
```

| Stage | Script | Does |
| --- | --- | --- |
| 1 | `01_species.py` | Checks `species.csv`, resolves names on the GBIF Backbone |
| 2 | `02_occurrences.py` | One DOI'd GBIF download of all vascular plants in the study box (also the model background); drops missing/zero coords, country centroids, institutions, duplicates, pre-1970, uncertainty > 5 km; thins to ~1 km |
| 3 | `03_environment.py` | WorldClim 2.1 bioclim at 2.5′ (baseline + 3 GCMs × SSP2-4.5/SSP5-8.5, 2041–2060), Copernicus DEM elevation/slope; keeps variables with \|r\| < 0.7; reads only the Greece window over HTTP |
| 4 | `04_models.py` | MaxEnt (elapid) + random forest, target-group background, 5-fold ~25 km spatial-block CV (AUC, TSS, Boyce, null model); projects to every GCM × SSP |
| 5 | `05_risk.py` | Range loss, endemism, status (IUCN or checklist), harvest proxy (OSM 2 km); weights 0.4/0.2/0.2/0.2; 1,000 random weightings + ±50% one-at-a-time sensitivity; with/without disputed IDs |
| 6 | `06_cultivation.py` | Suitable in 2050 under >50% of GCMs, CORINE farmland/transitional, outside Natura 2000, ≥ 5 km from wild records |
| 7 | `07_export_web.py` | ~10 km EPSG:3035 cells as GeoJSON (never points), species JSON, `meta.json`; validates against `site/schema/`, fails on > 300 KB layers |

### Inputs that are not fetched automatically

- **CORINE Land Cover 2018**, raster 100 m (free Copernicus account): download from
  https://land.copernicus.eu/en/products/corine-land-cover/clc2018 (Greece-only area is enough) and put the
  `.tif` anywhere in `data/raw/corine/`. Stage 06 reads only the Greece window.
- **Natura 2000, end-2024 release** (EEA, CC BY 4.0, public): `Natura2000_end2024.gpkg` from the EEA datashare
  (`eea_v_3035_100_k_natura2000_p_2024_v01_r00`). We keep only the Greek sites:
  `data/raw/natura2000/Natura2000_end2024_GR.gpkg` (446 sites).

Everything else is downloaded by the pipeline. WorldClim and the Copernicus DEM are read straight from the
provider for the Greece window only, so no global file is ever stored.

## Website

Five pages: Home, Plants (sortable/filterable table or grid), Plant page (Dioscorides card, Then/Now map with scenario toggle and layers, EMA status, risk breakdown, model quality, caveats, table fallback), Map explorer (combined-risk grid, cultivation hotspots, Natura 2000, click a cell or pick an area), Methods & limitations. Light and dark themes; design tokens in `site/src/styles/tokens.css` follow the Claude Design handoff. Every estimate prints its interval; disputed identifications carry a badge everywhere; colour is never the only cue.

The site never computes science: it only displays `site/public/data/`. When `meta.json` has `"sample": true`, every page shows a **Sample data** banner. Deploys to GitHub Pages via `.github/workflows/site.yml` (CI also runs pytest, including schema validation).

## Open items

- Open the IUCN Red List and GBIF terms pages in a browser and confirm public display is allowed (both blocked automated checks; see `DATA_LICENSES.md`).
- Ask WorldClim (info@worldclim.org) whether a public site showing derived 10 km model outputs is acceptable.
- Plants whose identification citation, EMA status or wild-harvest evidence could not be verified carry the reason in the `unverified` column of `data/curated/species.csv`.

See `LIMITATIONS.md` for what the results can and cannot say.

## Licence

Code: MIT (`LICENSE`). Data: see `DATA_LICENSES.md`.
