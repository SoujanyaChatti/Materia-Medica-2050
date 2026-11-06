// Static (server-rendered) decision matrix: x = 2050 range change with the spread across climate
// models, y = candidate cultivation area. Quadrants map to the actions in lib/action.ts.
// Shape and fill carry meaning as well as colour: filled = reliable, hollow = data first.
import type { Action, Quadrant } from '../lib/action';
import { QUADRANTS } from '../lib/action';
import { signed } from '../lib/format';
import { plantHref } from '../lib/url';

const W = 880, H = 440, L = 64, R = 20, T = 24, B = 52;
const X0 = -100, X1 = 200;
const x = (v: number) => L + ((Math.max(X0, Math.min(X1, v)) - X0) / (X1 - X0)) * (W - L - R);
// y: band for "none", then log10 km² from 10 to 100,000
const NONE_Y = H - B - 22;
const y = (km2: number) => (km2 <= 0 ? NONE_Y : T + (1 - (Math.log10(Math.max(10, km2)) - 1) / 4) * (NONE_Y - 34 - T));
const QUAD_FILL: Record<Quadrant, string> = {
  protect_cultivate: 'var(--ochre-tint)', protect_only: 'var(--ochre-tint)', opportunity: 'var(--sage-tint)', monitor: 'transparent',
};

export function DecisionMatrix({ actions }: { actions: Action[] }) {
  const ySplit = NONE_Y - 17;
  const label = (a: Action) => a.name.split(/[\s/]+/)[0] === 'Wild' ? a.name.replace('Wild peonies of Greece', 'Peonies') : a.name.split(' / ')[0];
  const showLabel = (a: Action) => (a.cultKm2 > 0 && (a.rank <= 8 || a.change > 120 || a.cultKm2 > 9000)) || (a.cultKm2 <= 0 && (a.rank === 7 || a.change > 150));
  return (
    <figure className="m-0 flex flex-col gap-2">
      <div className="card-data overflow-x-auto p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[640px]" role="img"
          aria-labelledby="dm-title dm-desc">
          <title id="dm-title">Decision matrix: range change by 2050 against candidate cultivation area</title>
          <desc id="dm-desc">{actions.map((a) => `${a.name}: ${signed(a.change)} range change, ${a.cultKm2 ? `${Math.round(a.cultKm2)} km² cultivation zone` : 'no cultivation zone'}, ${QUADRANTS[a.quadrant].title}`).join('; ')}.</desc>

          {/* quadrant backgrounds */}
          <rect x={L} y={T} width={x(0) - L} height={ySplit - T} fill={QUAD_FILL.protect_cultivate} opacity="0.7" />
          <rect x={L} y={ySplit} width={x(0) - L} height={H - B - ySplit} fill={QUAD_FILL.protect_only} opacity="1" />
          <rect x={x(0)} y={T} width={W - R - x(0)} height={ySplit - T} fill={QUAD_FILL.opportunity} opacity="0.7" />
          <line x1={x(0)} y1={T} x2={x(0)} y2={H - B} stroke="var(--ink)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1={L} y1={ySplit} x2={W - R} y2={ySplit} stroke="var(--ink)" strokeWidth="1" strokeDasharray="4 3" />

          <g fontSize="12" fontWeight="700" fill="var(--ink)">
            <text x={L + 8} y={T + 16}>PROTECT AND CULTIVATE</text>
            <text x={L + 8} y={H - B - 6}>PROTECT: NO FALLBACK</text>
            <text x={W - R - 8} y={T + 16} textAnchor="end">CULTIVATION OPPORTUNITY</text>
            <text x={W - R - 8} y={H - B - 6} textAnchor="end">MONITOR</text>
          </g>

          {/* axes */}
          <g fontSize="12" fill="var(--muted)">
            {[-100, -50, 0, 50, 100, 150, 200].map((v) => (
              <g key={v}><line x1={x(v)} y1={H - B} x2={x(v)} y2={H - B + 5} stroke="var(--muted)" />
                <text x={x(v)} y={H - B + 19} textAnchor="middle">{v === 200 ? '≥ +200%' : signed(v)}</text></g>
            ))}
            <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" fill="var(--ink)" fontWeight="600">Range change by 2050, moderate emissions (median, bar = spread of 3 climate models)</text>
            {[100, 1000, 10000].map((v) => (
              <g key={v}><line x1={L - 5} y1={y(v)} x2={L} y2={y(v)} stroke="var(--muted)" />
                <text x={L - 8} y={y(v) + 4} textAnchor="end">{v.toLocaleString('en-GB')}</text></g>
            ))}
            <text x={L - 8} y={NONE_Y + 4} textAnchor="end">none</text>
            <text transform={`translate(14 ${(T + ySplit) / 2}) rotate(-90)`} textAnchor="middle" fill="var(--ink)" fontWeight="600">Cultivation zone 2050, km² (log)</text>
          </g>

          {/* points: whisker = GCM spread; filled = reliable, hollow = resolve data first */}
          {actions.map((a) => {
            const cy = y(a.cultKm2) + (a.cultKm2 <= 0 ? ((a.rank * 7) % 13) - 6 : 0);
            const r = 4 + 7 * a.score;
            return (
              <a key={a.slug} href={plantHref(a.slug)} aria-label={`${a.name}, ${QUADRANTS[a.quadrant].title}`}>
                <title>{`${a.name} (${a.latin}) · rank ${a.rank} · ${signed(a.change)} (${signed(a.changeLo)} to ${signed(a.changeHi)}) · ${a.cultKm2 ? Math.round(a.cultKm2).toLocaleString('en-GB') + ' km²' : 'no cultivation zone'}${a.dataFirst ? ' · resolve data first' : ''}`}</title>
                <line x1={x(a.changeLo)} y1={cy} x2={x(a.changeHi)} y2={cy} stroke="var(--ink)" strokeWidth="1.2" opacity="0.55" />
                <circle cx={x(a.change)} cy={cy} r={r} fill={a.dataFirst ? 'var(--data)' : `var(--risk-${a.riskClass})`}
                  stroke="var(--ink)" strokeWidth={a.dataFirst ? 1.6 : 1} strokeDasharray={a.dataFirst ? '2.5 1.8' : undefined} />
                {showLabel(a) && (x(a.change) > W - 170
                  ? <text x={x(a.change) - r - 4} y={cy - r - 2} fontSize="12" fill="var(--ink)" textAnchor="end">{label(a)}</text>
                  : <text x={x(a.change) + r + 4} y={cy - r - 1} fontSize="12" fill="var(--ink)">{label(a)}</text>)}
              </a>
            );
          })}
        </svg>
      </div>
      <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
        <span className="inline-flex items-center gap-1.5"><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="var(--risk-3)" stroke="var(--ink)" /></svg>Solid: identification and model reliable (fill = risk class, size = risk score)</span>
        <span className="inline-flex items-center gap-1.5"><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="var(--data)" stroke="var(--ink)" strokeDasharray="2.5 1.8" strokeWidth="1.6" /></svg>Hollow dashed: disputed identification or low-confidence model, resolve data first</span>
        <span>Hover or focus a point for values; select it to open the plant.</span>
      </figcaption>
    </figure>
  );
}
