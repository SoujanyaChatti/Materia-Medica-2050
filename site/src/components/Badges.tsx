// Confidence badge (three cues per state: icon, text, shape) and the small tags used beside plants.
import type { Confidence } from '../lib/types';
import { riskLabel } from '../lib/format';
import { IconCertain, IconDisputed, IconProbable } from './icons';

const LABEL: Record<Confidence, string> = { certain: 'Certain', probable: 'Probable', disputed: 'Disputed' };

export function ConfidenceBadge({ level, size = 'md', prefix }: { level: Confidence; size?: 'sm' | 'md'; prefix?: string }) {
  const sm = size === 'sm';
  const base = `inline-flex items-center gap-1.5 whitespace-nowrap ${sm ? 'text-[12px] px-2 py-px' : 'text-[13px] px-2.5 py-0.5'}`;
  const icon = sm ? 13 : 15;
  const text = `${prefix ?? ''}${LABEL[level]}`;
  if (level === 'certain')
    return <span className={`${base} rounded-full border border-sage bg-sage-tint font-semibold text-sage`}><IconCertain size={icon} />{text}</span>;
  if (level === 'probable')
    return <span className={`${base} rounded-full border border-dashed border-muted bg-surface font-semibold text-ink`}><IconProbable size={icon} />{text}</span>;
  return <span className={`${base} rounded-md border border-ochre bg-ochre-tint font-bold text-ochre`}><IconDisputed size={icon} />{text}</span>;
}

/** Risk class tag. Colour is never alone: it always carries the class name and usually the score. */
export function RiskTag({ cls, score, showClassNumber = false, size = 'sm' }: { cls: number; score?: number; showClassNumber?: boolean; size?: 'sm' | 'md' }) {
  const label = `${showClassNumber ? `${cls} · ` : ''}${riskLabel(cls)}`;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-sm font-semibold ${size === 'sm' ? 'px-2 py-px text-[12px]' : 'px-2.5 py-0.5 text-[13px]'}`}
      style={{ background: `var(--risk-${cls})`, color: `var(--on-risk-${cls})` }}
    >
      {score !== undefined ? `${score.toFixed(2)} · ` : ''}{label}
    </span>
  );
}

export const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-block whitespace-nowrap rounded-full border border-rule px-2.5 py-px text-[12px]">{children}</span>
);

export const LowConfidenceTag = () => (
  <span className="inline-block whitespace-nowrap rounded-full border border-warn-border px-2.5 py-px text-[12px] font-semibold text-warn">Low-confidence model</span>
);

export function PlantFlags({ confidence, endemic, lowConfidence, showConfidence = true }: { confidence: Confidence; endemic: boolean; lowConfidence: boolean; showConfidence?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {showConfidence && <ConfidenceBadge level={confidence} size="sm" />}
      {!showConfidence && confidence === 'disputed' && <ConfidenceBadge level="disputed" size="sm" />}
      {endemic && <Pill>Greek endemic</Pill>}
      {lowConfidence && <LowConfidenceTag />}
    </div>
  );
}
