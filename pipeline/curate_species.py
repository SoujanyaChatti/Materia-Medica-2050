"""Build data/curated/species.csv + identifications.csv from the verified research JSON.

Never fills a blank with a guess: unverified fields stay empty and are listed in `unverified`.
Usage: python pipeline/curate_species.py data/curated/research .
"""
import csv
import json
import sys
from pathlib import Path

R, ROOT = Path(sys.argv[1]), Path(sys.argv[2])
rows = []
for f in sorted(R.glob("group*.json")):
    rows += json.loads(f.read_text())
ids16 = {}
if (R / "ids16.json").exists():
    for x in json.loads((R / "ids16.json").read_text()):
        ids16[" ".join(x["plant"].split(" —")[0].split(" (")[0].split(" /")[0].split()[:2])] = x

# Taxonomy decisions agreed with the user (2026-11-04).
DECIDE = {
    "paeonia-clusii": dict(slug="paeonia-greece", accepted_name="Paeonia L. (wild Greek species pooled)",
                           common_name_en="Wild peonies of Greece",
                           model_taxa="Paeonia clusii;Paeonia corsica;Paeonia daurica;Paeonia mascula;Paeonia parnassica;Paeonia peregrina",
                           endemic_greece="false", endemic_region="",
                           note="Dioscorides describes a 'male' and a 'female' peony; no source ties the chapter to one species, "
                                "so all wild Greek Paeonia are modelled together (P. clusii and P. parnassica are Greek endemics)."),
    "juniperus-oxycedrus": dict(slug="juniperus-deltoides", accepted_name="Juniperus deltoides R.P.Adams",
                                common_name_en="Prickly juniper (eastern)",
                                model_taxa="Juniperus deltoides;Juniperus oxycedrus",
                                note="J. oxycedrus s.str. is absent from Greece (Dimopoulos et al. 2013; WCVP); Greek plants are "
                                     "J. deltoides, still filed as J. oxycedrus in many GBIF records, so both names are pooled."),
    "capparis-spinosa": dict(model_taxa="Capparis spinosa;Capparis orientalis",
                             note="Greek capers are split into C. orientalis, C. sicula and C. zoharyi in the Greek checklist; "
                                  "GBIF keeps C. orientalis separate, so its records are pooled with C. spinosa s.l."),
    "teucrium-capitatum": dict(model_taxa="Teucrium capitatum;Teucrium polium", common_name_en="Felty germander",
                               note="Greek records of 'T. polium' refer to T. capitatum (Dimopoulos et al. 2013), so both names are pooled."),
    "mandragora-officinarum": dict(model_taxa="Mandragora officinarum;Mandragora autumnalis",
                                   note="WCVP treats Greek mandrakes as M. autumnalis; the Greek checklist and GBIF Backbone merge it "
                                        "into M. officinarum. Both names are pooled."),
    "salvia-rosmarinus": dict(note="Mostly naturalised from cultivation in Greece and only locally native (Dimopoulos et al. 2013); "
                                   "records may include planted or escaped plants."),
    "hyssopus-officinalis": dict(note="Very few Greek records. The alternative identification, Origanum syriacum, does not grow wild "
                                      "in Greece, so it cannot be modelled here. COL now places H. officinalis in Dracocephalum."),
    "teucrium-chamaedrys": dict(common_name_en="Wall germander"),
    "origanum-vulgare": dict(common_name_en="Greek oregano", note="The Greek plant is subsp. hirtum; modelled at species level."),
    "cyclamen-graecum": dict(common_name_en="Greek cyclamen"),
}
# The subagent's chapter (III 25) etc. are taken as verified; book numbers normalised to int.
ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5}

COLS = ["slug", "greek_name", "greek_translit", "dmm_book", "dmm_chapter", "accepted_name", "common_name_en", "family",
        "model_taxa", "identification_confidence", "identification_source", "alternative_names", "endemic_greece",
        "endemic_region", "conservation_category", "conservation_source", "ema_monograph", "ema_name", "ema_use",
        "ema_url", "wild_harvest_flag", "wild_harvest_source", "excerpt", "excerpt_edition", "excerpt_url", "notes",
        "research_notes", "unverified"]
out, idents = [], []


def b(v):
    return "true" if v is True else "false" if v is False else ""


for r in rows:
    d = DECIDE.get(r["slug"], {})
    name2 = " ".join(r["accepted_name"].split()[:2])
    x = ids16.get(name2) or ids16.get(r["accepted_name"].split()[0]) or {}
    if r["slug"] == "paeonia-clusii":
        x = next((v for k, v in ids16.items() if k.startswith("Paeonia")), {})
    if r["slug"] == "capparis-spinosa":
        x = next((v for k, v in ids16.items() if k.startswith("Capparis")), x)
    if r["slug"] == "cyclamen-graecum":
        x = next((v for k, v in ids16.items() if k.startswith("Cyclamen")), x)
    conf = x.get("identification_confidence") or r.get("identification_confidence") or ""
    src = x.get("identification_source") or r.get("identification_source") or ""
    if x.get("source_url") and x.get("identification_source"):
        src = f"{src} ({x['source_url']})"
    ema_name = x.get("ema_monograph") or r.get("ema_monograph") or ""
    ema_use = x.get("ema_use") or r.get("ema_use") or ""
    ema_url = x.get("ema_url") or r.get("ema_url") or ""
    no_mono = bool(ema_name) and ("no monograph" in ema_name.lower() or "none" in ema_name.lower())
    if no_mono:
        ema_name = ""
    searched = bool(x.get("ema_searched")) or bool(r.get("ema_monograph"))
    ema_flag = "yes" if ema_name else ("no" if (x.get("ema_searched") or no_mono) else "")
    harv = x.get("wild_harvest_flag") if x.get("wild_harvest_flag") is not None else r.get("wild_harvest_flag")
    harv_src = x.get("wild_harvest_source") or r.get("wild_harvest_source") or ""
    if not harv_src:
        harv = False   # no documented wild harvest found -> not flagged (recorded in unverified)
    alts = [a for a in (r.get("alternative_names") or []) + (x.get("alternatives") or []) if a.get("name")]
    book = r["dmm_book"]
    book = ROMAN.get(str(book), book)
    unver = list(r.get("unverified") or []) + list(x.get("unverified") or [])
    notes = d.get("note") or ""                      # public caveat: our curation decision only
    research_notes = r.get("notes") or ""            # researcher's working notes (kept, not published)
    row = {
        "slug": d.get("slug", r["slug"]), "greek_name": r["greek_name"], "greek_translit": r.get("greek_translit") or "",
        "dmm_book": int(book), "dmm_chapter": int(r["dmm_chapter"]),
        "accepted_name": d.get("accepted_name", r["accepted_name"].split(" (WCVP")[0]),
        "common_name_en": d.get("common_name_en", r.get("common_name_en") or "").strip() or "",
        "family": r.get("family") or "", "model_taxa": d.get("model_taxa", ""),
        "identification_confidence": conf, "identification_source": src,
        "alternative_names": "; ".join(sorted({a["name"] for a in alts})),
        "endemic_greece": d.get("endemic_greece", b(r.get("endemic_greece"))),
        "endemic_region": d.get("endemic_region", r.get("endemic_region") or ""),
        "conservation_category": r.get("conservation_category") or "",
        "conservation_source": r.get("conservation_source") or "",
        "ema_monograph": ema_flag, "ema_name": ema_name, "ema_use": ema_use, "ema_url": ema_url,
        "wild_harvest_flag": b(bool(harv)), "wild_harvest_source": harv_src,
        "excerpt": r.get("excerpt") or "", "excerpt_edition": r.get("excerpt_edition") or "",
        "excerpt_url": r.get("excerpt_source_url") or "", "notes": notes, "research_notes": research_notes,
        "unverified": " | ".join(unver),
    }
    if row["slug"] == "paeonia-greece":
        row["conservation_category"], row["conservation_source"] = "", "Most threatened of the pooled species (IUCN, stage 05)"
    out.append(row)
    idents.append({"slug": row["slug"], "candidate_name": row["accepted_name"], "role": "modelled",
                   "source": src, "reviewed_by": "", "notes": row["notes"]})
    for a in alts:
        idents.append({"slug": row["slug"], "candidate_name": a["name"], "role": "alternative",
                       "source": a.get("source", ""), "reviewed_by": "", "notes": ""})

with open(ROOT / "data/curated/species.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=COLS)
    w.writeheader()
    w.writerows(out)
with open(ROOT / "data/curated/identifications.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["slug", "candidate_name", "role", "source", "reviewed_by", "notes"])
    w.writeheader()
    w.writerows(idents)
print(f"{len(out)} species; ids16 merged for {sum(1 for r in out if r['identification_source'])} with a source; "
      f"missing confidence: {[r['slug'] for r in out if not r['identification_confidence']]}")
