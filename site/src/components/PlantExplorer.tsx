// /plants: sortable, filterable table or grid of all species with an empty state.
import { useMemo, useState } from 'react';
import type { Confidence, SpeciesSummary } from '../lib/types';
import { RISK_LABELS, STATUS_NAMES, changeText, roman } from '../lib/format';
import { plantHref } from '../lib/url';
import { ConfidenceBadge, LowConfidenceTag, Pill, RiskTag } from './Badges';
import { IconCheck } from './icons';
import { Whisker } from './UncertainValue';

type Sort = 'rank' | 'name' | 'change';
const latinShort = (n: string) => n.split(' ').slice(0, 2).join(' ');

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[14px] ${on ? 'border-ink bg-ink text-bg' : 'border-rule bg-transparent text-ink'}`}>
      {children}
    </button>
  );
}

export default function PlantExplorer({ rows, total }: { rows: SpeciesSummary[]; total: number }) {
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [risk, setRisk] = useState<number | 'all'>('all');
  const [conf, setConf] = useState<Confidence | 'all'>('all');
  const [endemic, setEndemic] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('rank');
  const [dir, setDir] = useState<1 | -1>(1);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const key: Record<Sort, (p: SpeciesSummary) => number | string> = {
      rank: (p) => p.risk.rank, name: (p) => p.common_name_en, change: (p) => p.range_change_pct.ssp245.median,
    };
    return rows
      .filter((p) => (risk === 'all' || p.risk.class === risk) && (conf === 'all' || p.identification_confidence === conf) && (!endemic || p.endemic_greece)
        && (!needle || `${p.common_name_en} ${p.accepted_name} ${p.greek_name}`.toLowerCase().includes(needle)))
      .sort((a, b) => (key[sort](a) > key[sort](b) ? 1 : key[sort](a) < key[sort](b) ? -1 : 0) * dir);
  }, [rows, risk, conf, endemic, q, sort, dir]);

  const sortBy = (k: Sort) => { setDir(sort === k ? (dir === 1 ? -1 : 1) : 1); setSort(k); };
  const mark = (k: Sort) => (sort === k ? (dir === 1 ? '▲' : '▼') : '↕');
  const aria = (k: Sort) => (sort === k ? (dir === 1 ? 'ascending' : 'descending') : 'none') as 'ascending' | 'descending' | 'none';
  const clearAll = () => { setRisk('all'); setConf('all'); setEndemic(false); setQ(''); };
  const filterText = [risk !== 'all' && RISK_LABELS[risk - 1] + ' risk', endemic && 'Greek endemics only', conf !== 'all' && conf[0].toUpperCase() + conf.slice(1), q && `“${q}”`].filter(Boolean).join(' · ');

  const SortHead = ({ k, children, className = '' }: { k: Sort; children: React.ReactNode; className?: string }) => (
    <th scope="col" aria-sort={aria(k)} className={`px-2 ${className}`}>
      <button type="button" onClick={() => sortBy(k)} className="inline-flex min-h-11 cursor-pointer items-center gap-1 bg-transparent p-0 text-[13px] font-bold text-ink">
        {children} <span aria-hidden="true">{mark(k)}</span>
      </button>
    </th>
  );

  return (
    <div className="flex flex-col gap-6">
      <form aria-label="Filter plants" onSubmit={(e) => e.preventDefault()} className="card-surface flex flex-col gap-3.5 p-4.5">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <label className="flex flex-[1_1_240px] flex-col gap-1 text-[13px] font-semibold">Search by name
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Common, Latin or Greek name"
              className="min-h-11 rounded-md border border-muted bg-data px-3 text-[15px] font-normal text-ink" />
          </label>
          <div role="group" aria-label="View" className="flex overflow-hidden rounded-md border border-ink">
            {(['table', 'grid'] as const).map((v, i) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
                className={`min-h-11 cursor-pointer px-4 font-semibold ${i ? 'border-l border-ink' : ''} ${view === v ? 'bg-ink text-bg' : 'bg-transparent text-ink'}`}>
                {v === 'table' ? 'Table' : 'Grid'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-7 gap-y-3">
          <fieldset className="m-0 flex flex-wrap items-center gap-1.5 border-0 p-0">
            <legend className="pb-1.5 text-[13px] font-semibold">Risk level</legend>
            <Chip on={risk === 'all'} onClick={() => setRisk('all')}>All</Chip>
            {[5, 4, 3, 2, 1].map((c) => (
              <Chip key={c} on={risk === c} onClick={() => setRisk(c)}>
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm border border-muted" style={{ background: `var(--risk-${c})` }} />{RISK_LABELS[c - 1]}
              </Chip>
            ))}
          </fieldset>
          <fieldset className="m-0 flex flex-wrap items-center gap-1.5 border-0 p-0">
            <legend className="pb-1.5 text-[13px] font-semibold">Identification</legend>
            {(['all', 'certain', 'probable', 'disputed'] as const).map((c) => (
              <Chip key={c} on={conf === c} onClick={() => setConf(c)}>{c === 'all' ? 'All' : c[0].toUpperCase() + c.slice(1)}</Chip>
            ))}
          </fieldset>
          <fieldset className="m-0 flex items-center gap-1.5 border-0 p-0">
            <legend className="pb-1.5 text-[13px] font-semibold">Endemism</legend>
            <Chip on={endemic} onClick={() => setEndemic(!endemic)}>{endemic && <IconCheck />}Greek endemics only</Chip>
          </fieldset>
        </div>
      </form>

      <div className="flex flex-wrap justify-between gap-2 text-[14px] text-muted">
        <span aria-live="polite">Showing <strong className="text-ink">{shown.length}</strong> of {total} species</span>
        <span>Range change = 2050 moderate (SSP2-4.5). Whisker: −80% to +20%, dashed tick at 0, chevron = beyond the axis.</span>
      </div>

      {shown.length === 0 && (
        <div className="card-data flex flex-col items-center gap-2.5 px-6 py-12 text-center">
          <div className="font-serif text-[24px]">No plants match these filters</div>
          <div className="max-w-[420px] text-[14px] text-muted">{filterText} returns no species. Try removing one filter.</div>
          <button type="button" onClick={clearAll} className="btn-secondary min-h-11 cursor-pointer">Clear all filters</button>
        </div>
      )}

      {shown.length > 0 && view === 'table' && (
        <div className="card-data overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[15px]">
            <caption className="px-4 py-3 text-left text-[13px] text-muted">Species ranked by combined risk score. Rank intervals come from 1,000 random weightings.</caption>
            <thead>
              <tr className="border-b-2 border-ink text-left">
                <SortHead k="rank" className="w-[130px] pl-4">Risk rank</SortHead>
                <SortHead k="name">Plant</SortHead>
                <SortHead k="change">Range change 2050</SortHead>
                <th scope="col" className="px-2 text-[13px] font-bold">Greek endemic</th>
                <th scope="col" className="px-2 text-[13px] font-bold">Conservation status</th>
                <th scope="col" className="px-2 pr-4 text-[13px] font-bold">Identification</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const c = p.range_change_pct.ssp245;
                const t = changeText(c);
                return (
                  <tr key={p.slug} className="border-b border-data-rule align-top">
                    <td className="py-3.5 pl-4 pr-2">
                      <div className="text-[20px] font-semibold">{p.risk.rank}</div>
                      {p.risk.rank_lo !== undefined && <div className="text-[12px] text-muted">({p.risk.rank_lo}–{p.risk.rank_hi})</div>}
                      <div className="mt-1"><RiskTag cls={p.risk.class} score={p.risk.score} /></div>
                    </td>
                    <td className="px-2 py-3.5">
                      <a href={plantHref(p.slug)} className="font-semibold text-ink decoration-rule">{p.common_name_en}</a>
                      <div className="latin text-[16px] text-muted">{latinShort(p.accepted_name)}</div>
                      <div lang="grc" className="font-serif text-[16px] text-ochre">{p.greek_name} · Book {roman(p.dmm_book)}</div>
                      {p.low_confidence_model && <div className="mt-1"><LowConfidenceTag /></div>}
                    </td>
                    <td className="px-2 py-3.5">
                      <div><strong className="text-[17px]">{t.med}</strong> <span className="text-[14px] text-muted">({t.lo} to {t.hi})</span></div>
                      <Whisker interval={c} />
                    </td>
                    <td className="px-2 py-3.5">{p.endemic_greece ? `Yes${p.endemic_region ? ` · ${p.endemic_region}` : ''}` : 'No'}</td>
                    <td className="px-2 py-3.5">{p.conservation_category
                      ? <><strong>{p.conservation_category}</strong> <span className="text-muted">{STATUS_NAMES[p.conservation_category] ?? ''}</span></>
                      : <span className="text-muted">Not assessed</span>}</td>
                    <td className="py-3.5 pl-2 pr-4"><ConfidenceBadge level={p.identification_confidence} size="sm" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {shown.length > 0 && view === 'grid' && (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4 p-0">
          {shown.map((p) => {
            const t = changeText(p.range_change_pct.ssp245);
            return (
              <li key={p.slug} className="card-surface flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-muted">No. <strong className="text-ink">{p.risk.rank}</strong>{p.risk.rank_lo !== undefined && ` (${p.risk.rank_lo}–${p.risk.rank_hi})`}</span>
                  <RiskTag cls={p.risk.class} score={p.risk.score} />
                </div>
                <div lang="grc" className="font-serif text-[22px] text-ochre">{p.greek_name}</div>
                <a href={plantHref(p.slug)} className="text-[17px] font-semibold text-ink">{p.common_name_en}</a>
                <div className="latin text-muted">{latinShort(p.accepted_name)}</div>
                <div className="text-[14px]"><strong>{t.med}</strong> <span className="text-muted">({t.lo} to {t.hi}) by 2050</span></div>
                <div className="flex flex-wrap gap-1.5">
                  {p.conservation_category && <Pill>{p.conservation_category}</Pill>}
                  {p.endemic_greece && <Pill>Greek endemic</Pill>}
                  <ConfidenceBadge level={p.identification_confidence} size="sm" />
                  {p.low_confidence_model && <LowConfidenceTag />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
