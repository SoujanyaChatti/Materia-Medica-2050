// Inline stroke icons (text-coloured via currentColor). Decorative: aria-hidden.
type P = { size?: number; className?: string };
const svg = (size: number, className?: string) => ({ width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true as const, className, focusable: false as const });

export const IconCertain = ({ size = 16, className }: P) => (
  <svg {...svg(size, className)}><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M5 8.2l2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const IconProbable = ({ size = 16, className }: P) => (
  <svg {...svg(size, className)}><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" /></svg>
);
export const IconDisputed = ({ size = 16, className }: P) => (
  <svg {...svg(size, className)}><path d="M8 1.8L14.6 13.8H1.4Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M8 6v3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="8" cy="11.6" r="0.9" fill="currentColor" /></svg>
);
export const IconAlert = ({ size = 16, className }: P) => (
  <svg {...svg(size, className)}><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 4.6v4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="8" cy="11.2" r="0.9" fill="currentColor" /></svg>
);
export const IconNone = ({ size = 16, className }: P) => (
  <svg {...svg(size, className)}><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M5 8h6" stroke="currentColor" strokeWidth="1.4" /></svg>
);
export const IconArrow = ({ size = 16, className }: P) => (
  <svg {...svg(size, className)}><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const IconReset = ({ size = 16, className }: P) => (
  <svg {...svg(size, className)}><path d="M3 8a5 5 0 1 0 1.5-3.6M3 2.5v2.5h2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const IconCheck = ({ size = 12, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" className={className}><path d="M2 6.2l2.6 2.6L10 3.4" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
);
export const Spinner = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" className="motion-safe:animate-spin">
    <circle cx="9" cy="9" r="7" fill="none" stroke="var(--data-rule)" strokeWidth="2" />
    <path d="M9 2a7 7 0 0 1 7 7" fill="none" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
