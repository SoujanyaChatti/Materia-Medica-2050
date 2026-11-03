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
| 2 | `02_occurrences.py` | One DOI'd GBIF download; drops missing/zero coords, country centroids, institutions, duplicates, pre-1970, uncertainty > 5 km; thins to ~1 km |
| 3 | `03_environment.py` | WorldClim 2.1 bioclim (baseline + 5 GCMs × SSP2-4.5/SSP5-8.5, 2041–2060), Copernicus DEM elevation/slope; keeps variables with \|r\| < 0.7 |
| 4 | `04_models.py` | MaxEnt (elapid) + random forest, target-group background, 5-fold ~25 km spatial-block CV (AUC, TSS, Boyce, null model); projects to every GCM × SSP |
| 5 | `05_risk.py` | Range loss, endemism, status (IUCN or checklist), harvest proxy (OSM 2 km); weights 0.4/0.2/0.2/0.2; 1,000 random weightings + ±50% one-at-a-time sensitivity; with/without disputed IDs |
| 6 | `06_cultivation.py` | Suitable in 2050 under >50% of GCMs, CORINE farmland/transitional, outside Natura 2000, ≥ 5 km from wild records |
| 7 | `07_export_web.py` | ~10 km EPSG:3035 cells as GeoJSON (never points), species JSON, `meta.json`; validates against `site/schema/`, fails on > 300 KB layers |

### Manual downloads (licence acceptance needed)

Place these before `make cultivation`:

- CORINE Land Cover 2018 raster (100 m) → `data/raw/corine/U2018_CLC2018_V2020_20u1.tif` (land.copernicus.eu, free login)
- Natura 2000 end-2021 GeoPackage → `data/raw/natura2000/Natura2000_end2021.gpkg` (EEA)

## Website

Five pages: Home, Plants (sortable/filterable table or grid), Plant page (Dioscorides card, Then/Now map with scenario toggle and layers, EMA status, risk breakdown, model quality, caveats, table fallback), Map explorer (combined-risk grid, cultivation hotspots, Natura 2000, click a cell or pick an area), Methods & limitations. Light and dark themes; design tokens in `site/src/styles/tokens.css` follow the Claude Design handoff. Every estimate prints its interval; disputed identifications carry a badge everywhere; colour is never the only cue.

The site never computes science: it only displays `site/public/data/`. When `meta.json` has `"sample": true`, every page shows a **Sample data** banner. Deploys to GitHub Pages via `.github/workflows/site.yml` (CI also runs pytest, including schema validation).

## Before submission — open items

- Confirm every licence in `DATA_LICENSES.md`.
- Grow `species.csv` from 8 to 25–40 plants; fill `identification_source`, Dioscorides chapters, Greek excerpts (Wellmann, public domain), EMA monograph references, conservation categories (all marked `[TODO]`/`[verify]`).
- Replace the herb line-art placeholder only with public-domain manuscript images whose licence is confirmed.
- Replace team names, GitHub links and citation in `site/src/pages/methods.astro` and the footer.

See `LIMITATIONS.md` for what the results can and cannot say.

## Licence

Code: MIT (`LICENSE`). Data: see `DATA_LICENSES.md`.
