// "Set your own priorities": move the four risk weights and watch the ranking re-order live.
// Uses the exported risk components and the pipeline's own formula (weighted mean, renormalised),
// so the published weights reproduce the published ranking exactly.
import { useMemo, useState } from 'react';
import type { RiskComponents } from '../lib/types';
import { kendallTau, rankBy, score } from '../lib/action';
import { COMPONENT_LABELS, riskClassOf } from '../lib/format';
import { plantHref } from '../lib/url';
import { ConfidenceBadge, RiskTag } from './Badges';

export interface LabRow { slug: string; name: string; latin: string; rank: number; disputed: boolean; components: RiskComponents }

const KEYS: (keyof RiskComponents)[] = ['range_loss', 'endemism', 'status', 'harvest'];
const HELP: Record<keyof RiskComponents, string> = {
  range_loss: 'Share of current habitat lost by 2050',
  endemism: 'Found only in Greece',
  status: 'IUCN or national threat category',
  harvest: 'Wild-collection proxy (access by road, settlements)',
};

export default function WeightLab({ rows, published, topN = 10 }: { rows: LabRow[]; published: RiskComponents; topN?: number }) {
  const presets: { id: string; label: string; w: RiskComponents }[] = [
    { id: 'pub', label: 'Published', w: published },
    { id: 'eq', label: 'Equal weights', w: { range_loss: 1, endemism: 1, status: 1, harvest: 1 } },
    { id: 'clim', label: 'Climate only', w: { range_loss: 1, endemism: 0, status: 0, harvest: 0 } },
    { id: 'cons', label: 'Conservation agency', w: { range_loss: 0.2, endemism: 0.4, status: 0.4, harvest: 0 } },
    { id: 'harv', label: 'Harvest regulator', w: { range_loss: 0.2, endemism: 0, status: 0.2, harvest: 0.6 } },
  ];
  const [w, setW] = useState<RiskComponents>(published);
  const [showAll, setShowAll] = useState(false);
  const same = (a: RiskComponents, b: RiskComponents) => {
    const sa = KEYS.reduce((s, k) => s + a[k], 0) || 1, sb = KEYS.reduce((s, k) => s + b[k], 0) || 1;
    return KEYS.every((k) => Math.abs(a[k] / sa - b[k] / sb) < 1e-6);
  };
  const active = presets.find((p) => same(p.w, w))?.id;
  const total = KEYS.reduce((s, k) => s + w[k], 0);

  const res = useMemo(() => {
    const scores = rows.map((r) => score(r.components, w));
    const pub = rows.map((r) => r.rank);
    const ranks = rankBy(scores, pub);
    const tau = kendallTau(pub, ranks);
    const list = rows.map((r, i) => ({ ...r, s: scores[i], newRank: ranks[i], delta: r.rank - ranks[i] })).sort((a, b) => a.newRank - b.newRank);
    const pubTop = new Set(rows.filter((r) => r.rank <= 5).map((r) => r.slug));
    const overlap5 = list.slice(0, 5).filter((r) => pubTop.has(r.slug)).length;
    const moved = list.filter((r) => r.delta !== 0).length;
    return { list, tau, overlap5, moved };
  }, [rows, w]);

  const shown = showAll ? res.list : res.list.slice(0, topN);
  const pct = (k: keyof RiskComponents) => (total > 0 ? Math.round((100 * w[k]) / total) : 0);

  return (
    <section aria-labelledby="h-lab" className="card-surface flex flex-col gap-5 p-[clamp(16px,2.4vw,28px)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-[720px]">
          <div className="eyebrow text-ochre">Risk weight lab</div>
          <h2 id="h-lab" className="h-section mt-0.5">Whose priorities? Re-weigh the ranking</h2>
          <p className="m-0 mt-1 text-muted">A risk ranking is a value judgement. Move the weights, or pick a stakeholder, and the {rows.length} plants re-rank live with the pipeline's own formula. The published weights reproduce the published ranking exactly.</p>
        </div>
      </div>

      <div role="group" aria-label="Weight presets" className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button key={p.id} type="button" aria-pressed={active === p.id} onClick={() => setW(p.w)}
            className={`min-h-9 cursor-pointer rounded-full border px-3 text-[14px] ${active === p.id ? 'border-ink bg-ink text-bg' : 'border-rule bg-transparent text-ink'}`}>{p.label}</button>
        ))}
      </div>

      <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        <div className="flex flex-col gap-4">
          {KEYS.map((k) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="flex items-baseline justify-between gap-2 text-[15px]">
                <strong>{COMPONENT_LABELS[k]}</strong>
                <span className="tabular-nums text-muted">{pct(k)}% of score</span>
              </span>
              <input type="range" min={0} max={1} step={0.05} value={w[k]} onChange={(e) => setW({ ...w, [k]: Number(e.target.value) })}
                aria-valuetext={`${pct(k)} percent`} className="w-full" style={{ accentColor: 'var(--ochre)' }} />
              <span className="text-[13px] text-muted">{HELP[k]}</span>
            </label>
          ))}
          <dl className="m-0 grid grid-cols-3 gap-3 border-t border-rule pt-3.5">
            <div><dt className="text-[13px] text-muted">Agreement with published (Kendall τ)</dt><dd className="m-0 text-[26px] font-semibold">{res.tau.toFixed(2)}</dd></div>
            <div><dt className="text-[13px] text-muted">Published top 5 still in top 5</dt><dd className="m-0 text-[26px] font-semibold">{res.overlap5} <span className="text-[15px] font-normal text-muted">of 5</span></dd></div>
            <div><dt className="text-[13px] text-muted">Plants that change rank</dt><dd className="m-0 text-[26px] font-semibold">{res.moved} <span className="text-[15px] font-normal text-muted">of {rows.length}</span></dd></div>
          </dl>
          {total === 0 && <p role="alert" className="m-0 text-[14px] text-warn">All weights are zero; set at least one above zero.</p>}
          <p className="m-0 text-[13px] text-muted">τ = 1 means identical order; 0 means unrelated. The Methods page reports how far the ranking moves under 1,000 random weightings.</p>
        </div>

        <div className="card-data overflow-hidden">
          <table className="w-full border-collapse text-[15px]">
            <caption className="px-4 py-2.5 text-left text-[13px] text-muted" aria-live="polite">Ranking under these weights{showAll ? '' : ` · top ${topN}`}</caption>
            <thead><tr className="border-b-2 border-ink text-left text-[13px]">
              <th scope="col" className="py-2 pl-4 pr-2">Rank</th><th scope="col" className="px-2 py-2">Plant</th>
              <th scope="col" className="px-2 py-2">Score</th><th scope="col" className="py-2 pl-2 pr-4 text-right">vs published</th>
            </tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.slug} className="border-b border-data-rule last:border-0" style={{ transition: 'background 0.3s' }}>
                  <td className="py-2 pl-4 pr-2 text-[18px] font-semibold">{r.newRank}</td>
                  <td className="px-2 py-2">
                    <a href={plantHref(r.slug)} className="font-semibold text-ink">{r.name}</a>{' '}
                    {r.disputed && <ConfidenceBadge level="disputed" size="sm" />}
                    <div className="latin text-[14px] text-muted">{r.latin}</div>
                  </td>
                  <td className="px-2 py-2"><RiskTag cls={riskClassOf(r.s)} score={r.s} /></td>
                  <td className="py-2 pl-2 pr-4 text-right text-[14px] font-semibold tabular-nums">
                    {r.delta > 0 && <span className="text-ochre"><span aria-hidden="true">▲</span> {r.delta}<span className="sr-only"> places up</span></span>}
                    {r.delta < 0 && <span className="text-sage"><span aria-hidden="true">▼</span> {-r.delta}<span className="sr-only"> places down</span></span>}
                    {r.delta === 0 && <span className="text-muted">same</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-data-rule px-4 py-2">
            <button type="button" onClick={() => setShowAll(!showAll)} className="min-h-10 cursor-pointer bg-transparent p-0 font-semibold text-link">{showAll ? `Show top ${topN}` : `Show all ${rows.length}`}</button>
          </div>
        </div>
      </div>
    </section>
  );
}
