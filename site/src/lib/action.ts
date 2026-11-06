// Decision rules that turn published model outputs into an action plan. These are not new science:
// every input is a number the pipeline exported, and every threshold is printed on the page.
import type { RiskComponents, Species } from './types';

export const LOSS_STRONG = -30; // % range change (median of 3 climate models) counted as severe loss

export type Quadrant = 'protect_cultivate' | 'protect_only' | 'opportunity' | 'monitor';
export interface Action {
  slug: string; name: string; latin: string; greek: string; rank: number; score: number; riskClass: number;
  change: number; changeLo: number; changeHi: number; allAgreeLoss: boolean; cultKm2: number;
  ema: boolean; disputed: boolean; lowModel: boolean; endemic: boolean; quadrant: Quadrant; dataFirst: boolean;
}

export const QUADRANTS: Record<Quadrant, { title: string; verb: string; rule: string }> = {
  protect_cultivate: { title: 'Protect and cultivate', verb: 'Protect remaining wild stands and start cultivation in the 2050 zones', rule: 'Loses habitat in all 3 climate models · has a 2050 cultivation zone' },
  protect_only: { title: 'Protect: no cultivation fallback', verb: 'Prioritise in-situ protection and seed banking; no suitable farmland found', rule: 'Loses habitat in all 3 climate models · no 2050 cultivation zone' },
  opportunity: { title: 'Cultivation opportunity', verb: 'Climate-resilient candidate crop; cultivation can take pressure off wild collection', rule: 'Gains or keeps habitat · has a 2050 cultivation zone' },
  monitor: { title: 'Monitor', verb: 'Stable or expanding; keep watching harvest and status', rule: 'Gains or keeps habitat · no 2050 cultivation zone' },
};

export function toAction(sp: Species): Action {
  const c = sp.range_change_pct.ssp245;
  const lo = Math.min(c.min, c.max), hi = Math.max(c.min, c.max);
  const allAgreeLoss = hi < 0;
  const cult = sp.cultivation_area_km2 ?? 0;
  const quadrant: Quadrant = allAgreeLoss ? (cult > 0 ? 'protect_cultivate' : 'protect_only') : cult > 0 ? 'opportunity' : 'monitor';
  return {
    slug: sp.slug, name: sp.common_name_en, latin: sp.accepted_name.split(' ').slice(0, 2).join(' '), greek: sp.dioscorides.greek_name,
    rank: sp.risk.rank, score: sp.risk.score, riskClass: sp.risk.class ?? 1, change: c.median, changeLo: lo, changeHi: hi, allAgreeLoss,
    cultKm2: cult, ema: !!sp.ema_monograph?.exists, disputed: sp.identification.confidence === 'disputed',
    lowModel: sp.records.low_confidence_model, endemic: sp.endemic_greece, quadrant,
    dataFirst: sp.identification.confidence === 'disputed' || sp.records.low_confidence_model,
  };
}

/** Weighted risk score exactly as pipeline stage 05 computes it (weights are renormalised). */
export function score(c: RiskComponents, w: RiskComponents): number {
  const s = w.range_loss + w.endemism + w.status + w.harvest;
  if (s <= 0) return 0;
  return (c.range_loss * w.range_loss + c.endemism * w.endemism + c.status * w.status + c.harvest * w.harvest) / s;
}

/** Kendall's tau-b between two rankings given as arrays of ranks in the same item order. */
export function kendallTau(a: number[], b: number[]): number {
  let con = 0, dis = 0, ta = 0, tb = 0;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
    const x = Math.sign(a[i] - a[j]), y = Math.sign(b[i] - b[j]);
    if (x === 0 && y === 0) continue;
    if (x === 0) ta++; else if (y === 0) tb++; else if (x === y) con++; else dis++;
  }
  const d = Math.sqrt((con + dis + ta) * (con + dis + tb));
  return d ? (con - dis) / d : 1;
}

/** Ranks (1 = highest score) with ties broken by the published rank, as the pipeline does. */
export function rankBy(scores: number[], tiebreak: number[]): number[] {
  const idx = scores.map((_, i) => i).sort((i, j) => scores[j] - scores[i] || tiebreak[i] - tiebreak[j]);
  const r = new Array(scores.length);
  idx.forEach((i, k) => { r[i] = k + 1; });
  return r;
}
