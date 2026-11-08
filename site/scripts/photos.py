"""Fetch one openly licensed photo per plant from Wikimedia Commons (via the species' Wikipedia lead image).

Keeps only JPEG photographs under CC0, public domain, CC BY or CC BY-SA, resized to 900 px wide by Commons,
and records author, licence and source page in public/data/photos.json for on-page attribution.
Usage: python site/scripts/photos.py   (stdlib only; re-run to refresh)
"""
import csv, html, json, re, sys, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
ROOT = SITE.parent
OUT = SITE / "public" / "images" / "plants"
UA = {"User-Agent": "MateriaMedica2050/1.0 (EthnoHack 2026 research prototype; github.com/SoujanyaChatti/Materia-Medica-2050)"}
OK_LICENCE = re.compile(r"^(cc0|public domain|pd|cc by(-sa)? \d)", re.I)
# Pooled or unusual names: species whose photo stands for the plant (stated in the caption).
OVERRIDE = {"paeonia-greece": ["Paeonia mascula", "Paeonia peregrina"], "juniperus-deltoides": ["Juniperus deltoides", "Juniperus oxycedrus"],
            "teucrium-capitatum": ["Teucrium capitatum", "Teucrium polium"], "mandragora-officinarum": ["Mandragora officinarum", "Mandragora autumnalis"]}
SKIP_FILE = re.compile(r"k[öo]hler|illustration|botanical|plate|drawing|map|distribution|herbarium|\.svg$|\.png$|\.gif$|\.tif", re.I)


def get(url, params, tries=6):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url + "?" + urllib.parse.urlencode(params), headers=UA), timeout=30) as r:
                time.sleep(1.0)
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429 or k == tries - 1:
                raise
            time.sleep(10 * (k + 1))


def lead_image(title):
    q = get("https://en.wikipedia.org/w/api.php", {"action": "query", "titles": title, "prop": "pageimages", "piprop": "name",
                                                    "redirects": 1, "format": "json"})
    for p in q["query"]["pages"].values():
        if p.get("pageimage"):
            return p["pageimage"], p["title"]
    return None, None


def commons_search(name):
    """Commons files whose title contains the binomial, best first (photos only by extension)."""
    q = get("https://commons.wikimedia.org/w/api.php", {"action": "query", "list": "search", "srnamespace": 6, "srlimit": 25,
                                                         "srsearch": f'intitle:"{name}" filetype:bitmap', "format": "json"})
    g, e = name.lower().split()[:2]
    titles = [h["title"][5:] for h in q["query"]["search"]]
    return [t for t in titles if g in t.lower() and e in t.lower() and re.search(r"\.jpe?g$", t, re.I) and not SKIP_FILE.search(t)]


def info(fname):
    q = get("https://commons.wikimedia.org/w/api.php", {"action": "query", "titles": "File:" + fname, "prop": "imageinfo",
                                                         "iiprop": "url|extmetadata|mime", "iiurlwidth": 900, "format": "json"})
    p = next(iter(q["query"]["pages"].values()))
    if "imageinfo" not in p:
        return None
    ii = p["imageinfo"][0]
    m = ii.get("extmetadata", {})
    clean = lambda k: html.unescape(re.sub(r"<[^>]+>", "", m.get(k, {}).get("value", ""))).strip()  # noqa: E731
    return {"mime": ii.get("mime"), "thumb": ii.get("thumburl"), "page": ii.get("descriptionurl"), "licence": clean("LicenseShortName"),
            "licence_url": m.get("LicenseUrl", {}).get("value", ""), "author": clean("Artist")[:120] or "Unknown", "file": fname}


def main():
    species = list(csv.DictReader(open(ROOT / "data" / "curated" / "species.csv", encoding="utf-8")))
    credits = {}
    pj = SITE / "public" / "data" / "photos.json"
    credits_old = json.loads(pj.read_text()) if pj.exists() else {}
    for s in species:
        slug = s["slug"]
        names = OVERRIDE.get(slug, [" ".join(s["accepted_name"].split()[:2])])
        chosen = None
        prev = credits_old.get(slug)
        if prev and (OUT / f"{slug}.jpg").exists():
            credits[slug] = prev
            print(f"{slug}: kept {prev['file']}")
            continue
        for n in names:
            fname, _ = lead_image(n)
            files = ([fname] if fname and not SKIP_FILE.search(fname) else []) + commons_search(n)[:8]
            for f in files:
                i = info(f)
                if i and i["mime"] == "image/jpeg" and OK_LICENCE.search(i["licence"]):
                    chosen = {**i, "taxon": n}
                    break
                print(f"{slug}: {n}: rejected {f} ({i and i['mime']}, {i and i['licence']})")
            if chosen:
                break
        if not chosen:
            print(f"{slug}: NO PHOTO"); continue
        req = urllib.request.Request(chosen["thumb"], headers=UA)
        (OUT / f"{slug}.jpg").write_bytes(urllib.request.urlopen(req, timeout=60).read())
        credits[slug] = {k: chosen[k] for k in ("taxon", "author", "licence", "licence_url", "page", "file")}
        print(f"{slug}: {chosen['taxon']} · {chosen['licence']} · {chosen['author'][:40]} · {chosen['file']}")
        pj.write_text(json.dumps(credits, ensure_ascii=False, indent=1))
    by_slug = {s["slug"]: s for s in species}
    for slug, c in credits.items():   # say when the photo shows one species of a pooled plant
        sp = by_slug[slug]
        c.pop("pooled_note", None)
        if sp["model_taxa"]:
            c["pooled_note"] = "one of the species pooled for this plant"
        elif c["taxon"] != " ".join(sp["accepted_name"].split()[:2]):
            c["pooled_note"] = "shown for this plant"
    (SITE / "public" / "data" / "photos.json").write_text(json.dumps(credits, ensure_ascii=False, indent=1))
    print(f"{len(credits)} of {len(species)} plants have a photo")


if __name__ == "__main__":
    main()
