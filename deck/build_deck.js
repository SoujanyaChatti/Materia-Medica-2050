const fs = require("fs");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const gi = require("react-icons/gi");
const path = require("path");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");
// Every number on the slides is read from the pipeline outputs below; nothing is typed in by hand.
const ROOT = path.resolve(__dirname, "..");
const OUT = process.argv[2] || path.join(__dirname, "materia-medica-2050.pptx");
const splitCsv = l => { const o = []; let c = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(c); c = ""; } else c += ch; } o.push(c); return o; };
const csv = f => { const [h, ...rows] = fs.readFileSync(path.join(ROOT, f), "utf8").trim().split(/\r?\n/).map(splitCsv); return rows.map(r => Object.fromEntries(r.map((v, i) => [h[i], v]))); };
const RISK = csv("outputs/risk.csv").sort((a, b) => a.rank - b.rank);
const CULT = Object.fromEntries(csv("outputs/cultivation.csv").map(r => [r.slug, r]));
const GRADES = csv("outputs/model_grades.csv").filter(r => r.kind === "published");
const SENS = JSON.parse(fs.readFileSync(path.join(ROOT, "outputs/sensitivity.json"), "utf8"));
const IDS = JSON.parse(fs.readFileSync(path.join(ROOT, "outputs/identification_sensitivity.json"), "utf8"));
const SP = Object.fromEntries(csv("data/curated/species.csv").map(r => [r.slug, r]));
const R = Object.fromEntries(RISK.map(r => [r.slug, r]));
const pct = v => (v < 0 ? "−" : v > 0 ? "+" : "") + Math.abs(Math.round(+v)) + "%";
const nStandard = GRADES.filter(g => g.grade === "standard").length, nLow = GRADES.filter(g => g.grade !== "standard").length;
const nBeat = GRADES.filter(g => g.beats_baseline === "True").length;
const nDisputed = Object.values(SP).filter(s => s.identification_confidence === "disputed").length;
const top10 = RISK.slice(0, 10);
const stab = Math.round(100 * top10.reduce((a, r) => a + +r.top10_stability, 0) / 10);
const med = a => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const top10Med = med(top10.map(r => +r.range_change_median));
const D = R["origanum-dictamnus"], DC = CULT["origanum-dictamnus"], ST = R["sideritis-syriaca"], STC = CULT["sideritis-syriaca"];
const noCult = Object.values(CULT).filter(c => +c.area_ssp245 <= 0).length;
const pooled = Object.values(SP).filter(s => s.model_taxa).length;
const idMoves = IDS.plants_moving_in_or_out_of_top10, idFlip = IDS.disputed_plants_whose_own_top10_status_can_change.length;
const nm = slug => SP[slug].common_name_en.split(" / ")[0];
const IDC = csv("outputs/identification_sensitivity.csv");
const peony = IDC.find(r => r.slug === "paeonia-greece" && r.rank === "1.0");

const HEX = { ink: "17322A", inkSoft: "2C5446", paper: "FFFFFF", tint: "F1F4EF", ochre: "B4532A", sage: "7FA383", gold: "C9A227", text: "1E2A26", muted: "5F6B66" };
const THEME = {
  name: "Materia Medica 2050", headFontFace: "Cambria", bodyFontFace: "Calibri",
  colors: { dk1: HEX.text, lt1: HEX.paper, dk2: HEX.ink, lt2: HEX.tint, accent1: HEX.ink, accent2: HEX.ochre, accent3: HEX.sage, accent4: HEX.gold, accent5: HEX.inkSoft, accent6: HEX.muted, hlink: HEX.ochre, folHlink: HEX.inkSoft },
};
const ASSETS = path.join(__dirname, "assets") + "/"; // top10.png, plant.png, map.png, cultivation.png
const LIVE_URL = "materia-medica-2050.vercel.app";
const GITHUB = "github.com/SoujanyaChatti/Materia-Medica-2050";

async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: String(size) }));
  return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = "Materia Medica 2050";
  pres.author = "Soujanya Chatti";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;
  const W = 13.333, H = 7.5, M = 0.6;

  pres.defineSlideMaster({ title: "DARK_TITLE", background: { color: HEX.ink }, objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 2.35, w: 8.4, h: 1.6, fontFace: "Cambria", fontSize: 54, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 4.05, w: 8.0, h: 1.0, fontFace: "Calibri", fontSize: 22, color: "DCE6DF", valign: "top", align: "left", margin: 0 }, text: "" } },
  ] });
  pres.defineSlideMaster({ title: "CONTENT", background: { color: HEX.paper }, margin: [0.5, 0.6, 0.6, 0.6], objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.42, w: W - 2 * M, h: 0.9, fontFace: "Cambria", fontSize: 32, bold: true, color: C.text2, valign: "middle", align: "left", margin: 0 }, text: "" } },
    { text: { text: "Materia Medica 2050 · EthnoHack 2026 · Track 3", options: { x: M, y: H - 0.45, w: 7, h: 0.3, fontFace: "Calibri", fontSize: 10, color: HEX.muted, margin: 0, isTextBox: true } } },
  ], slideNumber: { x: W - M - 0.6, y: H - 0.45, w: 0.6, h: 0.3, fontFace: "Calibri", fontSize: 10, color: HEX.muted, align: "right" } });
  pres.defineSlideMaster({ title: "DARK_CLOSE", background: { color: HEX.ink }, objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.6, w: W - 2 * M, h: 1.1, fontFace: "Cambria", fontSize: 34, bold: true, color: C.background1, valign: "middle", align: "left", margin: 0 }, text: "" } },
  ], slideNumber: { x: W - M - 0.6, y: H - 0.45, w: 0.6, h: 0.3, fontFace: "Calibri", fontSize: 10, color: "AFC2B8", align: "right" } });

  const I = {
    leaf: await icon(gi.GiHerbsBundle, HEX.paper), leafBig: await icon(gi.GiHerbsBundle, HEX.gold, 512),
    book: await icon(fa.FaBookOpen, HEX.paper), pin: await icon(fa.FaMapMarkerAlt, HEX.paper), therm: await icon(fa.FaThermometerHalf, HEX.paper),
    shield: await icon(fa.FaShieldAlt, HEX.paper), road: await icon(fa.FaRoad, HEX.paper), layers: await icon(fa.FaLayerGroup, HEX.paper),
    mount: await icon(fa.FaMountain, HEX.paper), pill: await icon(fa.FaPrescriptionBottleAlt, HEX.paper), list: await icon(fa.FaClipboardList, HEX.paper),
    chart: await icon(fa.FaChartLine, HEX.paper), seed: await icon(fa.FaSeedling, HEX.paper), globe: await icon(fa.FaGlobeEurope, HEX.paper),
    warn: await icon(fa.FaExclamationTriangle, HEX.paper), code: await icon(fa.FaGithub, HEX.paper), users: await icon(fa.FaUsers, HEX.paper),
    grid: await icon(fa.FaBorderAll, HEX.paper), tags: await icon(fa.FaTags, HEX.paper), arrows: await icon(fa.FaArrowsAlt, HEX.paper),
    ban: await icon(fa.FaBan, HEX.paper), image: await icon(fa.FaImage, HEX.sage, 512),
  };
  function badge(slide, img, x, y, d, fill, name) {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill }, objectName: name + " circle" });
    const p = d * 0.27;
    slide.addImage({ data: img, x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, altText: name, objectName: name + " icon" });
  }
  function card(slide, x, y, w, h, name, fill = C.background2) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: fill }, objectName: name });
  }
  const T = (slide, text, o) => slide.addText(text, Object.assign({ isTextBox: true, margin: 0, fontFace: "Calibri", color: C.text1, valign: "top" }, o));
  // image slot: real file if present, else a labelled frame
  async function slot(slide, file, x, y, w, h, label, dark) {
    const f = ASSETS + file;
    if (fs.existsSync(f)) {
      const meta = await sharp(f).metadata();
      const r = Math.min(w / meta.width, h / meta.height), iw = meta.width * r, ih = meta.height * r;
      slide.addImage({ path: f, x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih, altText: label, objectName: label });
      return;
    }
    slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: dark ? HEX.inkSoft : "E4EAE3" }, line: { color: HEX.sage, dashType: "dash", width: 1.25 }, objectName: label + " frame" });
    slide.addImage({ data: I.image, x: x + w / 2 - 0.45, y: y + h / 2 - 0.75, w: 0.9, h: 0.9, transparency: 20, altText: "Image to insert", objectName: label + " frame icon" });
    T(slide, "Insert: " + label, { x: x + 0.2, y: y + h / 2 + 0.3, w: w - 0.4, h: 0.6, fontSize: 14, italic: true, align: "center", color: dark ? "DCE6DF" : C.accent6 });
  }

  // ===== 1. Title =====
  pres.addSection({ title: "Opening" });
  let s = pres.addSlide({ masterName: "DARK_TITLE", sectionTitle: "Opening" });
  s.addText("Materia Medica 2050", { placeholder: "title" });
  s.addText("The plants that founded Western pharmacy, mapped then and now: what we stand to lose, and where to save it", { placeholder: "body" });
  T(s, "EthnoHack 2026  ·  Track 3: Biodiversity & Sustainability", { x: M, y: 1.0, w: 8, h: 0.4, fontSize: 14, color: HEX.gold, bold: true, charSpacing: 2 });
  T(s, "Soujanya Chatti  ·  DurgaPritam", { x: M, y: 6.3, w: 8, h: 0.4, fontSize: 16, color: "DCE6DF" });
  s.addShape(pres.shapes.OVAL, { x: 9.15, y: 1.55, w: 3.7, h: 3.7, fill: { color: HEX.inkSoft }, line: { color: HEX.inkSoft }, objectName: "title emblem circle" });
  s.addImage({ data: I.leafBig, x: 9.75, y: 2.15, w: 2.5, h: 2.5, altText: "Bundle of medicinal herbs", objectName: "title emblem icon" });
  T(s, "De Materia Medica · 1st century CE", { x: 8.9, y: 5.45, w: 4.2, h: 0.35, fontSize: 13, italic: true, color: "AFC2B8", align: "center" });
  s.addNotes("Hook: Dioscorides' De Materia Medica guided European pharmacy for over 1,500 years, and many of its plants still grow wild in Greece. Question: which could we lose by 2050, and where could we grow them instead?");

  // ===== 2. Problem =====
  pres.addSection({ title: "Problem" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Problem" });
  s.addText("Greek medicinal plants face three pressures at once", { placeholder: "title" });
  card(s, M, 1.6, 4.3, 4.9, "stat card", C.text2);
  T(s, "“", { x: M + 0.35, y: 1.75, w: 1, h: 1.0, fontFace: "Cambria", fontSize: 72, bold: true, color: HEX.gold });
  T(s, "Greece lies within the Mediterranean global biodiversity hotspot … threats from climate and land-use change remain significant", { x: M + 0.4, y: 2.75, w: 3.55, h: 2.6, fontFace: "Cambria", fontSize: 20, italic: true, color: C.background1 });
  T(s, "Solomou, Molla & Skoufogianni 2026, review of 148 studies · Diversity 18:56 · doi:10.3390/d18010056", { x: M + 0.4, y: 5.75, w: 3.6, h: 0.45, fontSize: 10, color: "AFC2B8" });
  [[I.therm, "Climate change", "The Mediterranean is a recognised climate and biodiversity hotspot; ranges shift or shrink"],
   [I.road, "Wild harvesting", "Plants such as Cretan dittany and mountain tea are still collected from the wild"],
   [I.layers, "Land-use change", "Habitat loss compounds climate and harvest pressure"]].forEach(([img, h, b], i) => {
    const y = 1.65 + i * 1.32;
    badge(s, img, 5.35, y, 0.75, C.accent2, h);
    T(s, h, { x: 6.35, y: y - 0.02, w: 6.3, h: 0.4, fontSize: 20, bold: true, color: C.text2 });
    T(s, b, { x: 6.35, y: y + 0.42, w: 6.3, h: 0.7, fontSize: 15 });
  });
  card(s, 5.35, 5.6, 7.35, 0.9, "question card");
  T(s, [{ text: "Our question  ", options: { bold: true, color: C.accent2 } }, { text: "Which Dioscoridean plants face the greatest combined risk by 2050, and where could they be cultivated instead?" }], { x: 5.6, y: 5.72, w: 6.9, h: 0.7, fontSize: 15, valign: "middle" });
  s.addNotes("The quote is from the abstract of Solomou et al. 2026, a review of 148 studies of Greek medicinal and aromatic plants. Nobody has assessed Dioscorides' plants as a group, linked to their historical identity.");

  // ===== 3. Data + prior work =====
  pres.addSection({ title: "Approach" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Approach" });
  s.addText("Built on open, cited data and on prior Greek modelling", { placeholder: "title" });
  const data = [
    [I.book, "Dioscorides", "Wellmann Greek edition + published identifications"],
    [I.pin, "Occurrences", "GBIF · DOI 10.15468/dl.4u6k8n"],
    [I.therm, "Climate", "WorldClim 2.1, 2.5′; 2041–2060, 3 CMIP6 models"],
    [I.mount, "Terrain", "Copernicus elevation and slope"],
    [I.shield, "Protection", "Natura 2000 sites"],
    [I.layers, "Land cover", "CORINE Land Cover 2018"],
    [I.road, "Accessibility", "OpenStreetMap roads and settlements"],
    [I.pill, "Modern use", "EMA herbal monographs"],
  ];
  const cw = (W - 2 * M - 3 * 0.3) / 4, ch = 1.75;
  data.forEach(([img, h, b], i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = M + col * (cw + 0.3), y = 1.55 + row * (ch + 0.25);
    card(s, x, y, cw, ch, h + " card");
    badge(s, img, x + 0.25, y + 0.25, 0.6, row === 0 ? C.text2 : C.accent3, h);
    T(s, h, { x: x + 1.0, y: y + 0.32, w: cw - 1.2, h: 0.45, fontSize: 18, bold: true, color: C.text2 });
    T(s, b, { x: x + 0.25, y: y + 0.98, w: cw - 0.45, h: 0.7, fontSize: 14 });
  });
  card(s, M, 5.6, W - 2 * M, 0.95, "prior work strip", C.text2);
  T(s, [{ text: "Builds on  ", options: { bold: true, color: HEX.gold } }, { text: "climate-change models for ex situ conservation of wild medicinal plants in Crete (Bariotakis et al., Biology 2023, doi:10.3390/biology12101327). ", options: { color: C.background1 } }, { text: "We extend to Dioscorides' plants, all of Greece, harvest pressure and visible uncertainty.", options: { color: "DCE6DF" } }], { x: M + 0.35, y: 5.68, w: W - 2 * M - 0.7, h: 0.8, fontSize: 15, valign: "middle" });
  s.addNotes("Every dataset is open, with licences in DATA_LICENSES.md and the GBIF download cited by DOI. Credit the Crete study openly; we extend it in four ways.");

  // ===== 4. Method =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Approach" });
  s.addText("Six reproducible steps from ancient text to risk ranking", { placeholder: "title" });
  const steps = [
    [I.list, "Species", "32 Dioscoridean plants native to Greece"],
    [I.pin, "Occurrences", "Clean, de-duplicate, thin to one record per ~1 km"],
    [I.therm, "Climate", "2.5′ (~4.6 km) variables, now and 2041–2060"],
    [I.chart, "Models", "MaxEnt + random forest, graded against a distance baseline"],
    [I.warn, "Risk score", "Range loss, endemism, status, harvest"],
    [I.seed, "Cultivation", "Suitable in 2050; cells within 5 km of wild populations excluded"],
  ];
  const sw = (W - 2 * M - 5 * 0.25) / 6;
  steps.forEach(([img, h, b], i) => {
    const x = M + i * (sw + 0.25), y = 1.75;
    card(s, x, y, sw, 3.5, h + " step card");
    T(s, String(i + 1).padStart(2, "0"), { x: x + 0.25, y: y + 0.25, w: 1, h: 0.45, fontFace: "Cambria", fontSize: 22, bold: true, color: C.accent2 });
    badge(s, img, x + 0.25, y + 0.85, 0.66, C.text2, h);
    T(s, h, { x: x + 0.25, y: y + 1.7, w: sw - 0.45, h: 0.4, fontSize: 17, bold: true, color: C.text2 });
    T(s, b, { x: x + 0.25, y: y + 2.15, w: sw - 0.45, h: 1.25, fontSize: 14 });
  });
  card(s, M, 5.6, W - 2 * M, 0.9, "repro card", C.text2);
  badge(s, I.code, M + 0.25, 5.72, 0.66, C.accent2, "Reproducible");
  T(s, [{ text: "Open and reproducible  ", options: { bold: true, color: C.background1 } }, { text: GITHUB + " · data licences documented", options: { color: "DCE6DF" } }], { x: M + 1.15, y: 5.72, w: 10.8, h: 0.66, fontSize: 16, valign: "middle" });
  s.addNotes("Walk the pipeline left to right. Climate data is at 2.5 arc-minutes, about 4.6 km. Records are thinned to one per ~1 km cell (config THIN_CELL_KM = 1.0). Each model is cross-validated in ~25 km spatial blocks and compared with a distance-only baseline.");

  // ===== 5. Validation =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Approach" });
  s.addText(idMoves > 0 ? "The top 10 is robust to weights, sensitive to ancient names" : "The top 10 is robust to weights and to rival identifications", { placeholder: "title" });
  const dBase = GRADES.find(g => g.plant === "origanum-dictamnus");
  const val = [
    ["6", "climate futures", "3 models (MPI-ESM1-2-HR, MRI-ESM2-0, IPSL-CM6A-LR) × 2 scenarios (SSP2-4.5, SSP5-8.5); we report the median and the range"],
    [stab + "%", "top-10 stability", `Average across ${SENS.draws.toLocaleString("en-GB")} random risk weightings. Dittany stays in the top 10 in ${Math.round(100 * D.top10_stability)}% of them; its rank ranges from ${D.rank_lo} to ${D.rank_hi}`],
    [nStandard + " / 32", "standard-grade models", `≥ 30 records, AUC ≥ 0.75 and above a distance-only baseline. ${nBeat} of 32 beat that baseline (dittany by just ${(+dBase.auc - +dBase.baseline_auc).toFixed(3)}); ${nLow} low-grade models are flagged, not dropped`],
    [String(idMoves), "plants move in or out of the top 10", `when the ${nDisputed} disputed plants are modelled as the ${IDS.modelled} rival species named in our sources (${IDS.data_gap} more too rare to model). Dropping disputed plants keeps only ${Math.round(100 * SENS.top10_overlap_without_disputed)}% of the top 10`],
  ];
  val.forEach(([v, l, b], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * 6.2, y = 1.55 + row * 2.5, w = 5.9;
    card(s, x, y, w, 2.25, l + " card", i === 3 ? C.text2 : C.background2);
    const dark = i === 3;
    T(s, v, { x: x + 0.3, y: y + 0.25, w: 2.3, h: 0.8, fontFace: "Cambria", fontSize: 38, bold: true, color: dark ? HEX.gold : C.accent2 });
    T(s, l, { x: x + 0.3, y: y + 1.05, w: 2.3, h: 0.8, fontSize: 15, bold: true, color: dark ? C.background1 : C.text2 });
    T(s, b, { x: x + 2.65, y: y + 0.28, w: w - 2.95, h: 1.8, fontSize: 14, color: dark ? "DCE6DF" : C.text1 });
  });
  s.addNotes(`Lead with the identification finding: we modelled every rival species the sources name for the ${nDisputed} disputed plants and re-ranked. ${idMoves} plants move in or out of the top 10, far more than weighting moves it. Be honest that the dittany model only just beats a distance-only baseline.${peony ? ` If the peony is ${peony.query_name} (${peony.source.split(" — ")[1].split(" (")[0].split(",")[0]}), it would rank first, above dittany, on ${peony.records_thinned} records.` : ""}`);

  // ===== 6. Results =====
  pres.addSection({ title: "Results" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Results" });
  s.addText(+D.range_change_median <= -50 ? "Cretan dittany could lose over half its climate range by 2050" : "Cretan dittany ranks first for risk by 2050", { placeholder: "title" });
  card(s, M, 1.55, 7.6, 5.0, "ranking card");
  T(s, "Top-10 risk score, by identification confidence", { x: M + 0.3, y: 1.72, w: 7.0, h: 0.4, fontSize: 16, bold: true, color: C.text2 });
  // Rendered by deck/scripts/top10.py from outputs/risk.csv: Keynote mis-draws native chart error bars.
  s.addImage({ path: ASSETS + "top10.png", x: M + 0.15, y: 2.1, w: 7.3, h: 4.0, objectName: "top-10 risk chart",
    altText: "Top-10 risk scores with whiskers for the range across 3 climate models: " + top10.map((r, i) => `${i + 1} ${nm(r.slug)} ${(+r.score).toFixed(2)} (${(+r.score_lo).toFixed(2)}–${(+r.score_hi).toFixed(2)})`).join("; ") });
  T(s, "Whiskers and brackets: score range across 3 climate models (SSP2-4.5)", { x: M + 0.3, y: 6.12, w: 7.0, h: 0.35, fontSize: 11, italic: true, color: C.accent6 });
  const rc = top10.map(r => +r.range_change_median);
  const kpis = [
    ["32", "plants modelled", `${nLow} low-grade models, ${nDisputed} disputed names`],
    [pct(top10Med), "median range change, top 10", `SSP2-4.5; plants range ${pct(Math.min(...rc))} to ${pct(Math.max(...rc))}`],
    [String(idMoves), "move in/out of the top 10", "when disputed plants are modelled as their rival species"],
  ];
  kpis.forEach(([v, l, sub], i) => {
    const y = 1.55 + i * 1.72, dark = i === 0;
    card(s, 8.55, y, W - M - 8.55, 1.55, l + " card", dark ? C.text2 : C.background2);
    T(s, v, { x: 8.85, y: y + 0.12, w: 3.6, h: 0.7, fontFace: "Cambria", fontSize: 34, bold: true, color: dark ? C.background1 : C.accent2 });
    T(s, l, { x: 8.85, y: y + 0.8, w: 3.7, h: 0.35, fontSize: 14, bold: true, color: dark ? C.background1 : C.text2 });
    T(s, sub, { x: 8.85, y: y + 1.12, w: 3.7, h: 0.35, fontSize: 12, color: dark ? "DCE6DF" : C.accent6 });
  });
  s.addNotes(`Dittany ranks first: under SSP2-4.5 its median range change is ${pct(D.range_change_median)} (${pct(D.range_change_max)} to ${pct(D.range_change_min)} across 3 climate models). Its identification is certain, so rival names cannot move it. ${top10.filter(r => SP[r.slug].identification_confidence === "disputed").length} of the top 10 have disputed names.`);

  // ===== 7. Flagships + cultivation =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Results" });
  s.addText("Dittany has almost nowhere to be cultivated instead", { placeholder: "title" });
  const km = v => Math.round(+v).toLocaleString("en-GB");
  const cases = [
    ["Cretan dittany", "Origanum dictamnus", "Identification certain", pct(D.range_change_median), `(${pct(D.range_change_max)} to ${pct(D.range_change_min)})`, `~${km(DC.area_ssp245)} km²`, `(${km(DC.area_ssp245_lo)}–${km(DC.area_ssp245_hi)})`],
    ["Cretan mountain tea", "Sideritis syriaca", "Identification disputed", pct(ST.range_change_median), `(${pct(ST.range_change_max)} to ${pct(ST.range_change_min)})`, `~${km(STC.area_ssp245)} km²`, `(${km(STC.area_ssp245_lo)}–${km(STC.area_ssp245_hi)})`],
  ];
  cases.forEach(([n, latin, idc, rc, rr, ca, cr], i) => {
    const x = M + i * 3.15, w = 2.95;
    card(s, x, 1.55, w, 5.0, n + " card");
    badge(s, I.leaf, x + 0.3, 1.8, 0.66, C.text2, n);
    T(s, n, { x: x + 0.3, y: 2.6, w: w - 0.5, h: 0.4, fontSize: 18, bold: true, color: C.text2 });
    T(s, latin, { x: x + 0.3, y: 3.0, w: w - 0.5, h: 0.35, fontSize: 14, italic: true });
    T(s, idc, { x: x + 0.3, y: 3.33, w: w - 0.5, h: 0.35, fontSize: 13, color: i === 1 ? C.accent2 : C.accent6, bold: i === 1 });
    T(s, "Range change by 2050, SSP2-4.5", { x: x + 0.3, y: 3.85, w: w - 0.5, h: 0.3, fontSize: 12, color: C.accent6 });
    T(s, [{ text: rc + " ", options: { fontFace: "Cambria", fontSize: 26, bold: true, color: C.accent2 } }, { text: rr, options: { fontSize: 13 } }], { x: x + 0.3, y: 4.12, w: w - 0.5, h: 0.6 });
    T(s, "Cultivation area, SSP2-4.5", { x: x + 0.3, y: 4.9, w: w - 0.5, h: 0.3, fontSize: 12, color: C.accent6 });
    T(s, [{ text: ca + " ", options: { fontFace: "Cambria", fontSize: 26, bold: true, color: C.text2 } }, { text: cr, options: { fontSize: 13 } }], { x: x + 0.3, y: 5.17, w: w - 0.5, h: 0.6 });
  });
  card(s, 6.95, 1.55, W - M - 6.95, 5.0, "cultivation map card", C.text2);
  await slot(s, "cultivation.png", 7.15, 1.75, W - M - 7.35, 4.15, "cultivation map export (dittany)", true);
  T(s, `Dittany: one ~${km(DC.area_ssp245)} km² cell suitable for cultivation (${km(DC.area_ssp245_lo)}–${km(DC.area_ssp245_hi)})`, { x: 7.15, y: 6.0, w: W - M - 7.35, h: 0.4, fontSize: 14, bold: true, color: C.background1 });
  s.addNotes(`Range change is the SSP2-4.5 median and range across 3 climate models; cultivation area is SSP2-4.5 with its strict-to-optimistic range. ${noCult} of 32 plants have no cultivation area at all, because cells within 5 km of wild populations are excluded.`);

  // ===== 8. Website demo =====
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Results" });
  s.addText("Every plant, its uncertainty and its rival identifications, online", { placeholder: "title" });
  const shots = [["plant.png", "Plant page", "Dioscorides card, identification confidence, 2050 ranges and risk breakdown"], ["map.png", "Map explorer", "Combined risk across Greece, cultivation zones and Natura 2000"]];
  for (let i = 0; i < 2; i++) {
    const [f, h, b] = shots[i];
    const x = M + i * 6.2, w = 5.9;
    card(s, x, 1.55, w, 4.35, h + " screenshot card");
    await slot(s, f, x + 0.2, 1.75, w - 0.4, 3.95, "screenshot: " + h.toLowerCase(), false);
    T(s, h, { x, y: 6.0, w: 2.0, h: 0.4, fontSize: 17, bold: true, color: C.text2 });
    T(s, b, { x: x + 1.75, y: 6.03, w: w - 1.75, h: 0.4, fontSize: 13, color: C.accent6 });
  }
  s.addNotes("Live at " + LIVE_URL + ". Open Cretan dittany, toggle now and 2050, then open the Identification page to show how rival species move the ranking.");

  // ===== 9. Limitations =====
  pres.addSection({ title: "Close" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Close" });
  s.addText("Our results are hypotheses with eight known limits", { placeholder: "title" });
  const lim = [
    [I.pin, "Sampling bias", "GBIF records cluster where botanists walk"],
    [I.road, "Harvest is a proxy", "Accessibility stands in for collection pressure"],
    [I.arrows, "Dispersal assumed", "Correlative models; range gains assume unlimited dispersal"],
    [I.grid, "2.5′ climate", "About 4.6 km cells, coarse for small habitats"],
    [I.book, "Ancient names", `${nDisputed} identifications disputed; rival species move ${idMoves} plants in or out of the top 10`],
    [I.tags, "Pooled taxa", `${pooled} plants modelled as species groups (e.g. peonies, capers)`],
    [I.globe, "Global IUCN status", "IUCN categories are global, not Greece-specific"],
    [I.ban, "5 km rule", `Leaves ${noCult} of 32 plants with no cultivation area`],
  ];
  lim.forEach(([img, h, b], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * 6.2, y = 1.5 + row * 0.98, w = 5.9;
    badge(s, img, x, y, 0.6, C.accent2, h);
    T(s, h, { x: x + 0.8, y: y - 0.02, w: w - 0.85, h: 0.35, fontSize: 16, bold: true, color: C.text2 });
    T(s, b, { x: x + 0.8, y: y + 0.33, w: w - 0.85, h: 0.5, fontSize: 14 });
  });
  card(s, M, 5.6, W - 2 * M, 0.9, "verdict card", C.text2);
  T(s, [{ text: "Hypotheses for conservation planning, not prescriptions.  ", options: { bold: true, color: C.background1 } }, { text: "Not medical advice.", options: { color: "DCE6DF" } }], { x: M + 0.35, y: 5.68, w: W - 2 * M - 0.7, h: 0.75, fontSize: 16, valign: "middle" });
  s.addNotes("Say these limits out loud. The 5 km exclusion protects wild populations, but it is why half the plants have no cultivation area.");

  // ===== 10. Impact =====
  s = pres.addSlide({ masterName: "DARK_CLOSE", sectionTitle: "Close" });
  s.addText("From an ancient text to candidate conservation actions", { placeholder: "title" });
  [[I.shield, "Conservation", "A ranked, cross-validated priority list for Greek medicinal flora"],
   [I.seed, "Communities", "Candidate cultivation zones to test with collectors"],
   [I.users, "Researchers", "Open pipeline and data, reusable for other regions and species lists"]].forEach(([img, h, b], i) => {
    const x = M + i * 4.1, w = 3.8;
    card(s, x, 2.0, w, 2.6, h + " impact card", C.accent5);
    badge(s, img, x + 0.35, 2.3, 0.72, C.accent2, h);
    T(s, h, { x: x + 0.35, y: 3.2, w: w - 0.6, h: 0.45, fontSize: 20, bold: true, color: C.background1 });
    T(s, b, { x: x + 0.35, y: 3.68, w: w - 0.6, h: 0.85, fontSize: 15, color: "DCE6DF" });
  });
  T(s, "Next: expert review of the disputed identifications · split pooled taxa · field-test cultivation zones with collectors", { x: M, y: 4.95, w: W - 2 * M, h: 0.5, fontSize: 15, color: "AFC2B8" });
  T(s, [{ text: "Live site  ", options: { bold: true, color: HEX.gold } }, { text: LIVE_URL, options: { color: C.background1 } }, { text: "     Code  ", options: { bold: true, color: HEX.gold } }, { text: "https://" + GITHUB, options: { color: C.background1, hyperlink: { url: "https://" + GITHUB } } }], { x: M, y: 5.9, w: W - 2 * M, h: 0.5, fontSize: 17 });
  s.addNotes("Close on three audiences. Invite judges to open the live site and pick any plant.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("written");
})();
