// Horizontal stacked bar of the four weighted risk components, fixed order, gaps between
// segments; zero-value parts stay listed in the legend.
import type { RiskComponents } from '../lib/types';
import { COMPONENT_LABELS, STATUS_NAMES, riskClassOf } from '../lib/format';
import { RiskTag } from './Badges';

const ORDER: (keyof RiskComponents)[] = ['range_loss', 'endemism', 'status', 'harvest'];
const COLOR: Record<keyof RiskComponents, string> = {
  range_loss: 'var(--rb-range-loss)', endemism: 'var(--rb-endemism)', status: 'var(--rb-status)', harvest: 'var(--rb-harvest)',
};

export function RiskBreakdown({ score, lo, hi, components, weights, ci, endemic, statusCategory, compact = false }: {
  score: number; lo?: number; hi?: number; components: RiskComponents; weights: RiskComponents;
  ci?: Partial<Record<keyof RiskComponents, [number, number]>>; endemic: boolean; statusCategory?: string | null; compact?: boolean;
}) {
  const wsum = ORDER.reduce((s, k) => s + weights[k], 0);
  const part = (k: keyof RiskComponents) => (components[k] * weights[k]) / wsum;
  const max = (k: keyof RiskComponents) => weights[k] / wsum;
  const cls = riskClassOf(score);
  const aria = `Risk score ${score.toFixed(2)} composed of ` + ORDER.map((k) => `${COMPONENT_LABELS[k].toLowerCase()} ${part(k).toFixed(2)}`).join(', ');
  const note = (k: keyof RiskComponents) => {
    if (k === 'endemism') return endemic ? 'endemic to Greece' : 'not endemic';
    if (k === 'status') return statusCategory ? `${statusCategory}${STATUS_NAMES[statusCategory] ? ` · ${STATUS_NAMES[statusCategory]}` : ''}` : 'not assessed';
    const c = ci?.[k];
    return c ? `(${(c[0] * max(k)).toFixed(2)}–${(c[1] * max(k)).toFixed(2)})` : '';
  };
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span>
          <strong className={`font-semibold ${compact ? 'text-[28px]' : 'text-[30px]'}`}>{score.toFixed(2)}</strong>{' '}
          {lo !== undefined && hi !== undefined && <span className="text-muted">({lo.toFixed(2)}–{hi.toFixed(2)})</span>}
        </span>
        <span className="text-[13px]"><RiskTag cls={cls} size="md" />{' '}<span className="sr-only">risk class {cls}</span></span>
      </div>
      <div role="img" aria-label={aria} className="flex h-7 overflow-hidden rounded-sm bg-sunk">
        {ORDER.filter((k) => part(k) > 0).map((k) => (
          <div key={k} style={{ width: `${part(k) * 100}%`, background: COLOR[k], borderRight: '2px solid var(--data)' }} />
        ))}
      </div>
      {!compact && <div className="flex justify-between text-[12px] text-muted"><span>0</span><span>0.5</span><span>1.0</span></div>}
      <ul className="m-0 grid list-none gap-2 p-0 text-[14px] sm:grid-cols-2 sm:gap-x-5">
        {ORDER.map((k) => (
          <li key={k} className="flex items-baseline gap-2.5">
            <span className="h-3 w-3 flex-none" aria-hidden="true"
              style={part(k) > 0 ? { background: COLOR[k] } : { border: '1px dashed var(--muted)', boxSizing: 'border-box' }} />
            <span><strong>{COMPONENT_LABELS[k]}</strong> {part(k).toFixed(2)}{' '}
              <span className="text-muted">of max {max(k).toFixed(2)}{note(k) ? ` · ${note(k)}` : ''}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
