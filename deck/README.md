# Pitch deck

`build_deck.js` writes the 10-slide deck with pptxgenjs. Every number on the slides is read from the
pipeline outputs (`outputs/risk.csv`, `cultivation.csv`, `model_grades.csv`, `sensitivity.json`,
`identification_sensitivity.json/csv`) and `data/curated/species.csv`.

```bash
python deck/scripts/top10.py outputs/risk.csv data/curated/species.csv deck/assets/top10.png   # slide 6 chart
PPTX_SKILL=<path to the pptx skill> NODE_PATH=<node_modules with pptxgenjs, react, react-dom, react-icons, sharp> \
  node deck/build_deck.js docs/materia-medica-2050.pptx
```

`assets/plant.png` and `assets/map.png` are screenshots of the live site; `assets/cultivation.png` is the
dittany cultivation map of Crete (SSP2-4.5, at least 2 of 3 climate models agree, 2.5′ cells).
The top-10 chart is an image because Keynote mis-draws native chart error bars.
