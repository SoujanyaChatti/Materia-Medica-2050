# Dioscorides' Plants, Then and Now — PRD

Oct 25, 2026 · @Sou

## Overview

We will show which of the medicinal plants Dioscorides described in *De Materia Medica* (1st century CE) are most at risk in Greece by 2050, and where they should be protected or cultivated, delivered as a reproducible pipeline and a public map explorer.

**Problem.** The plants that shaped European pharmacy for 1,500+ years still grow wild in Greece, and several (mountain tea, Cretan dittany) are heavily wild-harvested. Climate change and collection pressure are shrinking their ranges, but nobody has assessed them as a group, linked to their historical identity.

**Research question.** Which Dioscoridean medicinal plants native to Greece face the greatest combined risk from 2050 climate change and harvesting pressure, and where could they be cultivated sustainably instead?

**One-line pitch.** The plants that founded Western pharmacy, mapped then and now: what we stand to lose, and where to save it.

**Entry.** EthnoHack 2026, Track 3 (Biodiversity and sustainability), Nov 2–8, 2026. Also targets Best Scientific Rigor, Best Community Impact and Best Collaboration.

## Goals, non-goals, success criteria

Success is a ranked, validated risk list for 25–40 plants, a cultivation map, and a website judges can explore in under a minute, all reproducible from one command.

**Goals**

- Curate 25–40 Dioscoridean plants native to Greece, each with an identification confidence.
- Model current and 2050 distributions with honest, spatially validated uncertainty.
- Rank plants by a transparent composite risk score, with a sensitivity analysis.
- Map areas suitable for cultivation in 2050, outside protected and high-biodiversity land.
- Publish a website: story, plant explorer, map explorer, methods and limitations.

**Non-goals**

- Medical or therapeutic claims about any plant.
- Translating or re-editing Dioscorides; we use existing editions and published identifications.
- Field-validated harvest data; harvest pressure is a stated proxy.
- Coverage beyond Greece.

**Success criteria**

| Criterion | Target |
| --- | --- |
| Species modelled | 25–40, each ≥ 30 cleaned occurrences (fewer flagged as low-confidence) |
| Model validation | Spatially blocked CV; mean AUC and Boyce index reported per species |
| Climate uncertainty | 2 scenarios (SSP2-4.5, SSP5-8.5) × ≥ 3 climate models |
| Risk ranking stability | Top-10 overlap reported across weight perturbations |
| Reproducibility | `make all` rebuilds every output from raw downloads |
| Website | Loads in < 3 s; every plant page shows uncertainty and sources |

## Judges and what they must see

The panel is mostly pharmacognosy, history of medicine and data science, so the submission must be historically careful, botanically correct and statistically honest ([EthnoHack page](https://ethnohack2026.devpost.com/)).

| Judge | Background (from the hackathon page unless noted) | What wins them |
| --- | --- | --- |
| Petros Bouras-Vallianatos | Professor of History of Science, NKUA; premodern and Byzantine pharmacology | Correct use of Dioscorides; disputed identifications shown, not hidden |
| Antigoni Cheilari | Pharmacist, postdoc, NKUA Pharmacognosy & Natural Products Chemistry lab | Right species, modern official use cited (EMA), no health claims |
| Mehmet Can Ay | Fraunhofer SCAI, Biomedical Data Intelligence | Clean data provenance, reproducible pipeline, documented schema |
| Nektarios Aligiannis | No bio listed; believed to be NKUA pharmacognosy (verify) | Greek medicinal flora treated accurately |
| Dimitrios Gunopulos | No bio listed; believed to be NKUA informatics, data mining (verify) | Sound spatiotemporal modelling and validation |

**Judging criteria to hit explicitly:** scientific relevance, innovation, technical implementation, data science quality (validation, uncertainty), feasibility, impact, presentation. Structure every artifact as Problem → Data → Method → Prototype → Results → Impact.

## Data sources and licences

All inputs are free and open; licences below are from memory and must be confirmed and recorded in `DATA_LICENSES.md` on day 1.

| Need | Source | Access | Licence (verify) |
| --- | --- | --- | --- |
| Dioscorides text | Wellmann's Greek edition (1906–1914) | Internet Archive scan | Public domain |
| Plant identifications | Published scholarship on Dioscoridean plant names | Manual curation, cited per plant | Cite; don't reproduce tables |
| Occurrences | GBIF | `pygbif` download API (account needed for DOI'd downloads) | Per-record CC0 / CC BY / CC BY-NC; cite download DOI |
| Taxonomy | GBIF Backbone, Plants of the World Online | API | CC BY |
| Climate now + 2050 | WorldClim 2.1 or CHELSA (CMIP6) | Direct download, crop to Greece | Free for research; cite |
| Endemism | Vascular Plants of Greece checklist | Paper supplement | Cite |
| Conservation status | IUCN Red List API | Token (apply now; takes days) | Non-commercial; cite |
| Protected areas | Natura 2000 (European Environment Agency) | Shapefile | Reuse with attribution |
| Land cover | CORINE Land Cover 2018 (Copernicus) | Raster | Free and open |
| Roads, settlements | OpenStreetMap, Geofabrik Greece extract | `.pbf` | ODbL; attribute |
| Elevation | Copernicus DEM (90 m) | Tiles | Free; attribute |
| Modern official use | EMA herbal monographs (HMPC) | PDFs, manual extraction | Reuse with acknowledgement |

**Fallbacks.** No IUCN token in time → use the Greek checklist's threat categories and say so. CHELSA too heavy → WorldClim 2.5′. A species with < 30 clean records → keep it, flag "low-confidence model".

## Method

Six pipeline stages turn a curated species list into a risk ranking, cultivation map and website data; each stage is a script with cached outputs.

1. **Species list.** Select 25–40 plants from *De Materia Medica* native to Greece. Per plant: Dioscorides book and chapter, Greek name, modern accepted name (GBIF/POWO), identification confidence (certain / probable / disputed) with a citation, Greek endemic flag, EMA monograph if one exists. Stored in `data/curated/species.csv`.
2. **Occurrences.** Download GBIF records for Greece (plus a buffer for range-edge species). Clean: drop missing or zero coordinates, country centroids, institutions, duplicates, records before 1970, coordinate uncertainty > 5 km. Thin to one record per \~1 km cell to reduce sampling bias.
3. **Environmental layers.** Crop to Greece at \~1 km: 19 bioclimatic variables (choose a low-collinearity subset, |r| < 0.7), elevation, slope. Future: 2041–2060 under SSP2-4.5 and SSP5-8.5 for ≥ 3 climate models.
4. **Species distribution models.** Presence–background models per species with `elapid` (MaxEnt) and a random-forest comparison. Background points sampled with the same bias as occurrences (target-group background). Project to current and each future scenario; average across models and report the spread.
5. **Risk score.** Per species: projected suitable-area loss (%), Greek endemism, conservation status, harvest pressure (share of current range within 2 km of roads or villages, plus a documented wild-harvest flag). Normalise each to 0–1, combine with stated weights, then run a sensitivity analysis (random weights, 1,000 draws) and report how often each species stays in the top 10.
6. **Cultivation suitability.** Cells suitable in 2050 under most models, on agricultural or transitional land (CORINE), outside Natura 2000 and away from current wild populations (to avoid genetic contamination). Output per-species rasters and a summary map.

All stages write versioned outputs, and a final export step produces the website's data files (see Data contract).

## Validation, uncertainty and limitations

Every headline number carries its uncertainty, and the limitations get their own slide and website page; this is what the panel will probe hardest.

**Validation**

- Spatially blocked cross-validation (5 folds, blocks \~25 km) per species; report AUC and continuous Boyce index, mean ± SD.
- Compare against a null model (random points within the study area) to show models beat chance.
- Sanity check: projected current ranges compared with the Vascular Plants of Greece distribution notes for 5 well-known species.

**Uncertainty, shown everywhere**

- Climate: range-loss as median and min–max across climate models and both scenarios.
- Identification: disputed plants flagged in rankings and on their page; results shown with and without them.
- Risk weights: top-10 stability from the sensitivity analysis.

**Limitations (state plainly)**

- GBIF records are biased toward accessible, well-surveyed areas.
- Harvest pressure is a proxy (accessibility), not measured collection.
- Correlative models assume species are in equilibrium with climate and ignore dispersal, soil and biotic interactions.
- Ancient plant identifications are scholarly inferences, some contested.
- Results are hypotheses for conservation planning, not prescriptions.

## Engineering spec for Claude Code

One repo holds the Python analysis pipeline and a static website; the pipeline exports JSON and map layers that the site reads, so the site needs no server.

**Stack**

- Pipeline: Python 3.11, `pygbif`, `geopandas`, `rasterio`, `rioxarray`, `xarray`, `elapid`, `scikit-learn`, `pandas`, `pyarrow`; `Makefile` + `snakemake` (or plain `make`) for stages; `pytest`.
- Website: Astro (static) + React islands, MapLibre GL JS for maps, Tailwind CSS; deployed to GitHub Pages.
- Environment: `environment.yml` (conda/mamba) pinned; `.env.example` for GBIF and IUCN credentials.

**Repository**

```text
.
├── data/
│   ├── raw/            # downloads, git-ignored, fetched by scripts
│   ├── curated/        # species.csv, identifications.csv (committed)
│   └── processed/      # cleaned occurrences, cropped rasters (git-ignored)
├── pipeline/
│   ├── 01_species.py
│   ├── 02_occurrences.py
│   ├── 03_environment.py
│   ├── 04_models.py
│   ├── 05_risk.py
│   ├── 06_cultivation.py
│   └── 07_export_web.py
├── notebooks/          # exploration + validation figures
├── outputs/            # tables, figures, model metrics
├── site/               # Astro website (reads site/public/data/)
├── tests/
├── Makefile            # make data | models | risk | web | all
├── README.md
├── DATA_LICENSES.md
├── LIMITATIONS.md
└── LICENSE             # MIT for code
```

**Engineering rules**

- Every stage is idempotent, cached and seeded; `make all` reproduces everything from raw downloads.
- Raw data never committed; scripts download it and record the GBIF download DOI.
- Each species' run logs its record counts, variables used and metrics to `outputs/metrics/<species>.json`.
- Map exports are simplified vector polygons (GeoJSON, < 300 KB per layer) so the site stays fast; full rasters ship as release assets.
- Tests cover cleaning filters, the risk score maths and the export schema.

## Website pages

Five pages, built so a judge gets the finding in 10 seconds on the home page and can explore any plant in two clicks.

| Page | Purpose | Key content |
| --- | --- | --- |
| Home (`/`) | The story and the headline finding | Hero with the one-line pitch; the top-5 at-risk plants as cards; one striking now-vs-2050 map; "Explore the plants" call to action |
| Plants (`/plants`) | Browse and compare all species | Sortable, filterable grid or table: risk rank, range loss (median and range), endemic, conservation status, ID confidence; filters by risk, endemism, confidence |
| Plant page (`/plants/[slug]`) | Everything about one plant | Dioscorides card (book/chapter, Greek name, short public-domain excerpt or paraphrase); modern identity + ID confidence with citation; EMA modern use if any; map with layers (occurrences, current range, 2050 range per scenario, cultivation zones) and a scenario toggle; risk score broken into components; model metrics; caveats |
| Map explorer (`/map`) | Greece-wide view | Choropleth of combined risk (how many at-risk species lose range per cell); cultivation hotspots; Natura 2000 overlay; click a cell to list species |
| Methods & limits (`/methods`) | Rigor for the judges | Pipeline diagram, data sources and licences, validation results, sensitivity analysis chart, limitations, how to reproduce, team and GitHub link |

**Behaviour**

- Every number shows its uncertainty (e.g. "−42% range (−28 to −61%)").
- Disputed identifications carry a visible badge everywhere the plant appears.
- Footer on every page: "Research prototype. Not medical advice. Results are model-based hypotheses."
- Fully static, works on mobile, accessible (WCAG AA contrast, keyboard map controls, alt text for maps).

## Design brief for Claude Design

The site should feel like a modern scientific atlas built on a classical herbal: scholarly and calm, with the data always legible and the uncertainty never hidden.

**Mood.** Byzantine manuscript herbal meets contemporary data atlas. Warm parchment and ink tones for the historical layer; crisp neutral surfaces for the data layer. Restrained, not themed or kitsch.

**Colour**

- Base: off-white parchment (light mode) and deep ink-green or near-black (dark mode); both required.
- Accent: a muted Byzantine red-ochre for historical elements, a sage green for living plants.
- Data: a colour-blind-safe sequential palette for risk (e.g. light to deep red) and a separate diverging palette for range change (loss vs gain). Never encode meaning by colour alone.

**Type.** A classical serif with Greek glyph support for headings and Dioscorides excerpts (e.g. a Garamond-style family); a clean sans for UI and data; tabular figures for numbers.

**Signature components**

- *Dioscorides card*: manuscript-style panel with book/chapter, Greek name in Greek script, short excerpt or paraphrase, and the modern identification beneath with a confidence badge.
- *Then / Now split*: a herbal-style illustration area beside the modern range map (use public-domain manuscript images only if licence is confirmed; otherwise a line-art placeholder).
- *Confidence badge*: three states (certain, probable, disputed) with icon + text.
- *Uncertainty number*: a value with its range rendered as a small whisker bar.
- *Risk breakdown*: horizontal stacked bar of the four risk components.
- *Scenario toggle*: Now · 2050 moderate · 2050 high, with a short label explaining each.

**Maps.** MapLibre with a quiet basemap (terrain shading, minimal labels, Greek and English place names). Layers: occurrences as aggregated \~10 km cells (never exact points), current range as a fill, 2050 range as an outline or fill with transparency, cultivation zones as a hatched pattern, Natura 2000 as a thin boundary. Always a legend and a scale bar.

**Deliverables from Claude Design:** a design system (tokens for colour, type, spacing), the five page layouts at desktop and mobile widths, the signature components, and empty, loading and error states. Hand the result to Claude Code as tokens + component specs.

## Data contract

`pipeline/07_export_web.py` writes everything the site reads into `site/public/data/`; the site never computes science, only displays it. A JSON Schema in `site/schema/` is validated in CI.

```text
site/public/data/
├── species.json                 # list for /plants
├── species/<slug>.json          # one per plant page
├── layers/<slug>/occurrences.geojson
├── layers/<slug>/range_now.geojson
├── layers/<slug>/range_2050_ssp245.geojson
├── layers/<slug>/range_2050_ssp585.geojson
├── layers/<slug>/cultivation.geojson
├── layers/greece_risk_grid.geojson
└── meta.json                    # build date, GBIF DOI, versions
```

**`species/<slug>.json`**

```json
{
  "slug": "sideritis-syriaca",
  "accepted_name": "Sideritis syriaca L.",
  "common_name_en": "Greek mountain tea",
  "dioscorides": {"book": 3, "chapter": 33, "greek_name": "σιδηρῖτις", "excerpt": "...", "edition": "Wellmann 1906–1914"},
  "identification": {"confidence": "probable", "source": "citation string"},
  "endemic_greece": false,
  "conservation_status": {"category": "NT", "source": "IUCN"},
  "ema_monograph": {"exists": true, "use": "traditional use statement", "url": "..."},
  "records": {"raw": 812, "clean": 214, "low_confidence_model": false},
  "model": {"auc_mean": 0.86, "auc_sd": 0.04, "boyce_mean": 0.71},
  "range_change_pct": {"ssp245": {"median": -38, "min": -22, "max": -55}, "ssp585": {"median": -51, "min": -34, "max": -70}},
  "risk": {"score": 0.74, "rank": 3, "top10_stability": 0.92, "components": {"range_loss": 0.8, "endemism": 0.0, "status": 0.6, "harvest": 0.9}},
  "cultivation_area_km2": 1240,
  "caveats": ["GBIF records cluster near Mt Olympus trails"]
}
```

All values above are illustrative placeholders, not results. Field names are fixed; the design and the site must handle missing optional fields (`ema_monograph`, `conservation_status`).

## Responsible research

The hackathon requires respecting licences, traditional knowledge and scientific integrity, and forbids presenting unvalidated computational findings as medical facts; we design for that from the start.

- **No health claims.** Modern use is quoted only from EMA monographs, labelled "traditional use" where EMA says so; no dosing, no efficacy statements.
- **Sensitive locations.** Exact coordinates of rare or over-harvested species are never shown; occurrences are aggregated to \~10 km cells on the public site, so the map can't guide collectors.
- **Cultivation, not collection.** The site promotes cultivation zones and never ranks wild sites for harvesting.
- **Historical sources.** Public-domain edition only; identifications cited to their scholars; disputed ones marked.
- **Licences and attribution.** Every dataset credited in `DATA_LICENSES.md` and on `/methods`; GBIF download DOI cited.
- **AI use.** Any AI-assisted text (e.g. paraphrased excerpts) reviewed by a team member and labelled.

## Deliverables, team and timeline

Submit four things by Nov 8: the Devpost page, the public GitHub repo, a pitch video of at most 10 minutes and a deck of at most 10 slides; the live website link goes on the Devpost page.

**Team (2–5 students; registration closes Oct 31, 11:00 PM)**

| Role | Owns |
| --- | --- |
| Geo / ML lead | Occurrence cleaning, distribution models, validation, risk score |
| Data + web developer | Pipeline engineering, export, website build, deployment, README |
| Pharmacy or botany student | Species list, identification confidence, EMA cards, domain review |
| History or classics student (optional) | Dioscorides chapters and Greek names |

**Before Nov 2:** form and register the team, apply for the IUCN token, confirm the rules on pre-hackathon work (if not allowed: plan, read and learn tools only), draft the species list.

**Deck (10 slides):** title, problem, data, method, validation, results (risk ranking), cultivation map, website demo, limitations, impact and next steps.

&#91;embedded content: build timeline · Oct 31 to Nov 8, 2026\]

Modelling gates the risk score; the site is built against sample data in parallel and switched to real exports on Nov 6–7.

## Handoff prompts

Paste these with this PRD attached; run Claude Design first so Claude Code builds the site against its tokens and components.

**Claude Design**

```markdown
Design a five-page website for "Dioscorides' Plants, Then and Now", using the attached PRD (sections: Website pages, Design brief, Data contract).
Deliver: a design system (colour, type, spacing tokens; light and dark modes), the five page layouts at desktop and mobile widths, and the signature components (Dioscorides card, confidence badge, uncertainty number, risk breakdown bar, scenario toggle, map legend). Include empty, loading and error states.
Mood: Byzantine herbal meets modern data atlas; scholarly and calm. Colour-blind-safe data palettes; never encode meaning by colour alone.
Use the illustrative JSON in the Data contract for realistic content, and label it as sample data.
```

**Claude Code**

```markdown
Build the project in the attached PRD, following the Engineering spec, Method, Validation and Data contract sections exactly.
Order: (1) repo scaffold, environment, Makefile, DATA_LICENSES.md; (2) pipeline stages 01–03 with tests; (3) stage 04 models with spatially blocked CV and per-species metrics; (4) stages 05–06 risk score with sensitivity analysis and cultivation layer; (5) stage 07 export validated against the JSON Schema; (6) Astro site using the design tokens and components from Claude Design; (7) README with one-command reproduction and LIMITATIONS.md.
Rules: no invented results; seed everything; never publish exact coordinates of sensitive species (aggregate to ~10 km); show uncertainty on every number; mark the site as a research prototype, not medical advice.
Stop and ask if a dataset's licence or access differs from the PRD.
```
