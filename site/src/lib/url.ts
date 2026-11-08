// All internal links and data fetches go through here so the site works under a GitHub Pages base path.
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');

export const href = (path = ''): string => BASE + path.replace(/^\//, '');
export const dataUrl = (path: string): string => href(`data/${path.replace(/^\//, '')}`);
export const plantHref = (slug: string): string => href(`plants/${slug}/`);

/** Fetch the risk grid (cell shapes) and its per-cell values (keyed by cell id) and merge them. */
export async function loadRiskGrid(): Promise<GeoJSON.FeatureCollection> {
  const [grid, cells] = await Promise.all([
    fetch(dataUrl('layers/greece_risk_grid.geojson')).then((r) => { if (!r.ok) throw new Error(`risk grid: ${r.status}`); return r.json(); }),
    fetch(dataUrl('layers/greece_risk_cells.json')).then((r) => (r.ok ? r.json() : {})),
  ]) as [GeoJSON.FeatureCollection, Record<string, Record<string, unknown>>];
  for (const f of grid.features) {
    const id = String(f.properties?.id ?? '');
    f.properties = { ...(f.properties ?? {}), id, ...(cells[id] ?? {}) };
  }
  return grid;
}

/** Grid cells merged with the stage-08 grower index: `grow` is a base-36 bitmask over species.json
 *  rank order, `n_grow` the number of plants with a 2050 cultivation zone in that cell. */
export async function loadGrowGrid(): Promise<GeoJSON.FeatureCollection> {
  const [grid, grow] = await Promise.all([
    fetch(dataUrl('layers/greece_risk_grid.geojson')).then((r) => { if (!r.ok) throw new Error(`grid: ${r.status}`); return r.json(); }),
    fetch(dataUrl('layers/grower_cells.json')).then((r) => { if (!r.ok) throw new Error(`grower cells: ${r.status}`); return r.json(); }),
  ]) as [GeoJSON.FeatureCollection, Record<string, { ssp245?: string }>];
  for (const f of grid.features) {
    const id = String(f.properties?.id ?? '');
    const m = grow[id]?.ssp245;
    f.properties = { id, grow: m ?? '', n_grow: m ? decodeMask(m).length : 0 };
  }
  return grid;
}

/** Indices set in a base-36 bitmask (bit i = species i in rank order). Exact for up to 53 species. */
export function decodeMask(m: string | number | undefined): number[] {
  const v = m ? parseInt(String(m), 36) : 0;
  const out: number[] = [];
  for (let i = 0; i < 53 && 2 ** i <= v; i++) if (Math.floor(v / 2 ** i) % 2 === 1) out.push(i);
  return out;
}
