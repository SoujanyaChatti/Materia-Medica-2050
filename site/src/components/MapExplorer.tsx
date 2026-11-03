// /map: Greece-wide combined risk, cultivation hotspots and Natura 2000. Click a cell (or pick a
// named area — the keyboard/list alternative) to list the species modelled there.
import { useEffect, useMemo, useState } from 'react';
import type { Meta, ScenarioKey, SpeciesSummary } from '../lib/types';
import { dataUrl, plantHref } from '../lib/url';
import { ConfidenceBadge, LowConfidenceTag, RiskTag } from './Badges';
import { LegendItem, RiskLegend } from './MapLegend';
import { RangeMap, type CellProps } from './RangeMap';
import { ScenarioToggle } from './ScenarioToggle';

const AREAS: { id: string; name: string; short: string; lonlat: [number, number] }[] = [
  { id: 'lefka', name: 'Lefka Ori, Crete', short: 'Lefka Ori', lonlat: [23.98, 35.3] },
  { id: 'psiloritis', name: 'Psiloritis (Ida), Crete', short: 'Psiloritis', lonlat: [24.77, 35.22] },
  { id: 'olympus', name: 'Mount Olympus', short: 'Olympus', lonlat: [22.35, 40.08] },
  { id: 'pindus', name: 'Northern Pindus', short: 'Pindus', lonlat: [20.95, 40.0] },
  { id: 'parnassos', name: 'Parnassos', short: 'Parnassos', lonlat: [22.55, 38.53] },
  { id: 'taygetos', name: 'Taygetos', short: 'Taygetos', lonlat: [22.35, 36.95] },
];

type Cell = { props: CellProps; centre: [number, number] };
const centreOf = (f: GeoJSON.Feature): [number, number] => {
  const ring = (f.geometry as GeoJSON.Polygon).coordinates[0];
  const xs = ring.map((c) => c[0]), ys = ring.map((c) => c[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};
const distKm = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * 111.32 * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * 110.57);

export default function MapExplorer({ species, scenarios, nSpecies }: { species: SpeciesSummary[]; scenarios: Meta['scenarios']; nSpecies: number }) {
  const [scenario, setScenario] = useState<ScenarioKey>('ssp245');
  const [layers, setLayers] = useState({ risk: true, cult: true, natura: true, labels: true });
  const [cells, setCells] = useState<Cell[] | null>(null);
  const [sel, setSel] = useState<{ cell: Cell; name: string; areaId?: string } | null>(null);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const byIndex = species; // species.json order = indices used in the grid (rank order)

  useEffect(() => {
    fetch(dataUrl('layers/greece_risk_grid.geojson')).then((r) => r.json()).then((fc: GeoJSON.FeatureCollection) => {
      setCells(fc.features.map((f) => ({ props: f.properties as CellProps, centre: centreOf(f) })));
    }).catch(() => setCells([]));
  }, []);

  const s = scenario;
  const hasData = (c: Cell) => !!c.props[`sp_${s}`] || !!c.props.sp_now;
  const nearestCell = (pt: [number, number]) => (cells ?? []).filter(hasData).reduce<Cell | null>((best, c) => (!best || distKm(pt, c.centre) < distKm(pt, best.centre) ? c : best), null);

  const pickArea = (id: string, fly = true) => {
    const a = AREAS.find((x) => x.id === id)!;
    const c = nearestCell(a.lonlat);
    if (c) { setSel({ cell: c, name: a.name, areaId: id }); if (fly) setFocus(a.lonlat); }
  };
  // Default selection once the grid arrives (no fly-to: keep the whole country in view).
  useEffect(() => { if (cells && !sel) pickArea('lefka', false); }, [cells]);

  const onCell = (props: CellProps) => {
    const c = cells?.find((x) => x.props.id === props.id);
    if (!c) return;
    const near = AREAS.map((a) => ({ a, d: distKm(c.centre, a.lonlat) })).sort((x, y) => x.d - y.d)[0];
    const name = near && near.d < 30 ? `Near ${near.a.name}` : `Cell at ${c.centre[1].toFixed(1)}°N, ${c.centre[0].toFixed(1)}°E`;
    setSel({ cell: c, name, areaId: near && near.d < 30 ? near.a.id : undefined });
  };

  const info = useMemo(() => {
    if (!sel) return null;
    const p = sel.cell.props;
    const idx = (k: string) => String(p[k] ?? '').split(',').filter(Boolean).map(Number);
    const losing = new Set(s === 'now' ? [] : idx(`sp_${s}`));
    const ids = [...new Set([...idx('sp_now'), ...losing])];
    const members = ids.map((i) => ({ sp: byIndex[i], losing: losing.has(i) })).filter((m) => m.sp);
    const scores = members.map((m) => m.sp.risk.score);
    const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const cult = Number(p[s === 'now' ? 'cult_ssp245' : `cult_${s}`] ?? 0);
    return { members, nLosing: losing.size, risk: mean, lo: Math.min(...scores), hi: Math.max(...scores), natura: Number(p.natura ?? 0) === 1, cult };
  }, [sel, s, byIndex]);

  const toggle = (k: keyof typeof layers) => setLayers((l) => ({ ...l, [k]: !l[k] }));
  const box = (k: keyof typeof layers, label: string) => (
    <label className="flex min-h-10 cursor-pointer items-center gap-2.5">
      <input type="checkbox" checked={layers[k]} onChange={() => toggle(k)} className="h-[18px] w-[18px]" style={{ accentColor: 'var(--ink)' }} />{label}
    </label>
  );
  const listLabel = s === 'now' ? 'Species modelled here now' : `Species modelled here · ${info?.nLosing ?? 0} losing habitat by 2050`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <h1 className="h-display m-0 text-[clamp(34px,4vw,48px)]">Map explorer</h1>
          <p className="m-0 mt-1 max-w-[640px] text-muted">Combined risk across all {nSpecies} species, candidate cultivation zones and protected areas. Select an area to list the species modelled there.</p>
        </div>
        <ScenarioToggle value={scenario} onChange={setScenario} scenarios={scenarios} showNote={false} />
      </div>
      <p aria-live="polite" className="m-0 -mt-2 text-[14px] text-muted"><strong className="text-ink">{scenarios[s].title}.</strong> {scenarios[s].description}</p>

      <div className="flex flex-wrap items-start gap-4">
        <fieldset className="card-data m-0 flex flex-[1_1_200px] flex-col gap-0.5 px-4 py-3.5">
          <legend className="px-1 text-[13px] font-bold">Layers</legend>
          {box('risk', 'Combined risk')}
          {box('cult', 'Cultivation hotspots')}
          {box('natura', 'Natura 2000 sites')}
          {box('labels', 'Place names')}
          <div aria-hidden="true" className="mb-2 mt-2.5 h-px bg-data-rule" />
          <div className="mb-1.5 text-[13px] font-bold">Combined risk</div>
          <RiskLegend />
          <div className="mt-1.5 flex flex-col gap-1 text-[13px]">
            <LegendItem item="cult" label="Cultivation hotspot" />
            <LegendItem item="natura" label="Natura 2000 boundary" />
            <span className="mt-1 text-muted">{s === 'now' ? 'Mean risk score of species modelled in each ~10 km cell.' : 'Mean risk score of species losing habitat in each ~10 km cell.'}</span>
          </div>
        </fieldset>

        <div className="flex min-w-0 flex-[999_1_460px] flex-col gap-2">
          <RangeMap mode="risk" scenario={scenario} layers={layers} selectedId={sel ? String(sel.cell.props.id) : null}
            onSelectCell={onCell} focus={focus} cooperative={false} tableHref="#area-list"
            chip={`Combined risk · ${scenarios[s].title}`}
            ariaLabel="Map of Greece showing combined risk classes on a 10 km grid. Area list beside the map." />
          <p className="m-0 text-[13px] text-muted">Keyboard: arrow keys pan and +/− zoom when the map has focus; pick an area from the <a href="#area-list">list alternative</a> to select it without the map.</p>
        </div>

        <aside aria-labelledby="h-area" aria-live="polite" className="card-surface flex flex-[1_1_280px] flex-col gap-3 p-4.5">
          <div className="eyebrow text-muted">Selected area</div>
          {!sel || !info ? (
            <div aria-busy="true" className="flex flex-col gap-2">
              <div className="h-7 w-2/3 rounded-sm bg-skeleton" /><div className="h-4 w-1/2 rounded-sm bg-skeleton" /><div className="h-4 w-3/4 rounded-sm bg-skeleton" />
            </div>
          ) : (
            <>
              <h2 id="h-area" className="m-0 font-serif text-[28px] font-medium leading-tight">{sel.name}</h2>
              <dl className="m-0 grid grid-cols-2 gap-2.5 text-[14px]">
                <div><dt className="text-[13px] text-muted">Mean combined risk</dt>
                  <dd className="m-0">{info.members.length
                    ? <><strong className="text-[18px]">{info.risk.toFixed(2)}</strong> <span className="text-muted">({info.lo.toFixed(2)}–{info.hi.toFixed(2)})</span></>
                    : <span className="text-muted">No species modelled</span>}</dd></div>
                <div><dt className="text-[13px] text-muted">Natura 2000</dt><dd className="m-0">{info.natura ? 'Yes' : 'No'}</dd></div>
                <div className="col-span-2"><dt className="text-[13px] text-muted">Cultivation candidates (2050)</dt><dd className="m-0">{info.cult} species</dd></div>
              </dl>
              <div className="text-[13px] font-bold">{listLabel}</div>
              <ul className="m-0 flex list-none flex-col border-t border-rule p-0">
                {info.members.length === 0 && <li className="py-2.5 text-[14px] text-muted">None in this cell under this scenario.</li>}
                {info.members.map(({ sp: m, losing }) => (
                  <li key={m.slug} className="flex flex-col gap-1 border-b border-rule py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <a href={plantHref(m.slug)} className="font-semibold text-ink">{m.common_name_en}</a>
                      <RiskTag cls={m.risk.class} score={m.risk.score} />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <em className="font-serif text-muted">{m.accepted_name.split(' ').slice(0, 2).join(' ')}</em>
                      {losing && <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold"><span aria-hidden="true" className="hatch-lost h-3 w-3" />Habitat lost by 2050</span>}
                      {m.identification_confidence === 'disputed' && <ConfidenceBadge level="disputed" size="sm" />}
                      {m.low_confidence_model && <LowConfidenceTag />}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div id="area-list" className="flex flex-col gap-1.5">
            <div className="text-[13px] font-bold">All areas</div>
            <div className="flex flex-wrap gap-1.5">
              {AREAS.map((a) => {
                const on = sel?.areaId === a.id;
                return (
                  <button key={a.id} type="button" aria-pressed={on} onClick={() => pickArea(a.id)} disabled={!cells}
                    className={`min-h-9 cursor-pointer rounded-full border px-3 text-[14px] ${on ? 'border-ink bg-ink text-bg' : 'border-rule bg-transparent text-ink'}`}>{a.short}</button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
