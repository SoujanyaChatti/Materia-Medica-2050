# Data sources and licences

**Status: every licence below was written from memory in the PRD and must be confirmed against the source's own terms before release.** Tick each row once checked and record the date and the URL of the terms you read.

Raw data is never committed; the pipeline downloads it into `data/raw/` and records versions and the GBIF download DOI in `data/manifest.yml`.

| ✓ | Need | Source | Access | Licence (verify) | Attribution string |
| --- | --- | --- | --- | --- | --- |
| [ ] | Dioscorides text | Wellmann, *Pedanii Dioscuridis Anazarbei De materia medica* (1906–1914) | Internet Archive scan | Public domain | Wellmann M. (ed.) 1906–1914. Berlin: Weidmann. |
| [ ] | Plant identifications | Published scholarship on Dioscoridean plant names | Manual curation, cited per plant in `data/curated/identifications.csv` | Cite; do not reproduce tables | Per plant |
| [ ] | Occurrences | GBIF | `pygbif` download API | Per record CC0 / CC BY / CC BY-NC | GBIF.org (date) GBIF Occurrence Download https://doi.org/[DOI] |
| [ ] | Taxonomy | GBIF Backbone; Plants of the World Online | API | CC BY | GBIF Secretariat; POWO (Kew) |
| [ ] | Climate now + 2050 | WorldClim 2.1 (default, 2.5′) or CHELSA (CMIP6) | Direct download, cropped to Greece | Free for research; cite | Fick & Hijmans 2017, Int. J. Climatol. |
| [ ] | Endemism | Vascular Plants of Greece checklist | Paper supplement | Cite | Dimopoulos et al. 2013/2016 |
| [ ] | Conservation status | IUCN Red List API v4 | Token | Non-commercial; cite | IUCN (year). The IUCN Red List of Threatened Species. Version [x] |
| [ ] | Protected areas | Natura 2000 (European Environment Agency) | Shapefile / GeoPackage | Re-use with attribution | © European Environment Agency |
| [ ] | Land cover | CORINE Land Cover 2018 (Copernicus) | Raster | Free and open | © European Union, Copernicus Land Monitoring Service, EEA |
| [ ] | Roads, settlements | OpenStreetMap, Geofabrik Greece extract | `.pbf` | ODbL | © OpenStreetMap contributors |
| [ ] | Elevation | Copernicus DEM GLO-90 | AWS open data tiles | Free; attribute | © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the EU and ESA |
| [ ] | Modern official use | EMA herbal monographs (HMPC) | PDFs, manual extraction | Re-use with acknowledgement | © European Medicines Agency |
| [ ] | Basemap outline | Natural Earth 1:50m via `world-atlas` | npm package | Public domain | Made with Natural Earth |

## Fallbacks (from the PRD)

- No IUCN token in time → use the Greek checklist's threat categories (column `conservation_category` in `data/curated/species.csv`) and say so on `/methods`.
- CHELSA too heavy → WorldClim 2.5′ (this is the pipeline default; set `CLIMATE_SOURCE` in `pipeline/lib/config.py`).
- A species with < 30 clean records → keep it, flag "low-confidence model".

If a dataset's licence or access turns out to differ from this table, stop and resolve it with the team before publishing.
