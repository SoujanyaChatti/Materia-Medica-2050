// Formatting rules from the design system: U+2212 minus, sign on every change, interval always shown.
import type { Interval } from './types';

export const MINUS = '−';

export function signed(v: number, unit = '%', digits = 0): string {
  const r = Number(v.toFixed(digits));
  const s = r > 0 ? '+' : r < 0 ? MINUS : '';
  return `${s}${Math.abs(r).toFixed(digits)}${unit}`;
}

export function num(v: number, digits = 2): string {
  return v.toFixed(digits).replace('-', MINUS);
}

export function thousands(v: number): string {
  return Math.round(v).toLocaleString('en-GB');
}

/** Interval ends sorted so text reads "(−22 to −55%)": the end closer to zero first for losses. */
export function ends(i: Interval): [number, number] {
  const a = Math.min(i.min, i.max), b = Math.max(i.min, i.max);
  return i.median < 0 ? [b, a] : [a, b];
}

/** "−38% (−22 to −55%)" */
export function changeText(i: Interval): { med: string; lo: string; hi: string; full: string } {
  const [lo, hi] = ends(i);
  const med = signed(i.median), l = signed(lo, ''), h = signed(hi);
  return { med, lo: l, hi: h, full: `${med} (${l} to ${h})` };
}

/** Whisker x-position: axis −80% → +20% mapped to 10…110 in a 120-wide viewBox; 0 sits at x=90. */
export const wx = (v: number) => Math.max(10, Math.min(110, v + 90));

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
export const roman = (n: number) => ROMAN[n] ?? String(n);

export const RISK_LABELS = ['Low', 'Moderate', 'Elevated', 'High', 'Very high'] as const;
export const RISK_RANGES = ['0–0.2', '0.2–0.4', '0.4–0.6', '0.6–0.8', '0.8–1.0'] as const;
export const riskLabel = (cls: number) => RISK_LABELS[Math.max(1, Math.min(5, cls)) - 1];
export const riskClassOf = (score: number) => Math.min(Math.floor(Math.max(0, Math.min(1, score)) / 0.2) + 1, 5);

export const STATUS_NAMES: Record<string, string> = {
  LC: 'Least Concern', NT: 'Near Threatened', VU: 'Vulnerable', EN: 'Endangered', CR: 'Critically Endangered',
  DD: 'Data Deficient', NE: 'Not Evaluated',
};

export const COMPONENT_LABELS = {
  range_loss: 'Range loss', endemism: 'Endemism', status: 'Conservation status', harvest: 'Harvest pressure',
} as const;
