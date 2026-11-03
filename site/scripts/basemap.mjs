// Writes the quiet basemap: Greece and its neighbours from Natural Earth 1:50m (public domain,
// via the world-atlas package). Output: public/data/basemap/{greece,neighbours}.geojson
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'data', 'basemap');
mkdirSync(out, { recursive: true });

const topo = JSON.parse(readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8'));
const all = feature(topo, topo.objects.countries).features;
const GREECE = '300';
const NEIGHBOURS = new Set(['008', '807', '100', '792', '196']); // AL, MK, BG, TR, CY

const round = (c) => (typeof c[0] === 'number' ? [Math.round(c[0] * 1e3) / 1e3, Math.round(c[1] * 1e3) / 1e3] : c.map(round));
const clean = (f) => ({ type: 'Feature', properties: { name: f.properties.name }, geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) } });

const greece = all.filter((f) => f.id === GREECE).map(clean);
const neighbours = all.filter((f) => NEIGHBOURS.has(f.id)).map(clean);
writeFileSync(join(out, 'greece.geojson'), JSON.stringify({ type: 'FeatureCollection', features: greece }));
writeFileSync(join(out, 'neighbours.geojson'), JSON.stringify({ type: 'FeatureCollection', features: neighbours }));
console.log(`basemap: Greece (${greece.length}) + ${neighbours.length} neighbours -> ${out}`);
