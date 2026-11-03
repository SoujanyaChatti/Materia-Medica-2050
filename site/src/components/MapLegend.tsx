// Map legend: colour + pattern + line, always with text. Never colour alone.
import { RISK_LABELS, RISK_RANGES } from '../lib/format';

type Item = 'current' | 'kept' | 'lost' | 'gained' | 'cult' | 'natura' | 'occ';

const Swatch = ({ item }: { item: Item }) => {
  switch (item) {
    case 'current': case 'kept': return <span aria-hidden="true" className="h-3.5 w-3.5 flex-none" style={{ background: 'var(--map-kept)' }} />;
    case 'lost': return <span aria-hidden="true" className="hatch-lost h-3.5 w-3.5 flex-none" />;
    case 'gained': return <span aria-hidden="true" className="h-3.5 w-3.5 flex-none" style={{ background: 'var(--map-gain)' }} />;
    case 'cult': return <span aria-hidden="true" className="hatch-cult h-3.5 w-3.5 flex-none" />;
    case 'natura': return <span aria-hidden="true" className="h-0 w-4 flex-none" style={{ borderTop: '2px dashed var(--map-natura)' }} />;
    case 'occ': return <span aria-hidden="true" className="h-3.5 w-3.5 flex-none box-border" style={{ border: '1.5px solid var(--map-occ)' }} />;
  }
};
const TEXT: Record<Item, string> = {
  current: 'Current range', kept: 'Range kept', lost: 'Lost by 2050', gained: 'Gained by 2050',
  cult: 'Cultivation zone', natura: 'Natura 2000', occ: 'Occurrence cell',
};

export function LegendItem({ item, label }: { item: Item; label?: string }) {
  return <span className="inline-flex items-center gap-2"><Swatch item={item} />{label ?? TEXT[item]}</span>;
}

export function MapLegend({ items, note, layout = 'row' }: { items: Item[]; note?: string; layout?: 'row' | 'column' }) {
  return (
    <div className={layout === 'row'
      ? 'card-data flex flex-wrap gap-x-5 gap-y-2.5 px-4 py-3 text-[14px]'
      : 'flex flex-col gap-1.5 text-[13px]'}>
      {items.map((i) => <LegendItem key={i} item={i} />)}
      {note && <span className="text-muted">{note}</span>}
    </div>
  );
}

export function RiskLegend() {
  return (
    <div className="flex flex-col gap-1 text-[13px]">
      {[5, 4, 3, 2, 1].map((c) => (
        <span key={c} className="flex items-center gap-2">
          <span aria-hidden="true" className="box-border h-3 w-[18px]" style={{ background: `var(--risk-${c})`, border: c === 1 ? '1px solid var(--rule)' : undefined }} />
          {c} {RISK_LABELS[c - 1]} · {RISK_RANGES[c - 1]}
        </span>
      ))}
    </div>
  );
}
