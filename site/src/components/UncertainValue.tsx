// "Uncertainty number": a value with its interval in text, plus an optional whisker bar.
// Whisker axis −80% → +20%; dashed tick marks 0; a chevron at either end means the value runs off the axis.
// The text always carries the interval.
import type { Interval } from '../lib/types';
import { changeText, ends, wx } from '../lib/format';

export function Whisker({ interval, width = 120, label, fill = 'var(--data)' }: { interval: Interval; width?: number; label?: string; fill?: string }) {
  const [a, b] = ends(interval);
  const x1 = wx(Math.min(a, b)), x2 = wx(Math.max(a, b)), xm = wx(interval.median);
  const t = changeText(interval);
  return (
    <svg width={width} height={(18 * width) / 120} viewBox="0 0 120 18" className="shrink-0"
      {...(label ? { role: 'img', 'aria-label': `${label}: median ${t.med}, range ${t.lo} to ${t.hi}` } : { 'aria-hidden': true })}>
      <line x1="10" y1="9" x2="110" y2="9" stroke="var(--rule)" strokeWidth="1" />
      <line x1="90" y1="3" x2="90" y2="15" stroke="var(--muted)" strokeWidth="1" strokeDasharray="2 2" />
      <line x1={x1} y1="9" x2={x2} y2="9" stroke="var(--ink)" strokeWidth="2" />
      <line x1={x1} y1="5" x2={x1} y2="13" stroke="var(--ink)" strokeWidth="1.5" />
      <line x1={x2} y1="5" x2={x2} y2="13" stroke="var(--ink)" strokeWidth="1.5" />
      <circle cx={xm} cy="9" r="3.5" fill={fill} stroke="var(--ink)" strokeWidth="1.8" />
      {Math.max(a, b) > 20 && <path d="M113 4.5 L118 9 L113 13.5" fill="none" stroke="var(--ink)" strokeWidth="1.6" />}
      {Math.min(a, b) < -80 && <path d="M7 4.5 L2 9 L7 13.5" fill="none" stroke="var(--ink)" strokeWidth="1.6" />}
    </svg>
  );
}

export function UncertainValue({ interval, size = 18, whisker = false, whiskerWidth = 120, label, fill }: {
  interval: Interval; size?: number; whisker?: boolean; whiskerWidth?: number; label?: string; fill?: string;
}) {
  const t = changeText(interval);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span>
        <strong className="font-semibold" style={{ fontSize: size }}>{t.med}</strong>{' '}
        <span className="text-muted">({t.lo} to {t.hi})</span>
      </span>
      {whisker && <Whisker interval={interval} width={whiskerWidth} label={label} fill={fill} />}
    </span>
  );
}
