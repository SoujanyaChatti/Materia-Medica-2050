## Materia Medica 2050

**We model how the plants that founded pharmacy fare by 2050, and how uncertain their ancient identities are.**

**Headline finding:** which plant Dioscorides actually meant moves **5 of 32 plants in or out of the top 10** of our 2050 risk ranking. Nine of our plants have disputed identifications. When we model each of them as the rival species named in the scholarship we cite, hyssop can fall from rank 2 to rank 19. Modelled as *Paeonia peregrina*, the peony would rank first, above Cretan dittany. Four of the five disputed plants in the top 10 can drop out of it.

- Live site: https://materia-medica-2050.vercel.app
- Pitch video: https://www.youtube.com/watch?v=ZBNGBJ5rhTk
- Code, data and deck: https://github.com/SoujanyaChatti/Materia-Medica-2050

## Problem

Dioscorides' *De Materia Medica* (1st century CE) described about six hundred medicinal plants and shaped European pharmacy for some fifteen hundred years. Many of those plants still grow wild in Greece, where they face climate change, wild collection and habitat loss at once. A recent review of 148 studies of Greek medicinal and aromatic plants concludes that "threats from climate and land-use change remain significant" (Solomou et al. 2026, *Diversity* 18:56).

Conservation money is limited, so someone has to decide which plants come first. Those decisions rarely link a plant to its history or say how uncertain the evidence is. A further problem is usually ignored: matching an ancient Greek name to a modern species is itself an interpretation, and scholars have disagreed about many of these names since the Renaissance.

## Data

All inputs are open and cited:
- **Text:** Wellmann's public-domain Greek edition (1906–1914).
- **Identifications:** 115 dated claims and 35 rival species from Sprengel 1830, Fraas 1845, Osbaldeston 2000 and others, each with its source.
- **Plant records:** one GBIF download of 933,943 vascular-plant records (doi:10.15468/dl.4u6k8n).
- **Climate and terrain:** WorldClim 2.1 and CMIP6 at 2.5′, with three climate models × two emission scenarios for 2041–2060; Copernicus DEM elevation and slope.
- **Land:** CORINE land cover, Natura 2000, OpenStreetMap roads and settlements.
- **Status and use:** IUCN Red List categories and European Medicines Agency herbal monographs.

## Method

1. **Plants.** 32 plants that grow wild in Greece, each identification rated certain, probable or disputed.
2. **Records.** GBIF records are cleaned and thinned to one per ~1 km. The same download serves as a target-group background, so the models learn climate rather than survey effort.
3. **Models.** MaxEnt and random forest for each plant, tested with 5-fold spatially blocked cross-validation and compared with a null model and with a **distance-only baseline**. Each model gets a grade: standard, low or data gap.
4. **Risk score.** Range loss, endemism, conservation status and harvest access, stress-tested under 1,000 random weightings.
5. **Cultivation zones.** Farmland suitable in 2050, outside Natura 2000 and at least 5 km from wild populations.
6. **Identification sensitivity (new).** Every rival species named in our sources goes through the same pipeline, and all 32 plants are re-ranked once per alternative.

One command (`make all`) rebuilds everything from the raw data, with tests and a schema-checked data contract between the pipeline and the website.

## Prototype

The public website covers all 32 plants:
- **Identification page:** each disputed plant's rank under every rival identification, with the rank range across climate models and the source.
- **Plant pages:** Dioscorides' Greek text with the page scan, a Then/Now map, the risk breakdown, the model grade against the baseline, and a suggested action.
- **Action plan:** sorts plants into protect and cultivate, protect only, cultivation opportunity and monitor.
- **Grower finder:** for any ~10 km cell or farming region.
- **Risk weight lab:** re-weight the score and watch the ranking change.
- **Names timeline:** 115 identification claims, 1530–2021.

The home page includes a 60-second path for judges.

## Results

- **Identification moves the ranking.** 5 of 32 plants move in or out of the top 10 across the 19 rival species we could model. Another 16 rival species have fewer than 10 records in Greece, which is itself evidence against them (*Origanum syriacum*, for example, has none).
- **Weights move it much less.** Under 1,000 random weightings, the top 10 holds 84% of the time on average.
- **Cretan dittany ranks first** (risk score 0.62, range 0.48–0.71).
  - Its identification is certain.
  - Under moderate emissions its climate range changes by a median of −58% by 2050 (−81% to −24% across three climate models), and by −65% under high emissions.
  - Only one ~17 km² farmland cell (0–210 km²) could grow it instead.
- **A split future.** 11 of 32 plants lose habitat under all three climate models; the other 21 keep or gain climate space.
- **Honest validation.**
  - 29 of 32 models beat the distance-only baseline, and 19 of 32 are standard grade.
  - Dittany beats the baseline only narrowly (AUC 0.961 vs 0.959), so its maps are hypotheses.

## Impact

- **Conservation agencies** get a ranked list in which every number has its range, and in which the plants whose priority depends on an unresolved name are flagged. Those plants need botanical and philological review before money is spent.
- **Growers and cooperatives** get a grower finder that could take collection pressure off wild stands.
- **Researchers** get an open, reproducible pipeline that works for any region and any historical plant list.
- **Ethnopharmacology** gains a quantified case that the identification of historical plants is itself a source of uncertainty in conservation and drug-discovery work.

**Next:**
- expert review of the disputed identifications;
- splitting the pooled taxa;
- testing the cultivation zones with collectors' cooperatives in Crete;
- extending the work to Cyprus and Anatolia.

## Limitations

- Range gains assume unlimited dispersal.
- 2.5′ climate cells (~4.6 km) are coarse.
- Five plants are modelled as pooled species groups.
- IUCN status is global only.
- The 5 km rule leaves 16 of 32 plants with no cultivation area.
- Harvest pressure is a road-access proxy that barely separates plants.
- For rival identifications, we keep the published plant's endemism and conservation status.

This is a research prototype and not medical advice. We make no health claims, and we publish no exact plant locations, only ~10 km cells.
