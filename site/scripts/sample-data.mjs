// Writes clearly labelled SAMPLE data into public/data/ following the data contract
// (site/schema/*.json), so the site can be built and reviewed before the pipeline has run.
// meta.json carries "sample": true and every page shows a "Sample data" banner.
// Nothing here is a result. `make web` (pipeline stage 07) overwrites it with real exports.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'public', 'data');
const WEIGHTS = { range_loss: 0.4, endemism: 0.2, status: 0.2, harvest: 0.2 };
const STATUS = { LC: 0, NT: 0.25, VU: 0.5, EN: 0.75, CR: 1, DD: 0.5, NE: 0.5 };
const DLON = 0.12, DLAT = 0.09; // ≈ 10 km cells at Greek latitudes (sample grid only)

// ---------- deterministic helpers ----------
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry32(20261102);
const noise = (seed) => { const r = mulberry32(seed); const p = Array.from({ length: 6 }, () => [r() * 6, r() * 6, r() * 6.28]); return (x, y) => p.reduce((s, [a, b, c]) => s + Math.sin(a * x + b * y + c), 0) / 6; };
const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;
const write = (p, obj) => { mkdirSync(dirname(join(OUT, p)), { recursive: true }); writeFileSync(join(OUT, p), JSON.stringify(obj)); };

function inRing(x, y, ring) { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; } return ins; }
function onLand(x, y, polys) { return polys.some((poly) => inRing(x, y, poly[0])); }

// ---------- grid over Greek land ----------
const greece = JSON.parse(readFileSync(join(OUT, 'basemap', 'greece.geojson'), 'utf8'));
const polys = greece.features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates));
const cells = [];
for (let iy = Math.floor(34.7 / DLAT); iy * DLAT < 41.8; iy++) {
  for (let ix = Math.floor(19.3 / DLON); ix * DLON < 29.7; ix++) {
    const cx = (ix + 0.5) * DLON, cy = (iy + 0.5) * DLAT;
    if (onLand(cx, cy, polys)) cells.push({ ix, iy, cx, cy, key: `${ix}_${iy}` });
  }
}
const poly = (c) => [[[c.ix * DLON, c.iy * DLAT], [(c.ix + 1) * DLON, c.iy * DLAT], [(c.ix + 1) * DLON, (c.iy + 1) * DLAT], [c.ix * DLON, (c.iy + 1) * DLAT], [c.ix * DLON, c.iy * DLAT]].map(([a, b]) => [r3(a), r3(b)])];
const feat = (c, properties) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: poly(c) }, properties });
const fc = (features) => ({ type: 'FeatureCollection', features });
const cellAreaKm2 = (c) => DLON * 111.32 * Math.cos((c.cy * Math.PI) / 180) * DLAT * 110.574;

// ---------- sample Natura 2000 (circles around well-known mountain sites; NOT real boundaries) ----------
const NATURA = [[22.35, 40.08, 0.28], [24.0, 35.3, 0.25], [20.95, 40.0, 0.35], [22.55, 38.53, 0.2], [22.35, 36.95, 0.2], [24.8, 35.2, 0.2], [25.5, 35.1, 0.15], [24.5, 41.4, 0.3], [21.1, 40.75, 0.18], [23.0, 39.4, 0.15]];
const isNatura = (c) => NATURA.some(([x, y, r]) => Math.hypot((c.cx - x) * Math.cos((y * Math.PI) / 180), c.cy - y) < r);
const naturaSet = new Set(cells.filter(isNatura).map((c) => c.key));
function outline(keySet) {
  const lines = [];
  for (const c of cells) {
    if (!keySet.has(c.key)) continue;
    const x0 = c.ix * DLON, y0 = c.iy * DLAT, x1 = x0 + DLON, y1 = y0 + DLAT;
    if (!keySet.has(`${c.ix}_${c.iy - 1}`)) lines.push([[x0, y0], [x1, y0]]);
    if (!keySet.has(`${c.ix}_${c.iy + 1}`)) lines.push([[x0, y1], [x1, y1]]);
    if (!keySet.has(`${c.ix - 1}_${c.iy}`)) lines.push([[x0, y0], [x0, y1]]);
    if (!keySet.has(`${c.ix + 1}_${c.iy}`)) lines.push([[x1, y0], [x1, y1]]);
  }
  return fc([{ type: 'Feature', properties: { sample: true }, geometry: { type: 'MultiLineString', coordinates: lines.map((l) => l.map(([a, b]) => [r3(a), r3(b)])) } }]);
}

// ---------- species (illustrative values from the design review) ----------
const PLANTS = [
  { slug: 'origanum-dictamnus', common: 'Cretan dittany', latin: 'Origanum dictamnus L.', family: 'Lamiaceae', greek: 'δίκταμνον', tr: 'diktamnon', book: 3, conf: 'certain', endemic: true, region: 'Crete', st: 'NT', harvest: 1.0, mod: [-44, -27, -63], centre: [24.6, 35.25], r: 0.75, crete: true, auc: [0.91, 0.03], tss: [0.70, 0.06], boyce: 0.78, clean: 58, ema: { exists: false } },
  { slug: 'paeonia-clusii', common: 'Cretan peony', latin: 'Paeonia clusii F.C.Stern', family: 'Paeoniaceae', greek: 'γλυκυσίδη', tr: 'glykysidē', book: 3, conf: 'probable', endemic: true, region: 'Crete, Karpathos', st: 'LC', harvest: 0.4, mod: [-41, -25, -59], centre: [24.3, 35.3], r: 0.7, crete: true, auc: [0.88, 0.04], tss: [0.64, 0.08], boyce: 0.74, clean: 44, ema: null },
  { slug: 'sideritis-syriaca', common: 'Greek mountain tea', latin: 'Sideritis syriaca L.', family: 'Lamiaceae', greek: 'σιδηρῖτις', tr: 'sidēritis', book: 4, conf: 'probable', endemic: false, region: null, st: 'NT', harvest: 0.9, mod: [-38, -22, -55], mod585: [-51, -34, -70], centre: [22.0, 39.6], r: 1.7, auc: [0.86, 0.04], tss: [0.61, 0.07], boyce: 0.71, clean: 214, ema: { exists: true, use: 'traditional use', name: 'Sideritis herba', reference: '[EMA/HMPC reference, year — verify]', url: 'https://www.ema.europa.eu/' }, note: 'The description fits several Sideritis species; S. syriaca is the most frequently proposed.' },
  { slug: 'mandragora-officinarum', common: 'Mandrake', latin: 'Mandragora officinarum L.', family: 'Solanaceae', greek: 'μανδραγόρας', tr: 'mandragoras', book: 4, conf: 'probable', endemic: false, region: null, st: 'DD', harvest: 0.3, mod: [-29, -5, -60], centre: [22.3, 37.3], r: 0.6, auc: [0.71, 0.12], tss: [0.38, 0.15], boyce: 0.42, clean: 11, low: true, ema: null },
  { slug: 'hyssopus-officinalis', common: 'Hyssopos', latin: 'Hyssopus officinalis L.', family: 'Lamiaceae', greek: 'ὕσσωπος', tr: 'hyssōpos', book: 3, conf: 'disputed', endemic: false, region: null, st: 'LC', harvest: 0.3, mod: [-33, -18, -49], centre: [21.6, 40.4], r: 0.9, auc: [0.83, 0.05], tss: [0.57, 0.08], boyce: 0.69, clean: 96, ema: null, alt: { name: 'Origanum syriacum L.', source: '[Source B, year]' } },
  { slug: 'salvia-fruticosa', common: 'Greek sage', latin: 'Salvia fruticosa Mill.', family: 'Lamiaceae', greek: 'ἐλελίσφακον', tr: 'elelisphakon', book: 3, conf: 'probable', endemic: false, region: null, st: 'LC', harvest: 0.6, mod: [-12, -4, -23], centre: [23.2, 37.9], r: 2.2, auc: [0.80, 0.03], tss: [0.52, 0.05], boyce: 0.66, clean: 612, ema: { exists: true, use: 'traditional use', name: 'Salviae trilobae folium', reference: '[EMA/HMPC reference, year — verify]', url: 'https://www.ema.europa.eu/' } },
  { slug: 'thymbra-capitata', common: 'Capitate thyme', latin: 'Thymbra capitata (L.) Cav.', family: 'Lamiaceae', greek: 'θύμος', tr: 'thymos', book: 3, conf: 'probable', endemic: false, region: null, st: 'LC', harvest: 0.5, mod: [-8, 3, -19], centre: [24.4, 37.2], r: 2.4, auc: [0.82, 0.04], tss: [0.55, 0.06], boyce: 0.6, clean: 380, ema: null },
  { slug: 'glaucium-flavum', common: 'Yellow horned poppy', latin: 'Glaucium flavum Crantz', family: 'Papaveraceae', greek: 'μήκων κερατῖτις', tr: 'mēkōn keratitis', book: 4, conf: 'probable', endemic: false, region: null, st: 'LC', harvest: 0.1, mod: [6, -5, 17], centre: [23.6, 38.6], r: 2.6, coastal: true, auc: [0.79, 0.05], tss: [0.5, 0.07], boyce: 0.58, clean: 150, ema: null },
];

// ---------- risk maths (mirror of pipeline/lib/risk.py) ----------
const COMP = ['range_loss', 'endemism', 'status', 'harvest'];
const composite = (c, w = WEIGHTS) => { const s = COMP.reduce((a, k) => a + w[k], 0); return COMP.reduce((a, k) => a + (c[k] * w[k]) / s, 0); };
const rankDesc = (scores) => { const idx = scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]); const r = new Array(scores.length); idx.forEach(([, i], k) => { r[i] = k + 1; }); return r; };
const riskClass = (s) => Math.min(Math.floor(Math.max(0, Math.min(1, s)) / 0.2) + 1, 5);
const kendall = (a, b) => { let s = 0, n = a.length; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) s += Math.sign(a[i] - a[j]) * Math.sign(b[i] - b[j]); return n < 2 ? 1 : s / ((n * (n - 1)) / 2); };
const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.round((p / 100) * (s.length - 1)))]; };
const gamma1 = () => -Math.log(1 - rnd()); // Exp(1) == Gamma(1)

const comps = PLANTS.map((p) => ({ range_loss: Math.min(1, Math.max(0, -p.mod[0] / 100)), endemism: p.endemic ? 1 : 0, status: STATUS[p.st], harvest: p.harvest }));
const scores = comps.map((c) => composite(c));
const ranks = rankDesc(scores);
// random-weight sensitivity: 1,000 Dirichlet(1,1,1,1) draws
const DRAWS = 1000;
const drawRanks = PLANTS.map(() => []);
for (let d = 0; d < DRAWS; d++) {
  const g = COMP.map(gamma1); const s = g.reduce((a, b) => a + b, 0);
  const w = Object.fromEntries(COMP.map((k, i) => [k, g[i] / s]));
  rankDesc(comps.map((c) => composite(c, w))).forEach((r, i) => drawRanks[i].push(r));
}
// one-at-a-time ±50%
const oat = {}; let sameTop = 0, total = 0;
const baseTop = new Set(ranks.map((r, i) => (r <= 3 ? i : -1)).filter((i) => i >= 0));
for (const k of COMP) {
  const taus = [];
  for (let d = 0; d < DRAWS; d++) {
    const f = 0.5 + rnd(); const wk = Math.min(WEIGHTS[k] * f, 1); const rest = 1 - WEIGHTS[k];
    const w = Object.fromEntries(COMP.map((o) => [o, o === k ? wk : (WEIGHTS[o] * (1 - wk)) / rest]));
    const r = rankDesc(comps.map((c) => composite(c, w)));
    taus.push(kendall(ranks, r));
    const top = new Set(r.map((x, i) => (x <= 3 ? i : -1)).filter((i) => i >= 0));
    sameTop += [...baseTop].every((i) => top.has(i)) ? 1 : 0; total++;
  }
  oat[k] = { tau_median: r3(pct(taus, 50)), tau_lo: r3(pct(taus, 5)), tau_hi: r3(pct(taus, 95)) };
}

// ---------- layers ----------
rmSync(join(OUT, 'species'), { recursive: true, force: true });
rmSync(join(OUT, 'layers'), { recursive: true, force: true });
const gridNow = new Map(), gridLoss = { ssp245: new Map(), ssp585: new Map() }, gridCult = { ssp245: new Map(), ssp585: new Map() };
const order = PLANTS.map((p, i) => i).sort((a, b) => ranks[a] - ranks[b]);
const indexOf = new Map(order.map((i, k) => [PLANTS[i].slug, k]));
const summary = [];

PLANTS.forEach((p, i) => {
  const n = noise(1000 + i);
  const [cx, cy] = p.centre;
  const suit = (c) => {
    if (p.crete && c.cy > 35.75) return -1;
    if (!p.crete && p.slug !== 'salvia-fruticosa' && p.slug !== 'thymbra-capitata' && p.slug !== 'glaucium-flavum' && c.cy < 35.75) return -1;
    const d = Math.hypot((c.cx - cx) * Math.cos((cy * Math.PI) / 180), c.cy - cy) / p.r;
    return 1 - d + 0.45 * n(c.cx, c.cy);
  };
  let now = cells.filter((c) => suit(c) > (p.low ? 0.55 : 0.15));
  if (p.coastal) now = now.filter((c) => n(c.cx * 3, c.cy * 3) > -0.1);
  const vul = (c) => -c.cy * 0.6 + 0.8 * n(c.cx * 2 + 9, c.cy * 2) - suit(c) * 0.5; // warmer south & range edge first
  const byVul = [...now].sort((a, b) => vul(b) - vul(a));
  const nowSet = new Set(now.map((c) => c.key));
  const layers = {}; const rangeCells = { now: now.length }; const naturaShare = { now: r1((100 * now.filter((c) => naturaSet.has(c.key)).length) / Math.max(now.length, 1)) };
  const change = { ssp245: p.mod, ssp585: p.mod585 ?? p.mod.map((v) => Math.round(v * 1.3)) };
  for (const ssp of ['ssp245', 'ssp585']) {
    const [med, a, b] = change[ssp];
    const g = 0.06;
    const nLost = Math.round(now.length * (Math.max(0, -med) / 100 + g));
    const nGain = Math.round(now.length * (g + Math.max(0, med) / 100));
    const lost = new Set(byVul.slice(0, nLost).map((c) => c.key));
    const gainedCands = cells.filter((c) => !nowSet.has(c.key) && suit(c) > -0.25).sort((x, y) => (y.cy + 0.3 * suit(y)) - (x.cy + 0.3 * suit(x)));
    const gained = gainedCands.slice(0, nGain);
    const feats = [...now.filter((c) => !lost.has(c.key)).map((c) => feat(c, { change: 'kept' })), ...now.filter((c) => lost.has(c.key)).map((c) => feat(c, { change: 'lost' })), ...gained.map((c) => feat(c, { change: 'gained' }))];
    layers[`range_2050_${ssp}`] = fc(feats);
    for (const c of now) if (lost.has(c.key)) { if (!gridLoss[ssp].has(c.key)) gridLoss[ssp].set(c.key, []); gridLoss[ssp].get(c.key).push(p.slug); }
    rangeCells[ssp] = { median: Math.round(now.length * (1 + med / 100)), min: Math.round(now.length * (1 + a / 100)), max: Math.round(now.length * (1 + b / 100)) };
    naturaShare[ssp] = { median: r1(naturaShare.now + 6), min: r1(naturaShare.now - 2), max: r1(naturaShare.now + 14) };
    // cultivation candidates: outside current range & Natura, within reach of the 2050 range, on 'agricultural' noise
    const agri = noise(77);
    const cult = cells.filter((c) => !nowSet.has(c.key) && !naturaSet.has(c.key) && suit(c) > -0.45 && suit(c) < 0.15 && agri(c.cx * 2, c.cy * 2) > 0.05 && (ssp === 'ssp245' || c.cy > cy - 0.2));
    for (const c of cult) gridCult[ssp].set(c.key, (gridCult[ssp].get(c.key) ?? 0) + 1);
    if (ssp === 'ssp245') { layers.cultivation = fc(cult.map((c) => feat(c, { scenario: ssp }))); p._cultArea = cult.reduce((s, c) => s + cellAreaKm2(c), 0); }
  }
  layers.range_now = fc(now.map((c) => feat(c, { change: 'present' })));
  const occCells = now.filter((c, k) => (p.low ? k % 2 === 0 : n(c.cx * 5, c.cy * 5) > 0.05)).slice(0, p.low ? 11 : undefined);
  layers.occurrences = fc(occCells.map((c) => feat(c, { n_records: 1 + Math.floor(rnd() * 18) })));
  for (const c of now) { if (!gridNow.has(c.key)) gridNow.set(c.key, []); gridNow.get(c.key).push(p.slug); }
  for (const [name, obj] of Object.entries(layers)) write(`layers/${p.slug}/${name}.geojson`, obj);

  const dr = drawRanks[i];
  const rlLo = Math.min(1, Math.max(0, -Math.max(p.mod[1], p.mod[2]) / 100));
  const rlHi = Math.min(1, Math.max(0, -Math.min(p.mod[1], p.mod[2]) / 100));
  const risk = {
    score: r3(scores[i]), score_lo: r3(composite({ ...comps[i], range_loss: rlLo })), score_hi: r3(composite({ ...comps[i], range_loss: rlHi })),
    rank: ranks[i], rank_lo: pct(dr, 5), rank_hi: pct(dr, 95), class: riskClass(scores[i]),
    rank_without_disputed: p.conf === 'disputed' ? null : rankDesc(PLANTS.map((q, j) => (q.conf === 'disputed' ? -1 : scores[j])))[i],
    top10_stability: r3(dr.filter((r) => r <= 10).length / DRAWS),
    components: Object.fromEntries(COMP.map((k) => [k, r3(comps[i][k])])),
    components_ci: { range_loss: [r3(rlLo), r3(rlHi)], harvest: [r3(Math.max(0, p.harvest - 0.15)), r3(Math.min(1, p.harvest + 0.1))] },
  };
  const rc = { ssp245: { median: change.ssp245[0], min: change.ssp245[1], max: change.ssp245[2] }, ssp585: { median: change.ssp585[0], min: change.ssp585[1], max: change.ssp585[2] } };
  const caveats = [];
  if (p.conf !== 'certain') caveats.push(`The identification is ${p.conf}, not certain; results describe ${p.latin.split(' ').slice(0, 2).join(' ')}, which may not be the plant Dioscorides meant.`);
  if (p.low) caveats.push(`Low-confidence model: ${p.clean} occurrence cells after cleaning (we require 30). Maps are exploratory and the rank interval is wide.`);
  caveats.push('Wild and cultivated records are hard to separate in occurrence databases; some cells may reflect cultivation.');
  caveats.push('Habitat suitability is not presence. The model omits dispersal limits, soils and grazing.');
  caveats.push('Harvest pressure is estimated from accessibility (distance to roads and villages), not field surveys.');
  const doc = {
    slug: p.slug, accepted_name: p.latin, common_name_en: p.common, family: p.family,
    dioscorides: { book: p.book, chapter: null, greek_name: p.greek, greek_translit: p.tr, excerpt: null, paraphrase: null, paraphrase_ai_assisted: false, edition: 'Wellmann 1906–1914' },
    identification: { confidence: p.conf, source: '[Author, year, page]', note: p.note ?? null, reviewed_by: '[historian, initials]', alternatives: p.alt ? [p.alt] : [] },
    endemic_greece: p.endemic, endemic_region: p.region,
    conservation_status: { category: p.st, source: 'IUCN Red List [sample]' },
    ema_monograph: p.ema,
    records: { raw: Math.round(p.clean * 3.6), clean: p.clean, thinned: p.clean, public_cells: occCells.length, low_confidence_model: !!p.low },
    model: { auc_mean: p.auc[0], auc_sd: p.auc[1], boyce_mean: p.boyce, boyce_sd: 0.08, tss_mean: p.tss[0], tss_sd: p.tss[1], null_auc_mean: 0.5, variables: ['bio1', 'bio12', 'bio5', 'bio15', 'elevation', 'slope'] },
    range_change_pct: rc, range_cells: rangeCells, natura_share_pct: naturaShare, risk,
    cultivation_area_km2: Math.round(p._cultArea / 10) * 10,
    cultivation_area_km2_range: { min: Math.round((p._cultArea * 0.78) / 10) * 10, max: Math.round((p._cultArea * 1.22) / 10) * 10 },
    caveats,
  };
  write(`species/${p.slug}.json`, doc);
  summary.push({
    slug: p.slug, accepted_name: p.latin, common_name_en: p.common, greek_name: p.greek, dmm_book: p.book,
    identification_confidence: p.conf, endemic_greece: p.endemic, endemic_region: p.region, conservation_category: p.st,
    low_confidence_model: !!p.low, risk: { score: risk.score, score_lo: risk.score_lo, score_hi: risk.score_hi, rank: risk.rank, rank_lo: risk.rank_lo, rank_hi: risk.rank_hi, class: risk.class },
    range_change_pct: rc, model: { auc_mean: p.auc[0], auc_sd: p.auc[1], boyce_mean: p.boyce, tss_mean: p.tss[0], tss_sd: p.tss[1] }, records_clean: p.clean,
  });
});
summary.sort((a, b) => a.risk.rank - b.risk.rank);
write('species.json', summary);

// ---------- Greece-wide risk grid ----------
const scoreOf = Object.fromEntries(PLANTS.map((p, i) => [p.slug, scores[i]]));
const gridFeats = [];
for (const c of cells) {
  // Empty/zero properties are omitted to keep the layer under 300 KB; the site reads missing as 0/''.
  const props = { id: c.key };
  if (naturaSet.has(c.key)) props.natura = 1;
  for (const [s, members] of [['now', gridNow.get(c.key) ?? []], ['ssp245', gridLoss.ssp245.get(c.key) ?? []], ['ssp585', gridLoss.ssp585.get(c.key) ?? []]]) {
    if (members.length) {
      const mean = members.reduce((a, m) => a + scoreOf[m], 0) / members.length;
      props[`class_${s}`] = riskClass(mean);
      props[`risk_${s}`] = Math.round(mean * 100) / 100;
      props[`sp_${s}`] = members.reduce((a, m) => a + 2 ** indexOf.get(m), 0).toString(36);
    }
    const cult = s === 'now' ? 0 : gridCult[s].get(c.key) ?? 0;
    if (cult) props[`cult_${s}`] = cult;
  }
  if (props.sp_now || props.sp_ssp245 || props.cult_ssp245 || props.cult_ssp585) gridFeats.push(feat(c, props));
}
write('layers/greece_risk_grid.geojson', fc(gridFeats));
write('layers/natura2000_outline.geojson', outline(naturaSet));

const meds = summary.map((s) => s.range_change_pct.ssp245.median);
write('meta.json', {
  sample: true,
  build_date: new Date().toISOString().slice(0, 10),
  gbif_doi: null,
  versions: { pipeline: 'sample', climate: 'WorldClim 2.1 2.5′ [sample]', dem: 'Copernicus GLO-90', corine: '2018', natura2000: '[sample circles, not real boundaries]' },
  n_species: summary.length,
  scenarios: {
    now: { label: 'Now', title: 'Current climate', description: 'Modelled from the 1970–2000 climate baseline [sample].' },
    ssp245: { label: '2050 moderate', title: '2050 · moderate emissions', description: 'SSP2-4.5, 2041–2060, 5 climate models; ranges show the spread [sample].' },
    ssp585: { label: '2050 high', title: '2050 · high emissions', description: 'SSP5-8.5, 2041–2060, 5 climate models; ranges show the spread [sample].' },
  },
  gcms: ['ACCESS-CM2', 'IPSL-CM6A-LR', 'MPI-ESM1-2-HR', 'MRI-ESM2-0', 'UKESM1-0-LL'],
  risk_weights: WEIGHTS, cell_km: 10, headline_slug: 'sideritis-syriaca',
  summary: { median_range_change_ssp245: { median: pct(meds, 50), min: pct(meds, 75), max: pct(meds, 25) } },
  sensitivity: { draws: DRAWS, perturbation: 0.5, one_at_a_time: oat, top_k: 3, top_k_unchanged: { median: r1((100 * sameTop) / total), min: r1((100 * sameTop) / total - 3), max: r1(Math.min(100, (100 * sameTop) / total + 3)) }, top10_overlap_without_disputed: 0.9 },
});
console.log(`sample data: ${summary.length} species, ${cells.length} land cells, ${gridFeats.length} grid cells -> ${OUT}`);
