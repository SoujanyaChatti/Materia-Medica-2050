"""Stage 11 — export the identification-sensitivity result for the site.

Reads outputs/identification_sensitivity.{csv,json}, outputs/risk.csv, outputs/cultivation.csv,
outputs/model_grades.csv and the curated species list; writes site/public/data/identification.json
and validates it against site/schema/identification.schema.json. Standard formatting only, no science.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd  # noqa: E402

from pipeline.lib import config, io, schema  # noqa: E402

OUT = config.SITE_DATA / "identification.json"


def num(v, nd=3):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else round(f, nd)


def main() -> None:
    res = pd.read_csv(config.OUTPUTS / "identification_sensitivity.csv")
    summ = json.loads((config.OUTPUTS / "identification_sensitivity.json").read_text())
    rk = pd.read_csv(config.OUTPUTS / "risk.csv").set_index("slug")
    cult = pd.read_csv(config.OUTPUTS / "cultivation.csv").set_index("slug")
    grades = pd.read_csv(config.OUTPUTS / "model_grades.csv")
    grades = grades[grades["kind"] == "published"].set_index("plant")
    sp = pd.read_csv(config.CURATED / "species.csv", dtype=str, keep_default_na=False).set_index("slug")
    others = lambda slug: rk["score"].drop(slug)  # noqa: E731
    plants = []
    for slug, g in res.groupby("slug", sort=False):
        s, r = sp.loc[slug], rk.loc[slug]
        c = cult.loc[slug] if slug in cult.index else None
        published = {
            "taxon": s["accepted_name"], "source": s["identification_source"][:400],
            # Rank at the high and low end of the score across climate models, others fixed: the same
            # definition as each candidate's range (risk.csv's rank_lo/hi come from random weightings instead).
            "rank": int(r["rank"]), "rank_lo": int((others(slug) > r["score_hi"]).sum() + 1),
            "rank_hi": int((others(slug) > r["score_lo"]).sum() + 1),
            "score": num(r["score"]), "score_lo": num(r["score_lo"]), "score_hi": num(r["score_hi"]),
            "range_change": {"median": num(r["range_change_median"], 1), "min": num(r["range_change_min"], 1),
                             "max": num(r["range_change_max"], 1)},
            "cultivation_km2": None if c is None else {"median": num(c["area_ssp245"], 0), "min": num(c["area_ssp245_lo"], 0),
                                                       "max": num(c["area_ssp245_hi"], 0)},
            "grade": grades.loc[slug, "grade"], "auc": num(grades.loc[slug, "auc"]), "baseline_auc": num(grades.loc[slug, "baseline_auc"]),
        }
        cands = []
        for _, x in g.iterrows():
            modelled = not pd.isna(x.get("rank"))
            cands.append({
                "taxon_as_cited": x["candidate_as_cited"], "query_name": x["query_name"], "source": str(x["source"])[:600],
                "records": int(x["records_thinned"]), "grade": x["model_grade"], "note": None if pd.isna(x.get("note")) else x["note"],
                "auc": num(x.get("auc")), "baseline_auc": num(x.get("baseline_auc")),
                "rank": int(x["rank"]) if modelled else None,
                "rank_lo": int(x["rank_lo"]) if modelled else None, "rank_hi": int(x["rank_hi"]) if modelled else None,
                "score": num(x.get("risk_score")), "score_lo": num(x.get("risk_score_lo")), "score_hi": num(x.get("risk_score_hi")),
                "range_change": None if pd.isna(x.get("range_change_median")) else
                {"median": num(x["range_change_median"], 1), "min": num(x["range_change_min"], 1), "max": num(x["range_change_max"], 1)},
                "cultivation_km2": None if pd.isna(x.get("cultivation_km2")) else
                {"median": num(x["cultivation_km2"], 0), "min": num(x["cultivation_km2_min"], 0), "max": num(x["cultivation_km2_max"], 0)},
                "in_top10": bool(x["in_top10"]) if modelled else None,
            })
        pp = summ["per_plant"][slug]
        plants.append({"slug": slug, "common_name_en": s["common_name_en"], "greek_name": s["greek_name"],
                       "published": published, "candidates": cands,
                       "rank_min": pp["rank_min"], "rank_max": pp["rank_max"],
                       "top10_status_changes": pp["top10_status_changes"]})
    plants.sort(key=lambda p: p["published"]["rank"])
    doc = {"summary": {k: summ[k] for k in ("candidates", "modelled", "data_gap", "plants_entering_top10_under_some_alternative",
                                              "plants_leaving_top10_under_some_alternative", "plants_moving_in_or_out_of_top10",
                                              "disputed_plants_whose_own_top10_status_can_change", "held_fixed")},
           "n_species": int(len(rk)), "top_n": config.TOP_N, "plants": plants}
    errs = schema.errors("identification", doc)
    if errs:
        raise SystemExit("identification.json fails its schema:\n" + "\n".join(errs[:20]))
    io.write_json(OUT, doc)
    print(f"wrote {OUT} ({len(plants)} plants, {sum(len(p['candidates']) for p in plants)} candidates); schema OK")


if __name__ == "__main__":
    main()
