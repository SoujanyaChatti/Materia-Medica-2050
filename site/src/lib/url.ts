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
