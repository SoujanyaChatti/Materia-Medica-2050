## Inspiration

Two thousand years ago, the Greek physician Pedanius Dioscorides wrote down about six hundred medicinal plants in *De Materia Medica*. The book was copied, translated and used for some fifteen hundred years, and it is the root of Western pharmacy. Many of its plants still grow wild in Greece.

Those plants now face three pressures at once:
- the Mediterranean is warming faster than the global average;
- many species are still collected from the wild;
- their habitat is being converted.

Conservation money is limited, so someone has to decide which plants come first. Today that decision is usually made one species at a time, without linking a plant back to its history, and without saying how uncertain the evidence is.

We asked a simple question: **by 2050, which of Dioscorides' plants are we most likely to lose, and where could we grow them instead?** We wanted the answer to be a ranked, open and honest list that starts from the ancient text and ends with an action someone can take.

## What it does

Materia Medica 2050 models **32 Dioscoridean plants that grow wild in Greece** and answers three questions for each one.

1. **How much at risk is it by 2050?** A risk score combines climate-driven range loss, endemism, conservation status and harvest pressure.
2. **Where could it be grown instead?** We look for farmland that suits the plant in 2050, lies outside Natura 2000 protected areas and is at least 5 km from wild populations, so farms never compete with the wild stands they are meant to protect.
3. **How sure are we?** Every number shows its range across three climate models and two emission scenarios. Every plant shows how certain its identification is: *certain*, *probable* or *disputed*.

**Main results**
- **Cretan dittany (δίκταμνον) ranks first.**
  - Its identification is certain and it grows only on Crete.
  - Under moderate emissions it loses a median of **58%** of its climate range by 2050: between 24% and 81% depending on the climate model, and 65% under high emissions.
  - We found only **one ~17 km² cell** of farmland that could grow it instead, so it needs protection in the wild.
- **A split future.** 11 of the 32 plants lose wild habitat under all three climate models. The other 21 keep or gain climate space, but those gains are best-case, because they assume the plant can reach every new location.
- **The history of a name matters as much as the climate.** If we drop the 9 plants whose ancient identification is disputed, only half of the top 10 stays the same.
- **The ranking holds up to different weightings.** Under 1,000 random weightings, the top 10 holds 84% of the time on average.

**The public website** covers all 32 plants:
- **A page for every plant.** It shows:
  - Dioscorides' Greek text, with a link to the page scan of the 1906 edition;
  - a Then/Now map with a scenario toggle;
  - the risk breakdown and model quality;
  - a suggested action;
  - five centuries of scholars' identifications.
- **An action plan.** It sorts every plant into four groups: protect and cultivate (6), protect with no farmland fallback (5), cultivation opportunity (10) and monitor (11).
- **A grower finder.** Pick a ~10 km cell or a farming region to see which plants its 2050 climate could support. The list flags plants that are shrinking in the wild and plants with an EU herbal monograph (a sign that a regulated market exists). You can download the list as a CSV.
- **A risk weight lab.** Anyone who disagrees with our weights can change them and watch the ranking update live.
- **Names through time.** 115 dated identification claims from 1530 to 2021.

## How we built it

- **From text to species.** We started from Wellmann's public-domain Greek edition of *De Materia Medica*. We matched each plant to a modern species using published scholarly identifications, and tagged each match as certain, probable or disputed, with its source.
- **Where the plants grow today.** We used one GBIF download of 933,943 records of vascular plants in the region (doi:10.15468/dl.4u6k8n). We cleaned it, removed duplicates and thinned it to about 1 km. We also used this download as a "target-group background", so the models learn climate rather than where botanists like to walk.
- **Climate and terrain.** We used WorldClim 2.1 and CMIP6 data at 2.5 arc-minutes for today and for 2041–2060, under three climate models and two emission scenarios (SSP2-4.5 and SSP5-8.5), together with elevation and slope from the Copernicus DEM.
- **Models.**
  - We fitted two types per plant: MaxEnt and random forest.
  - We tested them with 5-fold spatially blocked cross-validation, so each model is scored on regions it never saw, and compared them with a null model.
  - Cretan dittany, for example, scores an AUC of 0.96, against 0.49 for the null model.
- **Risk.** The score weights range loss 0.4 and endemism, conservation status (IUCN or national checklist) and a harvest proxy built from OpenStreetMap 0.2 each. We stress-tested the ranking under 1,000 random weightings, with and without the disputed identifications.
- **Cultivation.** Candidate land is suitable in 2050 under the majority of climate models, is CORINE farmland, lies outside Natura 2000 and is at least 5 km from wild records.
- **Stack.**
  - A seeded, cached Python 3.11 pipeline (rasterio, scikit-learn, elapid, geopandas) with tests. One command, `make all`, rebuilds every result from the raw data.
  - A static website built with Astro, React, MapLibre and Tailwind, deployed on Vercel. It only displays the pipeline's exports, which are checked against JSON Schemas.

## Challenges we ran into

- **Which plant did Dioscorides mean?** A Greek name is not a species. Scholars have disagreed for five centuries, and 9 of our 32 identifications are disputed. Instead of hiding that, we model the best-supported plant, flag the dispute everywhere, and measure how much it moves the ranking.
- **Sampling bias.** Plant records cluster near roads, trails and famous mountains. A random background would have taught the models where people walk, so we drew the background from the same survey effort and thinned the records.
- **Harvest pressure is hard to measure.** No national dataset of wild collection exists. Our proxy is the share of a plant's range within 2 km of a road or settlement. Greece's road network is so dense that this proxy saturates, ranging only from 0.86 to 0.99, so it barely separates plants. We kept it, say so openly, and built the weight lab so anyone can see how little it moves the ranking.
- **Licences.** WorldClim does not allow its rasters to be redistributed, so we publish only our own model outputs and the code to rebuild everything.
- **Rare plants and privacy.** A precise map of an over-collected endemic plant works as a shopping list for collectors. Everything public is aggregated to ~10 km cells, and no exact location is ever published.

## Accomplishments that we're proud of

- **Uncertainty on every number.** Every range change, score, rank and cultivation area shows its interval, and every disputed identification carries a badge.
- **An unexpected finding.** Uncertainty about the history of a plant's name changes the ranking as much as the choice of climate model does.
- **From ranking to action.** The action plan and grower finder turn model output into something a conservation agency, a cooperative or an agricultural extension service can use.
- **Reproducible end to end.** Every result can be rebuilt with one command from a cited GBIF download, with tests and a validated data contract between the pipeline and the website.
- **History anyone can check.** Every plant links to Dioscorides' own words, the scanned page, and who identified the plant and on what evidence.

## What we learned

- **The future is split, not uniformly bleak.** The typical plant may even gain climate space. The plants that lose are the narrow endemics and the ones with nowhere to go.
- **A model is only as good as the name behind it.** Ethnopharmacology and climate science meet at taxonomy, and an uncertain name makes the whole analysis uncertain.
- **An honest weak signal beats an invented strong one.** Showing that harvest pressure barely separates the plants tells readers exactly which data would improve the results.
- **Design is part of the science.** Hatching for lost habitat, hollow markers for unresolved data, ranges in brackets: how a result is drawn decides whether a reader trusts it too much.

## What's next for Materia Medica 2050

- **Expert review** of the disputed identifications, working with botanists on the Flora of Greece.
- **Splitting the species we had to pool**, such as the Greek peonies, as more records become available.
- **Testing the cultivation zones** with collectors' cooperatives in Crete, with consent and shared benefit.
- **Measured harvest data**, such as collection permits and trade volumes, to replace the access proxy.
- **Extending the work to Cyprus and Anatolia**, where many of Dioscorides' plants also grow. The pipeline works for any region and any plant list.

**Responsible research**
- This is a research prototype and not medical advice. We make no health claims: modern use is quoted only as the European Medicines Agency labels it.
- Our source is a published classical text. We collected no knowledge from living communities.
- AI assistants helped with code and with gathering sources. Every identification links to its source and page scan so that anyone can check it.

**Links**
- Live site: https://materia-medica-2050.vercel.app
- Code: https://github.com/SoujanyaChatti/Materia-Medica-2050
