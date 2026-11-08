# Limitations

Results are hypotheses for conservation planning, not prescriptions. The same list appears on the website's `/methods` page.

1. **Sampling bias.** GBIF records cluster near roads, trails and well-known mountains. Target-group background sampling and ~1 km thinning reduce but do not remove this.
2. **Harvest pressure is a proxy.** It is the share of each species' current range within 2 km of roads or settlements (OpenStreetMap), plus a documented wild-harvest flag — accessibility, not measured collection. It carries the widest intervals of the four risk components, and in Greece's dense road network it saturates: it spans only 0.86–0.99 across the 32 species, so it barely separates them and its weight hardly moves the ranking (see the risk weight lab on `/plants`). Measured collection data (permits, trade volumes) would fix this.
3. **Suitability is not presence.** Correlative models assume species are in equilibrium with climate and ignore dispersal, soils, grazing and biotic interactions. A cell suitable in 2050 may never be colonised.
4. **Identification is interpretation.** Matching an ancient name to a modern species is a scholarly inference; some are contested. "Disputed" plants may describe the wrong taxon entirely. Rankings are reported with and without them.
5. **Coarse public grid.** Occurrences are published only as ~10 km cells to protect rare and over-harvested plants. This hides microrefugia such as gorges and north-facing slopes.
6. **Climate uncertainty.** Range change is reported as the median and min–max across ≥ 3 climate models and two scenarios (SSP2-4.5, SSP5-8.5); the spread is often wide.
7. **No health claims.** Modern use is quoted only from EMA monographs, labelled as EMA labels it. The project makes no statement about the safety or effect of any plant or preparation.
8. **Action rules are thresholds, not optimisation.** The `/act` decision matrix uses two published outputs (does habitat shrink under all 3 climate models; is there a 2050 cultivation zone). The grower finder lists climate suitability on farmland only; soil, water, markets and permits need local checks. Cultivation zones are exported for SSP2-4.5 only.
9. **Identification dates are approximate.** The `/names` timeline dates each authority by their main herbal or commentary, to order the timeline; a claim reported second-hand ("cited by Sprengel") is shown with its witness.
