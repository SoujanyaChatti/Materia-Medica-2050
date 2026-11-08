<div align="center">

# Materia Medica 2050

### The plants that founded Western pharmacy, mapped then and now: what we stand to lose, and where to save it

**[Live site](https://materia-medica-2050.vercel.app)** · **[Pitch deck (.pptx)](docs/materia-medica-2050.pptx)** · **[Methods](https://materia-medica-2050.vercel.app/methods/)** · **[Limitations](LIMITATIONS.md)** · **[Data licences](DATA_LICENSES.md)**

EthnoHack 2026 · Track 3 · Ethnopharmacology research prototype

![Python 3.11](https://img.shields.io/badge/python-3.11-17322A) ![Astro](https://img.shields.io/badge/site-Astro%20%2B%20MapLibre-B4532A) ![Data: GBIF DOI](https://img.shields.io/badge/GBIF-10.15468%2Fdl.4u6k8n-7FA383) ![Licence: MIT](https://img.shields.io/badge/code-MIT-5F6B66)

<a href="https://materia-medica-2050.vercel.app"><img src="docs/images/home.jpg" alt="Home page: the Greek word diktamnon beside a 2050 range map of Cretan dittany, with headline numbers: 32 species, 2 scenarios × 3 climate models, 11 of 32 lose wild habitat, 16 plants with candidate farmland, 115 historical identifications" width="100%"></a>

</div>

> **Research prototype. Not medical advice.** Every result here is a model-based hypothesis with its uncertainty shown, not an established fact.

---

## Inspiration

Two thousand years ago a Greek army physician, Pedanius Dioscorides, wrote down about six hundred medicinal plants in *De Materia Medica*. The book was copied, translated and used for some fifteen hundred years. It is the root of Western pharmacy.

Many of those plants still grow wild in Greece. Today they face three pressures at once:

- the Mediterranean is warming faster than the global average;
- many species are still collected from the wild;
- their habitat is being converted.

Conservation money is limited, so someone has to decide which plants come first. That decision is usually made one species at a time, without linking the plant back to its history, and without saying how uncertain the evidence is.

We wanted a ranked, open and honest list that starts from the ancient text and ends with an action someone can take.

## What it does

For **32 Dioscoridean plants that grow wild in Greece**, Materia Medica 2050 answers three questions:

1. **Which are we most likely to lose by 2050?** A risk score combines climate-driven range loss, endemism, conservation status and harvest pressure.
2. **Where could they be grown instead?** We look for farmland that will suit each plant in 2050, outside Natura 2000 and at least 5 km from wild populations.
3. **How sure are we?** Every number carries its range across three climate models and two emission scenarios. Every plant carries its identification confidence: *certain*, *probable* or *disputed*.

### The headline: Cretan dittany (δίκταμνον)

<table>
<tr>
<td width="52%"><img src="docs/images/top10-risk.png" alt="Top-10 risk scores with ranges across three climate models; Cretan dittany first at 0.62 (0.48 to 0.71)"></td>
<td width="48%"><img src="docs/images/dittany-crete.png" alt="Crete map: dittany's climate space kept (sage), lost by 2050 (rust), and a single candidate cultivation cell (gold)"></td>
</tr>
<tr>
<td><sub>Top-10 risk score. The brackets give the score range across 3 climate models (SSP2-4.5).</sub></td>
<td><sub>Dittany's 2050 climate space on Crete: kept (sage), lost (rust), and the one cell suitable for cultivation (gold).</sub></td>
</tr>
</table>

**Cretan dittany** ranks first.
- **Identification:** certain.
- **Endemism:** found only on Crete.
- **Range change:** under moderate emissions (SSP2-4.5) it loses a median **58%** of its climate range by 2050, between 24% and 81% depending on the climate model. Under high emissions (SSP5-8.5) the median loss is 65%.
- **Where it could be grown:** a single ~17 km² cell of farmland.

So dittany has almost nowhere to be grown instead, and it needs protection in the wild.

| # | Plant | Identification | Range change 2050, SSP2-4.5 (median, min to max) | Risk score (range) |
|---|---|---|---|---|
| 1 | Cretan dittany, *Origanum dictamnus* | certain | −58% (−81 to −24) | **0.62** (0.48–0.71) |
| 2 | Hyssop, *Hyssopus officinalis* | disputed | −69% (−74 to −57) | **0.57** (0.52–0.59) |
| 3 | Marsh mallow, *Althaea officinalis* | probable | −62% (−68 to −55) | **0.54** (0.51–0.56) |
| 4 | Cretan mountain tea, *Sideritis syriaca* | disputed | −50% (−52 to −32) | **0.49** (0.42–0.50) |
| 5 | Wild peonies, *Paeonia* (pooled) | disputed | −24% (−41 to −17) | **0.44** (0.42–0.51) |
| 6 | Liquorice, *Glycyrrhiza glabra* | probable | −56% (−61 to −18) | **0.40** (0.24–0.42) |
| 7 | Elder, *Sambucus nigra* | probable | −48% (−52 to −42) | **0.39** (0.37–0.40) |
| 8 | Prickly juniper, *Juniperus deltoides* | disputed | −22% (−24 to −16) | **0.38** (0.36–0.39) |
| 9 | Greek oregano, *Origanum vulgare* | probable | −18% (−19 to −14) | **0.37** (0.35–0.38) |
| 10 | St John's wort, *Hypericum perforatum* | disputed | −9% (−10 to −5) | **0.33** (0.32–0.34) |

**Key results:**
- **A split future.** 11 of the 32 plants lose wild habitat under all three climate models. The other 21 keep or gain climate space, but those gains are best-case, because they assume the plant can reach every new place.
- **The names matter as much as the climate.** If we drop the 9 plants whose ancient identification is disputed, only **half of the top 10 stays the same**. We report this as a finding, not a footnote.
- **The ranking is stable to how we weight risk.** Under 1,000 random weightings, the top 10 holds **84%** of the time on average.

### Explore it on the website

<table>
<tr>
<td width="50%"><a href="https://materia-medica-2050.vercel.app/plants/origanum-dictamnus/"><img src="docs/images/plant.jpg" alt="Plant page for Cretan dittany"></a><br><b>A page for every plant.</b> It has Dioscorides' Greek text with a link to the page scan of the 1906 edition, plus the Then/Now map with a scenario toggle. You also get the risk breakdown, model quality, a suggested action and every number's range.</td>
<td width="50%"><a href="https://materia-medica-2050.vercel.app/map/"><img src="docs/images/map.jpg" alt="Map explorer with combined risk, cultivation hotspots and Natura 2000"></a><br><b>Map explorer.</b> Combined risk, cultivation hotspots and Natura 2000 sites on a ~10 km grid. Click any area to list the plants modelled there.</td>
</tr>
<tr>
<td><a href="https://materia-medica-2050.vercel.app/act/"><img src="docs/images/matrix.jpg" alt="Decision matrix: range change against 2050 cultivation area"></a><br><b>Action plan.</b> Every plant is placed by two questions: does its habitat shrink in all three climate models, and is there farmland for it in 2050? The answers give <b>6 to protect and cultivate</b>, <b>5 to protect with no farmland fallback</b>, 10 cultivation opportunities and 11 to monitor.</td>
<td><a href="https://materia-medica-2050.vercel.app/act/#grow"><img src="docs/images/grower-finder.jpg" alt="Grower finder showing the Heraklion grower sheet"></a><br><b>Grower finder.</b> Pick a ~10 km cell or a farming region to see what its 2050 climate could support. It shows which of those plants are shrinking in the wild and which have an EU herbal monograph, a sign that a regulated market exists. You can download the sheet as a CSV.</td>
</tr>
<tr>
<td><a href="https://materia-medica-2050.vercel.app/names/"><img src="docs/images/names.jpg" alt="Names through time: identification claims from 1530 to 2021"></a><br><b>Names through time.</b> 115 dated identification claims by 16 authorities, from 1530 to 2021: who proposed, preferred or rejected which modern plant for each Greek name.</td>
<td><a href="https://materia-medica-2050.vercel.app/plants/#lab"><img src="docs/images/lab.jpg" alt="Risk weight lab with sliders and live re-ranking"></a><br><b>Risk weight lab.</b> Don't agree with our weights? Move them, or pick a stakeholder preset. The 32 plants re-rank live, with Kendall τ showing how far the order moved from ours.</td>
</tr>
</table>

## How we built it

```mermaid
flowchart LR
  A["De Materia Medica<br/>Wellmann 1906–14"] --> B["01 · 32 species<br/>certain / probable / disputed"]
  G["GBIF<br/>933,943 records<br/>one DOI'd download"] --> C["02 · clean, de-duplicate,<br/>thin to ~1 km"]
  W["WorldClim 2.1 · CMIP6<br/>Copernicus DEM"] --> D["03 · low-collinearity<br/>variables at 2.5′"]
  B --> C --> E
  D --> E["04 · MaxEnt + random forest<br/>spatial-block CV<br/>3 GCMs × 2 SSPs"]
  E --> F["05 · risk score<br/>+ 1,000 weightings"]
  O["IUCN · OSM · EMA"] --> F
  E --> H["06 · cultivation zones"]
  K["CORINE · Natura 2000"] --> H
  F --> X["07 · web export<br/>~10 km cells only"]
  H --> X --> Y["08 · action layers"] --> S["Astro site<br/>Vercel"]
```

- **From text to taxa.** The plants come from Wellmann's public-domain Greek edition of Dioscorides. Each one is matched to a modern species using published scholarly identifications, and each match is tagged *certain*, *probable* or *disputed* with its source.
- **Occurrences.** One GBIF download covers all vascular plants in the study box: 933,943 records, [doi:10.15468/dl.4u6k8n](https://doi.org/10.15468/dl.4u6k8n). It also serves as a **target-group background**, so the model learns climate rather than where botanists like to walk. We drop records with missing or zero coordinates, country centroids, institution coordinates, duplicates, records from before 1970 and uncertainty over 5 km, then thin to ~1 km.
- **Models.** MaxEnt (elapid) and random forest are each scored with **5-fold spatially blocked cross-validation** (~25 km blocks) against a null model. Cretan dittany, for example, reaches an AUC of **0.96** against **0.49** for the null.
- **Futures.** Three CMIP6 models (MPI-ESM1-2-HR, MRI-ESM2-0, IPSL-CM6A-LR) × two scenarios (SSP2-4.5 and SSP5-8.5), for 2041–2060. We report the median and the min to max.
- **Risk.** The score is weighted 0.4 range loss, 0.2 endemism, 0.2 conservation status and 0.2 harvest proxy. We test it under 1,000 random weightings and ±50% one-at-a-time changes, with and without the disputed identifications.
- **Cultivation.** A cell qualifies if it is suitable in 2050 under the majority of climate models, is CORINE farmland, lies outside Natura 2000 and is at least 5 km from wild records, so farms never compete with the wild stands they are meant to protect.
- **Stack.**
  - Pipeline: Python 3.11 (rasterio, scikit-learn, elapid, geopandas), seeded and cached. `make all` rebuilds everything from raw data, with tests.
  - Website: static **Astro** with React islands, **MapLibre** and Tailwind. It reads only the pipeline's exports, validated against JSON Schemas in `site/schema/`, and is deployed on **Vercel**.

## Challenges we ran into

- **Which plant did Dioscorides mean?** A Greek name is not a species. Five centuries of scholars disagree, and 9 of our 32 identifications are disputed. Rather than hide this, we modelled the best-supported plant, flagged the rest everywhere they appear, and measured how much the dispute moves the ranking.
- **Sampling bias.** GBIF records cluster near roads, trails and famous mountains. A random background would have taught the model where people walk, so we drew the background from the same survey effort (target-group background) and thinned it.
- **Harvest pressure is hard to measure.** No national dataset of wild collection exists. Our proxy, the share of a plant's range within 2 km of roads or settlements, saturates in Greece's dense road network: it only spans 0.86 to 0.99. We kept it, said so, and built the weight lab so anyone can see how little it moves the ranking.
- **Licences.** WorldClim does not allow its rasters to be redistributed, so the repository and site ship only our derived model outputs and the code to rebuild everything.
- **Rare plants and privacy.** A precise map of an over-collected endemic is a shopping list for collectors. Everything public is aggregated to ~10 km cells, so no exact location is ever published.

## Accomplishments that we're proud of

- **Uncertainty on every number.** Every range change, risk score, rank and cultivation area on the site shows its interval, and every disputed identification carries a badge. Colour is never the only cue.
- **The finding nobody expected.** Uncertainty about the *history of a name* changes the ranking as much as the climate models do.
- **From ranking to action.** The decision matrix and grower finder turn model output into something a conservation agency, a cooperative or an extension service can use.
- **Reproducible end to end.** One command rebuilds every result from a cited GBIF download, with tests and a schema-validated data contract between the pipeline and the site.
- **History you can check.** Each plant links to Dioscorides' Greek text, the page scan of the 1906 edition, and who identified the plant and on what evidence.

## What we learned

- **The future is split, not uniformly bleak.** Across all 32 plants the median range change under SSP2-4.5 is +16% (range −23% to +64%). The losers, though, are the narrow endemics and the plants with nowhere to go: 11 lose habitat in every model.
- **The model is only as good as the name.** Ethnopharmacology and climate science meet at taxonomy. When a name is uncertain, the rest of the analysis is too.
- **A weak signal shown honestly beats a strong one invented.** Showing that harvest pressure barely separates the plants tells the reader exactly what better data would fix.
- **Design is part of the science.** Hatching for loss, hollow markers for unresolved data, intervals in brackets: how a result is drawn decides whether a reader over-trusts it.

## What's next for Materia Medica 2050

- **Expert review** of the disputed identifications with botanists working on the Flora of Greece.
- **Split the species we had to pool** (such as the Greek peonies) as more records become available.
- **Test the cultivation zones** with collectors' cooperatives in Crete, with consent and shared benefit.
- **Measured harvest data** (permits, trade volumes) to replace the access proxy.
- **Extend to Cyprus and Anatolia**, where many of Dioscorides' plants also grow. The pipeline works for any region and any plant list.

## Responsible research

| Area | What we do |
|---|---|
| **Health claims** | None. Modern use is quoted only as the European Medicines Agency labels it; the site is marked "not medical advice". |
| **Rare-plant privacy** | No exact coordinates are published, only ~10 km cells. |
| **Licences** | Every source, licence and attribution is listed in [`DATA_LICENSES.md`](DATA_LICENSES.md) and on the Methods page. No WorldClim rasters are redistributed. |
| **Traditional knowledge** | Our source is a published classical text. We collected no knowledge from living communities. |
| **AI use** | AI assistants helped with code and with gathering sources. Every identification links to its source and page scan so anyone can check it. |
| **Limits** | Correlative models, sampling bias, a harvest proxy and a coarse public grid. All nine limits are in [`LIMITATIONS.md`](LIMITATIONS.md). |

---

## Quick start

```bash
# Website only: the published results are committed in site/public/data
cd site && npm ci && npm run dev                          # http://localhost:4321

# Full reproduction from raw downloads (~25 min plus downloads)
cp .env.example .env            # GBIF account + IUCN token
make env && conda activate dioscorides      # or: python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt
# put the CORINE 2018 raster in data/raw/corine/ and the Natura 2000 GeoPackage in data/raw/natura2000/ (see below)
make all                        # data → models → risk → web export → tests → site build
```

- `make help` lists every target. Each stage is idempotent and cached, and `FORCE=1 make <target>` recomputes it.
- `npm run data:sample` overwrites `site/public/data` with clearly labelled synthetic data for design work. Don't run it unless you mean to.

## Repository

```text
data/curated/       species.csv, identifications.csv (hand-curated, committed)
data/raw/           downloads (git-ignored)      data/processed/  intermediate (git-ignored)
data/manifest.yml   GBIF download DOI, data versions (written by the pipeline)
pipeline/01–08      one script per stage; shared, unit-tested logic in pipeline/lib/
outputs/            metrics/<slug>.json, risk.csv, sensitivity.json, cultivation.csv
site/               Astro + React islands + MapLibre + Tailwind; reads site/public/data/
site/schema/        JSON Schema for every file the site reads (the data contract)
tests/              cleaning filters, risk maths, export schema
docs/               pitch deck and README images
```

| Stage | Script | Does |
| --- | --- | --- |
| 1 | `01_species.py` | Checks `species.csv` and resolves names on the GBIF Backbone. |
| 2 | `02_occurrences.py` | Makes one DOI'd GBIF download of all vascular plants in the study box (also the model background). Drops missing or zero coordinates, country centroids, institutions, duplicates, pre-1970 records and uncertainty over 5 km, then thins to ~1 km. |
| 3 | `03_environment.py` | Gets WorldClim 2.1 bioclim at 2.5′ (baseline plus 3 GCMs × SSP2-4.5/SSP5-8.5, 2041–2060) and Copernicus DEM elevation and slope. Keeps variables with \|r\| < 0.7. Reads only the Greece window over HTTP. |
| 4 | `04_models.py` | Fits MaxEnt (elapid) and random forest with a target-group background. Scores them with 5-fold ~25 km spatial-block CV (AUC, TSS, Boyce, null model) and projects to every GCM × SSP. |
| 5 | `05_risk.py` | Combines range loss, endemism, status (IUCN or checklist) and a harvest proxy (OSM, 2 km) with weights 0.4/0.2/0.2/0.2. Runs 1,000 random weightings, ±50% one-at-a-time sensitivity, and the ranking with and without disputed IDs. |
| 6 | `06_cultivation.py` | Selects cells suitable in 2050 under more than 50% of GCMs, on CORINE farmland or transitional land, outside Natura 2000 and at least 5 km from wild records. |
| 7 | `07_export_web.py` | Writes ~10 km EPSG:3035 cells as GeoJSON (never points), species JSON and `meta.json`. Validates against `site/schema/` and fails on layers over 300 KB. |
| 8 | `08_action_layers.py` | Standard library only; reads the stage-7 exports. Writes a per-cell grower index (validated against stage 7's cultivation counts, 0 mismatches) and `lineage.json`, which holds every dated identification claim since 1530. |

### Inputs that are not fetched automatically

- **CORINE Land Cover 2018**, 100 m raster (free Copernicus account).
  - Download it from https://land.copernicus.eu/en/products/corine-land-cover/clc2018. The Greece-only area is enough.
  - Put the `.tif` anywhere in `data/raw/corine/`. Stage 06 reads only the Greece window.
- **Natura 2000, end-2024 release** (EEA, CC BY 4.0, public).
  - Get `Natura2000_end2024.gpkg` from the EEA datashare (`eea_v_3035_100_k_natura2000_p_2024_v01_r00`).
  - We keep only the Greek sites, in `data/raw/natura2000/Natura2000_end2024_GR.gpkg` (446 sites).

The pipeline downloads everything else. WorldClim and the Copernicus DEM are read straight from the provider for the Greece window only, so no global file is ever stored.

## Website

- **Live:** https://materia-medica-2050.vercel.app, deployed on Vercel from `site/`.
- **Pages:** Home, Plants (with the risk weight lab), a page per plant, Map explorer, Action plan (`/act`), Names through time (`/names`), and Methods & limitations.
- **Themes:** light and dark. Design tokens live in `site/src/styles/tokens.css`.
- **No science on the site.** It only displays `site/public/data/`. When `meta.json` has `"sample": true`, every page shows a **Sample data** banner.
- **CI:** runs pytest, including schema validation (`.github/workflows/site.yml`).

## Open items

- Open the IUCN Red List and GBIF terms pages in a browser and confirm that public display is allowed. Both blocked automated checks; see `DATA_LICENSES.md`.
- Ask WorldClim (info@worldclim.org) whether a public site showing derived 10 km model outputs is acceptable.
- Plants whose identification citation, EMA status or wild-harvest evidence could not be verified carry the reason in the `unverified` column of `data/curated/species.csv`.

## Team

Built for EthnoHack 2026 by **Soujanya Chatti** and **[DurgaPritam](https://github.com/DurgaPritam)**.

## Licence

Code: MIT ([`LICENSE`](LICENSE)). Data: see [`DATA_LICENSES.md`](DATA_LICENSES.md). Basemap: Natural Earth (public domain).
