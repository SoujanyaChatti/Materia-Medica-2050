## Inspiration

Two thousand years ago, the Greek physician Dioscorides wrote down about six hundred medicinal plants in *De Materia Medica*. The book shaped European pharmacy for some fifteen hundred years, and many of its plants still grow wild in Greece. Those plants now face climate change, wild collection and habitat loss at once. A recent review of 148 studies of Greek medicinal and aromatic plants concludes that "threats from climate and land-use change remain significant" (Solomou et al. 2026, *Diversity* 18:56).

Conservation money is limited, so someone has to decide which plants come first. We asked: **by 2050, which of Dioscorides' plants are we most likely to lose, and where could we grow them instead?**

Along the way we hit a deeper question. Matching an ancient Greek name to a modern species is itself an interpretation, and scholars have disagreed about many of these names since the Renaissance. So we also asked: **how much does the ranking depend on which plant Dioscorides actually meant?**

## What it does

Materia Medica 2050 models **32 Dioscoridean plants that grow wild in Greece**. For each plant it estimates:
- its climate range today and in 2041–2060, under three climate models and two emission scenarios;
- a risk score combining range loss, endemism, conservation status and harvest access;
- the farmland where it could be grown instead.

Every number carries its range across climate models.

**Headline finding: which plant Dioscorides meant moves 5 of 32 plants in or out of the top 10.** Nine of our plants have disputed identifications. We modelled all 19 rival species that the scholarship we cite names for them, and re-ranked all 32 plants once per alternative.
- Four of the five disputed plants in the top 10 can drop out of it. Hyssop, for example, can fall from rank 2 to rank 19.
- Modelled as *Paeonia peregrina*, the peony would rank first, above Cretan dittany.
- By comparison, changing the risk weights moves the ranking much less: under 1,000 random weightings the top 10 holds 84% of the time on average.

**Cretan dittany ranks first as published** (risk score 0.62, range 0.48–0.71).
- Its identification is certain.
- Under moderate emissions its climate range changes by a median of −58% by 2050 (−81% to −24% across three climate models).
- Only one ~17 km² cell of farmland (0–210 km²) could grow it instead.

**The live website** (https://materia-medica-2050.vercel.app) includes:
- an **Identification** page showing each disputed plant's rank under every rival species, with its source;
- a **page for every plant**, with Dioscorides' Greek text and page scan, a Then/Now map, the risk breakdown and the model's quality grade;
- an **action plan** that sorts plants into protect and cultivate, protect only, cultivation opportunity and monitor;
- a **grower finder** for any ~10 km cell or farming region;
- a **risk weight lab**, where anyone can change the weights and watch the ranking move;
- a **names timeline** of 115 identification claims from 1530 to 2021;
- a **60-second path for judges** on the home page.

## How we built it

- **From text to species.** We started from Wellmann's public-domain Greek edition (1906–1914). Each plant is matched to a modern species from published identifications (Sprengel 1830, Fraas 1845, Osbaldeston 2000 and others) and rated certain, probable or disputed. Every rival identification is stored with its citation.
- **Plant records.** We used one GBIF download of 933,943 vascular-plant records (doi:10.15468/dl.4u6k8n), cleaned and thinned to one record per ~1 km. The same download serves as a target-group background, so the models learn climate rather than where botanists walk.
- **Climate and terrain.** WorldClim 2.1 and CMIP6 at 2.5′ (~4.6 km) for 2041–2060, under three climate models and two emission scenarios, plus Copernicus DEM elevation and slope.
- **Models.** MaxEnt and random forest for each plant.
  - Tested with 5-fold spatially blocked cross-validation (~25 km blocks).
  - Compared with a null model and with a **distance-only baseline**, which scores places by how close they are to known records.
  - Each model is graded: standard, low or data gap.
- **Risk and cultivation.**
  - The risk score is weighted 0.4 range loss, 0.2 endemism, 0.2 conservation status and 0.2 harvest access. We stress-tested it under 1,000 random weightings.
  - A place counts as a cultivation zone if it is farmland suitable in 2050, outside Natura 2000 and at least 5 km from wild populations.
- **Identification sensitivity.** Every rival species goes through the same pipeline unchanged, and all 32 plants are re-ranked once per alternative.
- **Stack.**
  - A seeded, cached Python pipeline (rasterio, scikit-learn, elapid, geopandas) with tests; `make all` rebuilds every result from the raw data.
  - A static Astro, React and MapLibre website on Vercel, which only displays the pipeline's exports, checked against JSON Schemas.

## Challenges we ran into

- **Which plant did Dioscorides mean?** A Greek name is not a species, and 9 of our 32 identifications are disputed. Instead of hiding the dispute, we modelled every rival species named in our sources and measured how much it moves the ranking. That turned out to be our main finding.
- **Rival species that barely exist in Greece.** 16 of the 35 rival species have fewer than 10 records in Greece; *Origanum syriacum*, for example, has none. We list them as data gaps rather than force a model, and the absence is itself evidence against those identifications.
- **A humbling baseline.** For narrow endemics, being near known records predicts held-out records almost as well as climate does. Dittany's model beats the distance-only baseline by only 0.002 AUC (0.961 vs 0.959). We report this openly and treat its maps as hypotheses.
- **Sampling bias.** Plant records cluster near roads and famous mountains. We drew the model background from the same survey effort and thinned the records.
- **Harvest pressure is hard to measure.** Our road-access proxy saturates in Greece's dense road network (0.86 to 0.99 across plants), so it barely separates them. We say so and let the weight lab show it.
- **Licences and privacy.** WorldClim rasters can't be redistributed, so we publish only our own model outputs. Rare plants are shown only as ~10 km cells, so the site can't become a map for collectors.

## Accomplishments that we're proud of

- **A quantified answer to an old question.** As far as we know, this is the first analysis to measure how the identification of historical medicinal plants changes conservation priorities: 5 of 32 plants move in or out of the top 10.
- **Uncertainty on every number.** Every risk score, range change, rank and cultivation area shows its interval, and every disputed identification carries a badge.
- **Honest validation.** 29 of 32 models beat the distance-only baseline and 19 of 32 are standard grade. Where a model only just passes, we say so.
- **From ranking to action.** The action plan and grower finder turn model output into something a conservation agency or a cooperative can use.
- **Reproducible end to end.** One command rebuilds every number from a cited GBIF download. The deck and README read their numbers from the same output files.

## What we learned

- **A model is only as good as the name behind it.** Ethnopharmacology and climate science meet at taxonomy, and an uncertain name can move a plant's priority more than the choice of climate model or risk weights.
- **The future is split, not uniformly bleak.** 11 of 32 plants lose habitat under all three climate models, while 21 keep or gain climate space. Those gains assume the plants can reach the new areas.
- **Baselines keep you honest.** A high AUC can mostly reflect distance to known records; comparing against a simple baseline showed us where the climate signal is weak.
- **Showing a weak signal is better than hiding it.** Reporting what our data can't separate tells readers exactly which data would improve the results.

## What's next for Materia Medica 2050

- **Expert review** of the disputed identifications, with botanists and classicists, starting with the plants whose top-10 place depends on the name (hyssop, Cretan mountain tea, prickly juniper, St John's wort and the peony).
- **Splitting the pooled taxa**, such as the Greek peonies, as more records become available.
- **Testing the cultivation zones** with collectors' cooperatives in Crete, with consent and shared benefit.
- **Measured harvest data**, such as permits and trade volumes, to replace the road-access proxy.
- **Extending the work to Cyprus and Anatolia**, and to other historical plant lists; the pipeline works for any region.

**Data sources and attribution** (full terms in `DATA_LICENSES.md` in the repository):
- **Occurrences:** GBIF.org (3 November 2026) GBIF Occurrence Download, https://doi.org/10.15468/dl.4u6k8n
- **Climate:** WorldClim 2.1 and CMIP6 (Fick & Hijmans 2017). No WorldClim rasters are redistributed.
- **Elevation:** Copernicus DEM GLO-90; produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved
- **Land cover:** CORINE Land Cover 2018, Copernicus Land Monitoring Service (EEA).
- **Protected areas:** Natura 2000, European Environment Agency (CC BY 4.0).
- **Roads and settlements:** © OpenStreetMap contributors (ODbL), via Geofabrik.
- **Conservation status:** IUCN Red List of Threatened Species; Dimopoulos et al. 2013, Vascular plants of Greece checklist.
- **Modern use:** European Medicines Agency herbal monographs (EMA/HMPC).
- **Text:** Wellmann (ed.), *De materia medica*, 1906–1914 (public domain).
- **Identifications:** Sprengel 1830, Fraas 1845, Osbaldeston 2000 and others, cited for each plant.
- **Photos:** Wikimedia Commons, CC0, public domain, CC BY or CC BY-SA, with the photographer and licence credited under every photo.
- **Basemap:** Natural Earth (public domain).

**Team:** Soujanya Chatti and DurgaPritam.

**Limitations and assumptions:**
- Range gains assume unlimited dispersal.
- 2.5′ climate cells are coarse.
- Five plants are modelled as pooled species groups.
- IUCN status is global only.
- The 5 km rule leaves 16 of 32 plants with no cultivation area.
- For rival identifications we keep the published plant's endemism and status.

This is a research prototype and not medical advice. We make no health claims and publish no exact plant locations.

**Links:**
- Live site: https://materia-medica-2050.vercel.app
- Video: https://www.youtube.com/watch?v=ZBNGBJ5rhTk
- Code, data and deck: https://github.com/SoujanyaChatti/Materia-Medica-2050
