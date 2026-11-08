// "What could I grow here in 2050?" A farmer, cooperative or extension officer picks a ~10 km cell
// (or a farming region) and gets the Dioscoridean plants whose 2050 climate suits cultivation there,
// on farmland outside Natura 2000 and at least 5 km from wild records. Downloadable as a CSV sheet.
import { useEffect, useMemo, useState } from 'react';
import { decodeMask, loadGrowGrid, plantHref } from '../lib/url';
import { ConfidenceBadge, LowConfidenceTag, RiskTag } from './Badges';
import { RangeMap, type CellProps } from './RangeMap';

export interface GrowRow {
  slug: string; name: string; latin: string; greek: string; rank: number; score: number; riskClass: number;
  change: number; allAgreeLoss: boolean; ema: boolean; emaUse: string | null; emaUrl: string | null;
  confidence: 'certain' | 'probable' | 'disputed'; lowModel: boolean; cultKm2: number;
}

const REGIONS: { id: string; name: string; lonlat: [number, number] }[] = [
  { id: 'heraklion', name: 'Heraklion, Crete', lonlat: [25.1, 35.2] },
  { id: 'chania', name: 'Chania, western Crete', lonlat: [23.9, 35.45] },
  { id: 'messinia', name: 'Messinia', lonlat: [21.9, 37.1] },
  { id: 'argolida', name: 'Argolida', lonlat: [22.8, 37.6] },
  { id: 'attica', name: 'Attica', lonlat: [23.8, 38.0] },
  { id: 'euboea', name: 'Euboea', lonlat: [23.6, 38.5] },
  { id: 'thessaly', name: 'Thessaly plain', lonlat: [22.42, 39.64] },
  { id: 'lesvos', name: 'Lesvos', lonlat: [26.3, 39.2] },
  { id: 'thessaloniki', name: 'Thessaloniki plain', lonlat: [22.6, 40.7] },
  { id: 'thrace', name: 'Thrace (Evros)', lonlat: [26.0, 41.1] },
];
const STEPS: [number, string][] = [[1, '1'], [2, '2'], [3, '3–4'], [5, '5–6'], [7, '7+']];

type Cell = { id: string; mask: string; n: number; centre: [number, number] };
const centreOf = (f: GeoJSON.Feature): [number, number] => {
  const ring = (f.geometry as GeoJSON.Polygon).coordinates[0].slice(0, -1);
  return [ring.reduce((s, c) => s + c[0], 0) / ring.length, ring.reduce((s, c) => s + c[1], 0) / ring.length];
};
const distKm = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * 111.32 * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * 110.57);

export default function GrowerFinder({ rows }: { rows: GrowRow[] }) {
  const [cells, setCells] = useState<Cell[] | null>(null);
  const [sel, setSel] = useState<{ cell: Cell; name: string; regionId?: string } | null>(null);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [sortBy, setSortBy] = useState<'risk' | 'market'>('risk');

  useEffect(() => {
    loadGrowGrid().then((fc) => setCells(fc.features
      .filter((f) => Number(f.properties?.n_grow) > 0)
      .map((f) => ({ id: String(f.properties!.id), mask: String(f.properties!.grow), n: Number(f.properties!.n_grow), centre: centreOf(f) }))))
      .catch(() => setCells([]));
  }, []);

  const nearest = (pt: [number, number]) => (cells ?? []).reduce<Cell | null>((b, c) => (!b || distKm(pt, c.centre) < distKm(pt, b.centre) ? c : b), null);
  const pickRegion = (id: string, fly = true) => {
    const r = REGIONS.find((x) => x.id === id)!;
    const c = nearest(r.lonlat);
    if (c) { setSel({ cell: c, name: r.name, regionId: id }); if (fly) setFocus(c.centre); }
  };
  useEffect(() => { if (cells?.length && !sel) pickRegion('heraklion', false); }, [cells]);

  const onCell = (p: CellProps) => {
    const c = cells?.find((x) => x.id === String(p.id));
    if (!c) return;
    const near = REGIONS.map((r) => ({ r, d: distKm(c.centre, r.lonlat) })).sort((a, b) => a.d - b.d)[0];
    setSel({ cell: c, name: near.d < 25 ? `Near ${near.r.name}` : `${c.centre[1].toFixed(2)}°N, ${c.centre[0].toFixed(2)}°E`, regionId: near.d < 25 ? near.r.id : undefined });
  };

  const plants = useMemo(() => {
    if (!sel) return [];
    const list = decodeMask(sel.cell.mask).map((i) => rows[i]).filter(Boolean);
    return list.sort((a, b) => (sortBy === 'market' ? Number(b.ema) - Number(a.ema) || a.rank - b.rank : a.rank - b.rank));
  }, [sel, rows, sortBy]);

  const stats = useMemo(() => {
    if (!cells) return null;
    const anyGrow = new Set(cells.flatMap((c) => decodeMask(c.mask)));
    return { cells: cells.length, km2: cells.length * 100, plants: anyGrow.size, rich: cells.filter((c) => c.n >= 5).length };
  }, [cells]);

  const download = () => {
    if (!sel) return;
    const q = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['common_name', 'accepted_name', 'dioscorides_greek', 'risk_rank', 'range_change_2050_pct', 'wild_habitat_shrinking', 'ema_monograph', 'ema_use', 'identification', 'model_confidence', 'plant_page'];
    const body = plants.map((p) => [p.name, p.latin, p.greek, p.rank, p.change.toFixed(0), p.allAgreeLoss ? 'yes' : 'no', p.ema ? 'yes' : 'no', p.emaUse, p.confidence, p.lowModel ? 'low' : 'adequate', new URL(plantHref(p.slug), location.href).href].map(q).join(','));
    const meta = [`# Grower sheet: ${sel.name} (cell ${sel.cell.id}, ~10 km), 2050 moderate emissions (SSP2-4.5)`,
      '# Research prototype. Climate suitability only: check soil, water, market and permits locally. Not medical advice.'];
    const blob = new Blob([[...meta, head.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `grower-sheet-${sel.cell.id}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="flex flex-col gap-4">
      {stats && (
        <p className="m-0 text-[15px] text-muted">
          <strong className="text-ink">{stats.plants} plants</strong> have candidate 2050 cultivation land in{' '}
          <strong className="text-ink">{stats.cells.toLocaleString('en-GB')} cells</strong> (~{stats.km2.toLocaleString('en-GB')} km² of grid);{' '}
          {stats.rich} cells could host five or more.
        </p>
      )}
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-2">
          <RangeMap mode="grow" scenario="ssp245" layers={{ labels: true }} selectedId={sel?.cell.id ?? null} onSelectCell={onCell}
            focus={focus} cooperative={false} tableHref="#grow-regions" chip="Plants you could grow · 2050 moderate"
            ariaLabel="Map of Greece: number of Dioscoridean plants with candidate 2050 cultivation land in each ~10 km cell. Region list beside the map." />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
            <span className="font-bold">Plants per cell</span>
            {STEPS.map(([v, l], i) => (
              <span key={v} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="box-border h-3 w-[18px]" style={{ background: `var(--grow-${i + 1})`, border: i === 0 ? '1px solid var(--rule)' : undefined }} />{l}
              </span>
            ))}
            <span className="text-muted">Click a cell, or pick a region.</span>
          </div>
        </div>

        <aside aria-labelledby="h-grow" aria-live="polite" className="card-surface flex flex-[1_1_320px] flex-col gap-3 p-4.5">
          <div className="eyebrow text-muted">Grower sheet</div>
          {!sel ? (
            <div aria-busy="true" className="flex flex-col gap-2"><div className="h-7 w-2/3 rounded-sm bg-skeleton" /><div className="h-4 w-3/4 rounded-sm bg-skeleton" /></div>
          ) : (
            <>
              <h3 id="h-grow" className="m-0 font-serif text-[26px] font-medium leading-tight">{sel.name}</h3>
              <p className="m-0 text-[14px] text-muted"><strong className="text-ink">{plants.length} Dioscoridean plant{plants.length === 1 ? '' : 's'}</strong> with suitable 2050 climate on farmland here, outside Natura 2000 and ≥ 5 km from wild populations.</p>
              <div role="group" aria-label="Sort plants" className="flex gap-1.5 text-[13px]">
                <span className="self-center text-muted">Sort:</span>
                {([['risk', 'Conservation benefit'], ['market', 'EU monograph first']] as const).map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={sortBy === k} onClick={() => setSortBy(k)}
                    className={`min-h-8 cursor-pointer rounded-full border px-2.5 ${sortBy === k ? 'border-ink bg-ink text-bg' : 'border-rule bg-transparent text-ink'}`}>{l}</button>
                ))}
              </div>
              <ul className="m-0 flex list-none flex-col border-t border-rule p-0">
                {plants.map((p) => (
                  <li key={p.slug} className="flex flex-col gap-1 border-b border-rule py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <a href={plantHref(p.slug)} className="font-semibold text-ink">{p.name}</a>
                      <RiskTag cls={p.riskClass} score={p.score} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                      <em className="font-serif text-[15px] text-muted">{p.latin}</em>
                      <span lang="grc" className="font-serif text-[15px] text-ochre">{p.greek}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                      {p.allAgreeLoss && <span className="inline-flex items-center gap-1.5 font-semibold"><span aria-hidden="true" className="hatch-lost h-3 w-3" />Wild habitat shrinking: growing it relieves wild stands</span>}
                      {p.ema
                        ? <a href={p.emaUrl ?? undefined} className="rounded-full border border-sage px-2 py-px font-semibold text-sage no-underline">EU herbal monograph{p.emaUse ? ` · ${p.emaUse}` : ''}</a>
                        : <span className="rounded-full border border-rule px-2 py-px text-muted">No EU monograph</span>}
                      {p.confidence !== 'certain' && <ConfidenceBadge level={p.confidence} size="sm" />}
                      {p.lowModel && <LowConfidenceTag />}
                    </div>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={download} className="btn-secondary min-h-11 cursor-pointer">Download grower sheet (CSV)</button>
              <p className="m-0 text-[12px] text-muted">Climate suitability only. Soil, water, markets and permits need local checks. Monograph status is regulatory, not a health claim.</p>
            </>
          )}
          <div id="grow-regions" className="flex flex-col gap-1.5 border-t border-rule pt-3">
            <div className="text-[13px] font-bold">Farming regions</div>
            <div className="flex flex-wrap gap-1.5">
              {REGIONS.map((r) => (
                <button key={r.id} type="button" aria-pressed={sel?.regionId === r.id} onClick={() => pickRegion(r.id)} disabled={!cells}
                  className={`min-h-9 cursor-pointer rounded-full border px-3 text-[13px] ${sel?.regionId === r.id ? 'border-ink bg-ink text-bg' : 'border-rule bg-transparent text-ink'}`}>{r.name}</button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
