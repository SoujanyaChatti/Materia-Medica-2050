// MapLibre map with the design's layer stack. Quiet basemap (Natural Earth outline), ~10 km cells
// only (never exact points), hatched cultivation zones, dashed Natura 2000 boundary, scale bar,
// north arrow, Greek + English place names, keyboard controls and loading / error states.
import { useEffect, useRef, useState } from 'react';
import type { Map as MLMap, MapGeoJSONFeature, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre resolves its worker relative to its own module URL, which bundling breaks; ship it explicitly.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { FutureKey, ScenarioKey } from '../lib/types';
import { dataUrl, loadRiskGrid } from '../lib/url';
import { IconAlert, IconReset } from './icons';

export type MapMode = 'range' | 'risk';
export interface Layers { range?: boolean; cult?: boolean; natura?: boolean; labels?: boolean; occ?: boolean; risk?: boolean }
export type CellProps = Record<string, string | number | undefined>;

const GREECE_BOUNDS: [[number, number], [number, number]] = [[19.2, 34.7], [29.8, 41.8]];
const FUT: FutureKey[] = ['ssp245', 'ssp585'];
const PLACES: [number, number, string, string][] = [
  [23.727, 37.984, 'Αθήνα', 'Athens'], [22.944, 40.64, 'Θεσσαλονίκη', 'Thessaloniki'], [25.134, 35.339, 'Ηράκλειο', 'Heraklion'],
  [21.735, 38.246, 'Πάτρα', 'Patras'], [20.853, 39.665, 'Ιωάννινα', 'Ioannina'], [22.35, 40.085, 'Όλυμπος', 'Mt Olympus'],
  [22.415, 39.639, 'Λάρισα', 'Larissa'], [28.224, 36.434, 'Ρόδος', 'Rhodes'],
];

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Diagonal hatch as a MapLibre image (pattern + colour, so it reads without colour too). */
function hatch(color: string, bg: string | null, dir: 1 | -1, gap: number, line: number) {
  const s = gap * 2, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, s, s); }
  g.strokeStyle = color; g.lineWidth = line;
  for (let o = -s; o <= s * 2; o += gap) {
    g.beginPath();
    if (dir === 1) { g.moveTo(o, s); g.lineTo(o + s, 0); } else { g.moveTo(o, 0); g.lineTo(o + s, s); }
    g.stroke();
  }
  return g.getImageData(0, 0, s, s);
}

function theme() {
  return {
    sea: css('--map-sea'), land: css('--map-land'), neighbour: css('--map-neighbour'), coast: css('--map-coast'),
    kept: css('--map-kept'), lost: css('--map-lost'), lostBg: css('--map-lost-bg'), gain: css('--map-gain'),
    cult: css('--map-cult'), natura: css('--map-natura'), occ: css('--map-occ'), ink: css('--ink'),
    risk: [1, 2, 3, 4, 5].map((i) => css(`--risk-${i}`)),
  };
}

export function RangeMap({ mode, slug, scenario, layers, chip, ariaLabel, tableHref, selectedId, onSelectCell, focus, cooperative = true, controls = true, aspect = '600 / 520' }: {
  mode: MapMode; slug?: string; scenario: ScenarioKey; layers: Layers; chip: string; ariaLabel: string; tableHref?: string;
  selectedId?: string | null; onSelectCell?: (p: CellProps) => void; focus?: [number, number] | null;
  cooperative?: boolean; controls?: boolean; aspect?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const selectRef = useRef(onSelectCell);
  selectRef.current = onSelectCell;
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [progress, setProgress] = useState<[number, number]>([0, 1]);
  const [attempt, setAttempt] = useState(0);

  // Build the map once per (mode, slug, attempt).
  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    let observer: MutationObserver | null = null;
    let resize: ResizeObserver | null = null;
    setStatus('loading');

    const files: Record<string, string> = {
      greece: 'basemap/greece.geojson', neighbours: 'basemap/neighbours.geojson', natura: 'layers/natura2000_outline.geojson',
      ...(mode === 'range' && slug ? {
        now: `layers/${slug}/range_now.geojson`, ssp245: `layers/${slug}/range_2050_ssp245.geojson`, ssp585: `layers/${slug}/range_2050_ssp585.geojson`,
        cult: `layers/${slug}/cultivation.geojson`, occ: `layers/${slug}/occurrences.geojson`,
      } : { grid: 'layers/greece_risk_grid.geojson' }),
    };
    const optional = new Set(['natura', 'neighbours']);

    (async () => {
      try {
        const keys = Object.keys(files);
        let done = 0;
        setProgress([0, keys.length]);
        const data: Record<string, GeoJSON.FeatureCollection> = {};
        await Promise.all(keys.map(async (k) => {
          try {
            if (k === 'grid') {
              data[k] = await loadRiskGrid();
            } else {
              const r = await fetch(dataUrl(files[k]));
              if (!r.ok) throw new Error(`${files[k]}: ${r.status}`);
              data[k] = await r.json();
            }
          } catch (e) {
            if (!optional.has(k)) throw e;
            data[k] = { type: 'FeatureCollection', features: [] };
          }
          if (!cancelled) setProgress([++done, keys.length]);
        }));
        const mod = await import('maplibre-gl');
        // maplibre-gl ≥ 5 is ESM with named exports; older builds expose a default namespace.
        const ml = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
        if (cancelled || !box.current) return;
        ml.setWorkerUrl(new URL(workerUrl, location.href).href);
        const t = theme();
        map = new ml.Map({
          container: box.current,
          style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': t.sea } }] },
          bounds: GREECE_BOUNDS, fitBoundsOptions: { padding: 8 },
          attributionControl: false, dragRotate: false, pitchWithRotate: false, cooperativeGestures: cooperative,
          minZoom: 4.5, maxZoom: 10, maxBounds: [[14, 30], [35, 46]],
        });
        map.touchZoomRotate.disableRotation();
        map.keyboard.disableRotation();
        map.addControl(new ml.ScaleControl({ unit: 'metric', maxWidth: 110 }), 'bottom-left');
        mapRef.current = map;

        map.on('load', () => {
          if (!map) return;
          const m = map;
          m.getCanvas().setAttribute('aria-label', ariaLabel);
          m.addImage('hatch-lost', hatch(t.lost, t.lostBg, 1, 5, 2));
          m.addImage('hatch-cult', hatch(t.cult, null, -1, 4, 1.4));
          for (const k of Object.keys(data)) m.addSource(k, { type: 'geojson', data: data[k] });

          m.addLayer({ id: 'neighbours', type: 'fill', source: 'neighbours', paint: { 'fill-color': t.neighbour } });
          m.addLayer({ id: 'neighbours-line', type: 'line', source: 'neighbours', paint: { 'line-color': t.coast, 'line-width': 0.6 } });
          m.addLayer({ id: 'land', type: 'fill', source: 'greece', paint: { 'fill-color': t.land } });

          if (mode === 'range') {
            m.addLayer({ id: 'now', type: 'fill', source: 'now', paint: { 'fill-color': t.kept } });
            for (const s of FUT) {
              m.addLayer({ id: `${s}-kept`, type: 'fill', source: s, filter: ['==', ['get', 'change'], 'kept'], paint: { 'fill-color': t.kept } });
              m.addLayer({ id: `${s}-lost`, type: 'fill', source: s, filter: ['==', ['get', 'change'], 'lost'], paint: { 'fill-pattern': 'hatch-lost' } });
              m.addLayer({ id: `${s}-gained`, type: 'fill', source: s, filter: ['==', ['get', 'change'], 'gained'], paint: { 'fill-color': t.gain } });
            }
            m.addLayer({ id: 'occ', type: 'line', source: 'occ', paint: { 'line-color': t.occ, 'line-width': 1.2 } });
            m.addLayer({ id: 'cult', type: 'fill', source: 'cult', paint: { 'fill-pattern': 'hatch-cult' } });
            m.addLayer({ id: 'cult-line', type: 'line', source: 'cult', paint: { 'line-color': t.cult, 'line-width': 0.8 } });
          } else {
            m.addLayer({ id: 'risk', type: 'fill', source: 'grid', paint: { 'fill-color': t.risk[0], 'fill-opacity': 0.92 } });
            m.addLayer({ id: 'cult', type: 'fill', source: 'grid', paint: { 'fill-pattern': 'hatch-cult' } });
            m.addLayer({ id: 'selected', type: 'line', source: 'grid', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': t.ink, 'line-width': 3 } });
            const pick = (e: { features?: MapGeoJSONFeature[] }) => {
              const f = e.features?.[0];
              if (f) selectRef.current?.(f.properties as CellProps);
            };
            m.on('click', 'risk', pick);
            m.on('click', 'cult', pick);
            for (const l of ['risk', 'cult']) {
              m.on('mouseenter', l, () => { m.getCanvas().style.cursor = 'pointer'; });
              m.on('mouseleave', l, () => { m.getCanvas().style.cursor = ''; });
            }
          }
          m.addLayer({ id: 'coast', type: 'line', source: 'greece', paint: { 'line-color': t.coast, 'line-width': 0.7 } });
          m.addLayer({ id: 'natura', type: 'line', source: 'natura', paint: { 'line-color': t.natura, 'line-width': 1.6, 'line-dasharray': [3, 2] } });

          markers.current = PLACES.map(([lon, lat, el, en]) => {
            const node = document.createElement('div');
            node.className = 'map-place';
            node.setAttribute('aria-hidden', 'true');
            node.innerHTML = `<span class="map-place-dot"></span><span>${el} · ${en}</span>`;
            return new ml.Marker({ element: node, anchor: 'left' }).setLngLat([lon, lat]).addTo(m);
          });

          // Theme switch → recolour every layer and regenerate the hatch images.
          observer = new MutationObserver(() => {
            const c = theme();
            m.setPaintProperty('bg', 'background-color', c.sea);
            m.setPaintProperty('neighbours', 'fill-color', c.neighbour);
            m.setPaintProperty('neighbours-line', 'line-color', c.coast);
            m.setPaintProperty('land', 'fill-color', c.land);
            m.setPaintProperty('coast', 'line-color', c.coast);
            m.setPaintProperty('natura', 'line-color', c.natura);
            m.updateImage('hatch-lost', hatch(c.lost, c.lostBg, 1, 5, 2));
            m.updateImage('hatch-cult', hatch(c.cult, null, -1, 4, 1.4));
            if (mode === 'range') {
              m.setPaintProperty('now', 'fill-color', c.kept);
              for (const s of FUT) { m.setPaintProperty(`${s}-kept`, 'fill-color', c.kept); m.setPaintProperty(`${s}-gained`, 'fill-color', c.gain); }
              m.setPaintProperty('occ', 'line-color', c.occ);
              m.setPaintProperty('cult-line', 'line-color', c.cult);
            } else {
              m.setPaintProperty('selected', 'line-color', c.ink);
            }
          });
          observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
          resize = new ResizeObserver(() => m.resize());
          if (box.current) resize.observe(box.current);
          if (!cancelled) setStatus('ready');
        });
        map.on('error', (e) => { console.error(e.error); });
      } catch (e) {
        console.error(e);
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      resize?.disconnect();
      markers.current.forEach((mk) => mk.remove());
      map?.remove();
      mapRef.current = null;
    };
  }, [mode, slug, attempt]);

  // Apply scenario / layer toggles / selection.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || status !== 'ready') return;
    const vis = (id: string, on: boolean) => m.getLayer(id) && m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    if (mode === 'range') {
      vis('now', !!layers.range && scenario === 'now');
      for (const s of FUT) for (const part of ['kept', 'lost', 'gained']) vis(`${s}-${part}`, !!layers.range && scenario === s);
      vis('occ', !!layers.occ);
      vis('cult', !!layers.cult); vis('cult-line', !!layers.cult);
    } else {
      const s = scenario;
      const cultKey = s === 'now' ? 'cult_ssp245' : `cult_${s}`;
      const risk = theme().risk;
      m.setFilter('risk', ['>', ['coalesce', ['get', `class_${s}`], 0], 0]);
      m.setPaintProperty('risk', 'fill-color', ['match', ['coalesce', ['get', `class_${s}`], 0], 1, risk[0], 2, risk[1], 3, risk[2], 4, risk[3], 5, risk[4], 'rgba(0,0,0,0)']);
      m.setFilter('cult', ['>', ['coalesce', ['get', cultKey], 0], 0]);
      vis('risk', layers.risk !== false);
      vis('cult', !!layers.cult);
      m.setFilter('selected', ['==', ['get', 'id'], selectedId ?? '']);
    }
    vis('natura', !!layers.natura);
    markers.current.forEach((mk) => { mk.getElement().style.display = layers.labels === false ? 'none' : ''; });
  }, [status, mode, scenario, layers.range, layers.cult, layers.natura, layers.labels, layers.occ, layers.risk, selectedId]);

  useEffect(() => {
    const m = mapRef.current;
    if (m && status === 'ready' && focus) m.flyTo({ center: focus, zoom: Math.max(m.getZoom(), 7), essential: false });
  }, [focus?.[0], focus?.[1], status]);

  const zoom = (d: number) => mapRef.current?.zoomTo((mapRef.current?.getZoom() ?? 6) + d);
  const reset = () => mapRef.current?.fitBounds(GREECE_BOUNDS, { padding: 8 });

  return (
    <div className="relative w-full overflow-hidden rounded-md border border-rule" style={{ aspectRatio: aspect, background: 'var(--map-sea)' }}>
      {/* inline position: maplibre-gl.css (unlayered) would otherwise override Tailwind's layered utilities */}
      <div ref={box} style={{ position: 'absolute', inset: 0 }} role="region" aria-label={ariaLabel} />

      <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-rule px-2.5 py-1 text-[12px] font-semibold text-ink" style={{ background: 'var(--map-chip)' }}>{chip}</div>
      <div aria-hidden="true" className="pointer-events-none absolute right-3.5 top-3 flex flex-col items-center gap-px text-[11px] font-semibold text-ink">
        <svg width="12" height="16" viewBox="0 0 12 16"><path d="M6 1 L11 15 L6 11 L1 15 Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><path d="M6 1 L6 11 L1 15 Z" fill="currentColor" /></svg>N
      </div>
      {controls && status === 'ready' && (
        <div className="absolute right-3 top-12 flex flex-col overflow-hidden rounded-md border border-rule bg-surface">
          <button type="button" aria-label="Zoom in" onClick={() => zoom(1)} className="h-11 w-11 cursor-pointer border-b border-rule text-xl text-ink">+</button>
          <button type="button" aria-label="Zoom out" onClick={() => zoom(-1)} className="h-11 w-11 cursor-pointer border-b border-rule text-xl text-ink">−</button>
          <button type="button" aria-label="Reset view" onClick={reset} className="flex h-11 w-11 cursor-pointer items-center justify-center text-ink"><IconReset /></button>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-1.5 right-2 rounded-sm px-1.5 py-px text-[10px] text-muted" style={{ background: 'var(--map-chip)' }}>
        Natural Earth (PD) · model output · ~10 km cells
      </div>

      {status === 'loading' && (
        <div aria-busy="true" className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[14px] text-muted" style={{ background: 'var(--map-sea)' }}>
          <div className="h-1 w-40 overflow-hidden rounded-sm bg-data-rule">
            <div className="h-1 bg-sage" style={{ width: `${(100 * progress[0]) / progress[1]}%` }} />
          </div>
          Loading map layers ({progress[0]} of {progress[1]})
        </div>
      )}
      {status === 'error' && (
        <div role="alert" className="absolute inset-0 flex items-center justify-center p-4" style={{ background: 'repeating-linear-gradient(135deg, var(--sunk) 0 10px, var(--data) 10px 20px)' }}>
          <div className="flex max-w-[380px] flex-col gap-2 rounded-md border border-rule bg-surface px-5 py-4">
            <div className="flex items-center gap-2 font-semibold"><span className="text-ochre"><IconAlert size={18} /></span>The map couldn't load</div>
            <div className="text-[14px] text-muted">The map layers didn't arrive. The numbers on this page are unaffected.</div>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button type="button" onClick={() => setAttempt((a) => a + 1)} className="min-h-11 cursor-pointer rounded-md bg-btn px-4 font-semibold text-on-btn">Try again</button>
              {tableHref && <a href={tableHref} className="inline-flex min-h-11 items-center px-1.5 font-semibold">View the data as a table</a>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
