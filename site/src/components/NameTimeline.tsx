// "Names through time": every dated identification claim for each Dioscoridean name, from the
// Renaissance commentators to modern checklists (pipeline stage 08, lineage.json). Each mark is one
// authority proposing, preferring, rejecting or being cited for a modern taxon. Shape carries the
// stance, so the chart reads without colour.
import { useMemo, useState } from 'react';
import type { Lineage, LineageClaim, Stance } from '../lib/types';
import { plantHref } from '../lib/url';
import { ConfidenceBadge } from './Badges';

const Y0 = 1500, Y1 = 2030;
const ERAS: [number, number, string][] = [
  [1525, 1625, 'Renaissance commentators'], [1750, 1850, 'Linnaean botany & Flora Graeca'], [1890, 1920, 'Edition'], [1990, 2026, 'Modern'],
];
const STANCE_TEXT: Record<Stance, string> = {
  cited: 'Cited for the identification we model', proposed: 'Proposed an alternative', preferred: 'Alternative preferred by our source',
  rejected: 'Alternative rejected by our source', unverified: 'Commonly proposed, not verified by us',
};
const pos = (y: number) => `${(100 * (Math.max(Y0, Math.min(Y1, y)) - Y0)) / (Y1 - Y0)}%`;
const shortAuth = (a: string) => a.split(',')[0];

function Mark({ stance, size = 14 }: { stance: Stance; size?: number }) {
  const s = size, h = s / 2;
  switch (stance) {
    case 'cited': return <svg width={s} height={s} aria-hidden="true"><circle cx={h} cy={h} r={h - 1.5} fill="var(--sage)" stroke="var(--ink)" strokeWidth="1" /></svg>;
    case 'preferred': return <svg width={s} height={s} aria-hidden="true"><path d={`M${h} 1 L${s - 1} ${h} L${h} ${s - 1} L1 ${h} Z`} fill="var(--ochre)" stroke="var(--ink)" strokeWidth="1" /></svg>;
    case 'rejected': return <svg width={s} height={s} aria-hidden="true"><path d={`M3 3 L${s - 3} ${s - 3} M${s - 3} 3 L3 ${s - 3}`} stroke="var(--ochre)" strokeWidth="2.4" strokeLinecap="round" /></svg>;
    case 'unverified': return <svg width={s} height={s} aria-hidden="true"><circle cx={h} cy={h} r={h - 2} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="2 2" /></svg>;
    default: return <svg width={s} height={s} aria-hidden="true"><path d={`M${h} 1.5 L${s - 1.5} ${h} L${h} ${s - 1.5} L1.5 ${h} Z`} fill="var(--data)" stroke="var(--ochre)" strokeWidth="1.8" /></svg>;
  }
}

export function StanceLegend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
      {(['cited', 'proposed', 'preferred', 'rejected', 'unverified'] as Stance[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5"><Mark stance={s} />{STANCE_TEXT[s]}</span>
      ))}
    </div>
  );
}

function Row({ p, onPick, picked }: { p: Lineage; onPick: (c: LineageClaim, p: Lineage) => void; picked: LineageClaim | null }) {
  // Stack marks that fall within ~8 years of each other.
  const lanes: number[] = [];
  const placed = [...p.claims].sort((a, b) => a.year - b.year).map((c) => {
    let lane = lanes.findIndex((last) => c.year - last > 8);
    if (lane === -1) { lane = lanes.length; lanes.push(c.year); } else lanes[lane] = c.year;
    return { c, lane };
  });
  const h = Math.max(1, lanes.length) * 18 + 10;
  return (
    <li className="grid items-center gap-x-4 gap-y-1 border-b border-data-rule py-2.5 [grid-template-columns:minmax(0,1fr)] md:[grid-template-columns:260px_minmax(0,1fr)]">
      <div className="flex flex-col">
        <span lang="grc" className="font-serif text-[20px] leading-tight text-ochre">{p.greek_name}</span>
        <span className="text-[13px] text-muted">DMM {p.book}{p.chapter ? `.${p.chapter}` : ''} · <a href={plantHref(p.slug)} className="text-ink">{p.common_name_en}</a></span>
        <span className="flex flex-wrap items-center gap-1.5 pt-0.5"><em className="font-serif text-[15px]">{p.accepted_name.split(' ').slice(0, 2).join(' ')}</em><ConfidenceBadge level={p.confidence} size="sm" /></span>
      </div>
      <div className="relative" style={{ height: h }}>
        <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-rule" />
        {placed.map(({ c, lane }, i) => {
          const on = picked === c;
          return (
            <button key={i} type="button" onClick={() => onPick(c, p)} aria-pressed={on}
              aria-label={`${c.year}, ${shortAuth(c.authority)}: ${c.taxon}. ${STANCE_TEXT[c.stance]}`}
              className="absolute -translate-x-1/2 cursor-pointer rounded-full border-0 bg-transparent p-0.5 leading-none"
              style={{ left: pos(c.year), top: 5 + lane * 18, outline: on ? '2px solid var(--focus)' : undefined }}>
              <Mark stance={c.stance} />
            </button>
          );
        })}
      </div>
    </li>
  );
}

export default function NameTimeline({ data, single = false }: { data: Lineage[]; single?: boolean }) {
  const [filter, setFilter] = useState<'contested' | 'all'>('contested');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<{ c: LineageClaim; p: Lineage } | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data
      .filter((p) => single || filter === 'all' || p.n_candidates >= 3)
      .filter((p) => !needle || `${p.greek_name} ${p.greek_translit} ${p.common_name_en} ${p.accepted_name} ${p.claims.map((c) => c.taxon + c.authority).join(' ')}`.toLowerCase().includes(needle))
      .sort((a, b) => b.n_candidates - a.n_candidates || a.book - b.book);
  }, [data, filter, q, single]);

  const axis = (
    <div className="grid gap-x-4 [grid-template-columns:minmax(0,1fr)] md:[grid-template-columns:260px_minmax(0,1fr)]">
      <div className="hidden md:block" />
      <div className="relative h-9 text-[12px] text-muted">
        {ERAS.map(([a, b, l]) => (
          <div key={l} className="absolute top-0 h-full border-x border-rule bg-sunk px-1 leading-tight" style={{ left: pos(a), width: `calc(${pos(b)} - ${pos(a)})` }}>
            <span className="line-clamp-2">{l}</span>
          </div>
        ))}
        {[1500, 1600, 1700, 1800, 1900, 2000].map((y) => <span key={y} className="absolute bottom-[-16px] -translate-x-1/2" style={{ left: pos(y) }}>{y}</span>)}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {!single && (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <label className="flex flex-[1_1_240px] flex-col gap-1 text-[13px] font-semibold">Search a name, taxon or authority
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. σιδηρῖτις, Stachys, Matthiolus"
              className="min-h-11 rounded-md border border-muted bg-data px-3 text-[15px] font-normal text-ink" />
          </label>
          <div role="group" aria-label="Which names" className="flex overflow-hidden rounded-md border border-ink">
            {([['contested', 'Contested (3+ candidates)'], ['all', 'All names']] as const).map(([k, l], i) => (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
                className={`min-h-11 cursor-pointer px-4 font-semibold ${i ? 'border-l border-ink' : ''} ${filter === k ? 'bg-ink text-bg' : 'bg-transparent text-ink'}`}>{l}</button>
            ))}
          </div>
        </div>
      )}
      <StanceLegend />
      <div className="card-data px-4 pb-2 pt-3">
        {axis}
        <ul className="m-0 mt-5 list-none p-0">
          {rows.map((p) => <Row key={p.slug} p={p} picked={picked?.c ?? null} onPick={(c, pp) => setPicked({ c, p: pp })} />)}
          {rows.length === 0 && <li className="py-6 text-center text-muted">No names match.</li>}
        </ul>
      </div>
      <div aria-live="polite" className="card-surface flex min-h-[96px] flex-col gap-1.5 px-5 py-4">
        {picked ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <Mark stance={picked.c.stance} /><span>{STANCE_TEXT[picked.c.stance]}</span>
              <span>·</span><span lang="grc" className="font-serif text-[16px] text-ochre">{picked.p.greek_name}</span>
            </div>
            <div className="text-[17px]"><strong>c. {picked.c.year} · {picked.c.authority}</strong>{picked.c.witness && <span className="text-muted"> (reported by {shortAuth(picked.c.witness)})</span>}</div>
            <div className="font-serif text-[19px] italic">{picked.c.taxon}</div>
            <blockquote className="m-0 border-l-2 border-rule pl-3 text-[14px] text-muted">{picked.c.source}</blockquote>
          </>
        ) : <p className="m-0 self-center text-[14px] text-muted">Select a mark to read who proposed which plant, and the source we read it in.</p>}
      </div>
      <p className="m-0 text-[12px] text-muted">Dates are each authority's main herbal or commentary (approximate, "c."), used to order the timeline. Claims are parsed from our curated identification table; every quote links back to a page scan or edition on the plant page.</p>
    </div>
  );
}
