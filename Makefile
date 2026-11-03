# Dioscorides' Plants, Then and Now — reproducible build
# `make all` rebuilds every output from raw downloads.
# Every stage is idempotent and cached: it skips work whose outputs exist.
# Set FORCE=1 to recompute.

PY      ?= python
STAGES  := pipeline
SITE    := site
export FORCE

.PHONY: help env data species occurrences environment models risk cultivation web site sample test all clean

help:
	@echo "make env      create the conda env from environment.yml"
	@echo "make data     species list, GBIF occurrences, climate + terrain layers"
	@echo "make models   species distribution models + spatially blocked CV"
	@echo "make risk     risk score, sensitivity analysis, cultivation suitability"
	@echo "make web      export site/public/data (validated against site/schema)"
	@echo "make site     build the static website into site/dist"
	@echo "make sample   write clearly labelled SAMPLE data for the site (no pipeline needed)"
	@echo "make test     run pytest"
	@echo "make all      everything above, from raw downloads"

env:
	conda env create -f environment.yml || conda env update -f environment.yml

species:
	$(PY) $(STAGES)/01_species.py
occurrences: species
	$(PY) $(STAGES)/02_occurrences.py
environment:
	$(PY) $(STAGES)/03_environment.py
data: species occurrences environment

models: data
	$(PY) $(STAGES)/04_models.py

risk: models
	$(PY) $(STAGES)/05_risk.py
cultivation: models
	$(PY) $(STAGES)/06_cultivation.py

web: risk cultivation
	$(PY) $(STAGES)/07_export_web.py

site:
	cd $(SITE) && npm ci && npm run build

sample:
	cd $(SITE) && npm ci && npm run data:sample

test:
	$(PY) -m pytest -q

all: web test site

clean:
	rm -rf data/processed/* outputs/metrics/*.json outputs/rasters outputs/models
