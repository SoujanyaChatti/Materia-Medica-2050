// Types mirror site/schema/*.json (the data contract written by pipeline/07_export_web.py).
export type Confidence = 'certain' | 'probable' | 'disputed';
export type ScenarioKey = 'now' | 'ssp245' | 'ssp585';
export type FutureKey = Exclude<ScenarioKey, 'now'>;
export interface Interval { median: number; min: number; max: number }

export interface SpeciesSummary {
  slug: string;
  accepted_name: string;
  common_name_en: string;
  greek_name: string;
  dmm_book: number;
  identification_confidence: Confidence;
  endemic_greece: boolean;
  endemic_region?: string | null;
  conservation_category?: string | null;
  low_confidence_model: boolean;
  risk: { score: number; score_lo?: number; score_hi?: number; rank: number; rank_lo?: number; rank_hi?: number; class: number };
  range_change_pct: Record<FutureKey, Interval>;
  model?: { auc_mean: number; auc_sd: number; boyce_mean: number; tss_mean?: number; tss_sd?: number; baseline_auc?: number; grade?: 'standard' | 'low' | 'data gap'; beats_baseline?: boolean } | null;
  records_clean?: number;
}

export interface RiskComponents { range_loss: number; endemism: number; status: number; harvest: number }

export interface Species {
  slug: string;
  accepted_name: string;
  common_name_en: string;
  family?: string | null;
  dioscorides: {
    book: number; chapter: number | null; greek_name: string; greek_translit?: string | null;
    excerpt: string | null; paraphrase?: string | null; paraphrase_ai_assisted?: boolean; edition: string; excerpt_url?: string | null;
  };
  identification: {
    confidence: Confidence; source: string; note?: string | null; reviewed_by?: string | null;
    alternatives?: { name: string; source: string }[];
  };
  endemic_greece: boolean;
  endemic_region?: string | null;
  conservation_status?: { category: string; source: string } | null;
  ema_monograph?: { exists: boolean; use?: string | null; name?: string | null; reference?: string | null; url?: string | null } | null;
  records: { raw: number; clean: number; thinned?: number; public_cells?: number; low_confidence_model: boolean };
  model: { auc_mean: number; auc_sd: number; boyce_mean: number; boyce_sd?: number; tss_mean?: number; tss_sd?: number; null_auc_mean?: number; baseline_auc?: number; grade?: 'standard' | 'low' | 'data gap'; beats_baseline?: boolean; variables?: string[] } | null;
  range_change_pct: Record<FutureKey, Interval>;
  range_cells?: { now?: number } & Partial<Record<FutureKey, Interval>>;
  natura_share_pct?: { now?: number } & Partial<Record<FutureKey, Interval>>;
  risk: {
    score: number; score_lo?: number; score_hi?: number; rank: number; rank_lo?: number; rank_hi?: number;
    rank_without_disputed?: number | null; class?: number; top10_stability: number;
    components: RiskComponents; components_ci?: Partial<Record<keyof RiskComponents, [number, number]>>;
  };
  cultivation_area_km2: number | null;
  cultivation_area_km2_range?: { min: number; max: number } | null;
  caveats: string[];
}

export interface Meta {
  sample: boolean;
  build_date: string;
  gbif_doi: string | null;
  versions: Record<string, string>;
  n_species: number;
  scenarios: Record<ScenarioKey, { label: string; title: string; description: string }>;
  gcms: string[];
  risk_weights: RiskComponents;
  cell_km: number;
  headline_slug: string;
  summary: { median_range_change_ssp245?: Interval };
  sensitivity: {
    draws: number; perturbation?: number; top_k: number; top_k_unchanged: Interval;
    top10_overlap_without_disputed?: number;
    one_at_a_time: Partial<Record<keyof RiskComponents, { tau_median: number; tau_lo: number; tau_hi: number }>>;
  };
}

/** lineage.json (pipeline stage 08): every dated identification claim per plant. */
export type Stance = 'cited' | 'proposed' | 'preferred' | 'rejected' | 'unverified';
export interface LineageClaim { taxon: string; role: 'modelled' | 'alternative'; year: number; authority: string; witness: string | null; stance: Stance; source: string }
export interface Lineage {
  slug: string; greek_name: string; greek_translit: string; book: number; chapter: number | null;
  accepted_name: string; common_name_en: string; confidence: Confidence; ema: boolean; n_candidates: number; claims: LineageClaim[];
}

export interface IdInterval { median: number | null; min: number | null; max: number | null }
export interface IdCandidate {
  taxon_as_cited: string; query_name: string; source: string; records: number; grade: 'standard' | 'low' | 'data gap'; note?: string | null;
  auc?: number | null; baseline_auc?: number | null; rank: number | null; rank_lo?: number | null; rank_hi?: number | null;
  score?: number | null; score_lo?: number | null; score_hi?: number | null; range_change?: IdInterval | null; cultivation_km2?: IdInterval | null; in_top10?: boolean | null;
}
export interface IdPlant {
  slug: string; common_name_en: string; greek_name: string; rank_min: number | null; rank_max: number | null; top10_status_changes: boolean;
  published: { taxon: string; source: string; rank: number; rank_lo: number; rank_hi: number; score: number; score_lo: number; score_hi: number;
    range_change: IdInterval; cultivation_km2: IdInterval | null; grade: string; auc: number; baseline_auc: number };
  candidates: IdCandidate[];
}
export interface Identification {
  summary: { candidates: number; modelled: number; data_gap: number; plants_entering_top10_under_some_alternative: string[];
    plants_leaving_top10_under_some_alternative: string[]; plants_moving_in_or_out_of_top10: number;
    disputed_plants_whose_own_top10_status_can_change: string[]; held_fixed: string };
  n_species: number; top_n: number; plants: IdPlant[];
}
