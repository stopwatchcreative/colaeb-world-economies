"""Build profile write-ups for investors without a page, from their own website text plus feed facts.

Writes investors/enrich/profiles-import-3.csv (Webflow CMS import format) and prints a sample.
A site sentence is used only when it is English, self-descriptive and turned into third person;
otherwise the profile uses the facts sentences alone. Angels and LinkedIn-only firms without a
location-quality record still get a facts-only profile (firms only; individual angels are skipped).
"""
import csv, html, json, os, re, sys
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
def host(u):
    u = u if "//" in u else "https://" + u
    return urlparse(u).netloc.lower().removeprefix("www.")

COMMON = set("the and of to in for with we our a is are that by on at from as investing invest invests backs back founders companies startups early stage capital venture technology fund".split())
JUNK = re.compile(r"cookie|privacy|javascript|404|not found|for sale|domain|wordpress|lorem|coming soon|subscribe|newsletter|log ?in|sign ?up|all rights|copyright|click here|accept|loading|welcome to|maintenance", re.I)

def english(s):
    w = re.findall(r"[A-Za-z']+", s.lower())
    if len(w) < 10: return False
    if sum(1 for c in s if ord(c) > 127) > len(s) * 0.05: return False
    if re.search(r"\b(und|für|der|die|het|een|och|des|les|pour|nous|est|para|los|che|della|mest|vår|wir|sind|ist)\b", s.lower()): return False
    return sum(1 for x in w if x in COMMON) / len(w) > 0.2

def clean(s):
    s = html.unescape(s or "").replace(" ", " ")
    s = re.sub(r"[â€™œ]+", "'", s) if "â€" in s else s
    s = re.sub(r"\s+", " ", s).strip(" |-–—")
    return s

def sentences(s):
    return [x.strip() for x in re.split(r"(?<=[.!?])\s+(?=[A-Z])", s) if x.strip()]

VERB_FIX = {"invest": "invests", "back": "backs", "partner": "partners", "support": "supports", "help": "helps",
            "fund": "funds", "provide": "provides", "focus": "focuses", "believe": "believes", "build": "builds",
            "work": "works", "lead": "leads", "seek": "seeks", "empower": "empowers", "make": "makes", "bring": "brings",
            "combine": "combines", "specialize": "specializes", "specialise": "specialises", "accelerate": "accelerates",
            "create": "creates", "manage": "manages", "offer": "offers", "deploy": "deploys", "write": "writes", "look": "looks",
            "operate": "operates", "aim": "aims", "connect": "connects", "champion": "champions", "enable": "enables", "target": "targets"}

def third_person(s, name):
    s = s.strip()
    BAD = r"https?:|www\.|…|\.\.\.|proud|grateful|should|excited|delighted|!|\b(I|my|me|you|your)\b"
    if re.search(BAD, s): return None
    letters = [c for c in s if c.isalpha()]
    if letters and sum(c.isupper() for c in letters) / len(letters) > 0.3: return None
    m1 = re.match(r"^(?:At \S+,\s*)?we(?:'re| are)\s+(.*)", s, re.I)
    m2 = re.match(r"^we\s+(\w+)\s+(.*)", s, re.I)
    if m1:
        out = f"{name} is {m1.group(1)}"
    elif m2 and m2.group(1).lower() in VERB_FIX:
        out = f"{name} {VERB_FIX[m2.group(1).lower()]} {m2.group(2)}"
    elif re.match(re.escape(name.split()[0]), s, re.I):
        if re.search(r"\b(our|ours|we|us)\b", s, re.I): return None
        return re.sub(r"^((?:\S+\s){0,5}?\S+)\s+are\s+", r"\1 is ", s, count=1)
    else:
        return None
    if re.search(r"\b(we|us)\b", out, re.I): return None
    out = re.sub(r"\bour\b", "its", out); out = re.sub(r"\bOur\b", "Its", out)
    if re.search(r"\bits (society|world|planet|future|communities|community|country|time|lives|generation|economy|children)", out): return None
    return out

def site_sentence(name, d):
    cands = []
    for src in [d.get("desc"), d.get("og")] + list(d.get("home") or []):
        s = clean(src)
        if not s or JUNK.search(s): continue
        for x in sentences(s):
            if 50 <= len(x) <= 260 and english(x):
                cands.append(x)
    for x in cands:
        t = third_person(x, name)
        if t:
            t = t.rstrip(" ,;:")
            if not t.endswith((".", "!", "?")): t += "."
            if t.endswith("!"): t = t[:-1] + "."
            return t[0].upper() + t[1:]
    return None

ART = {"Venture capital": "venture capital firm", "Accelerator": "accelerator", "Corporate VC": "corporate venture capital investor",
       "Angel network": "angel investor network", "Government fund": "government-backed fund", "Venture studio": "venture studio",
       "Family office": "family office", "Angel investor": "angel investor"}

def place(r):
    c, k = (r.get("c") or "").strip(), (r.get("k") or "").strip()
    if c and k and k != "United States" and k not in c: return f"{c}, {k}"
    if c: return c
    return {"United States": "the United States", "United Kingdom": "the United Kingdom", "The Netherlands": "the Netherlands",
            "United Arab Emirates": "the United Arab Emirates"}.get(k, k)

def stages(st):
    parts = [p.strip() for p in st.split(",") if p.strip()]
    low = [p if p in ("Series A", "Series B", "Series C") else p.lower() for p in parts]
    if not low: return ""
    if len(low) == 1: return f"at the {low[0]} stage"
    if len(low) == 2: return f"at the {low[0]} and {low[1]} stages"
    return f"from {low[0]} to {low[-1]}"

def focus_txt(f):
    parts = [p.strip().replace("-", " ") for p in re.split(r",|/", f) if p.strip() and "top 100" not in p.lower()]
    KEEP = {"ai": "AI", "ml": "ML", "saas": "SaaS", "iot": "IoT", "b2b": "B2B", "b2c": "B2C", "hr": "HR", "esg": "ESG", "web3": "Web3", "vr": "VR", "ar": "AR", "dtc": "DTC"}
    parts = [" ".join(KEEP.get(t.lower(), t if (t.isupper() and len(t) > 1) else t.lower()) for t in p.split()) for p in parts]
    parts = list(dict.fromkeys(parts))[:5]
    if not parts or parts == ["generalist"]: return ""
    if len(parts) == 1: return parts[0]
    return ", ".join(parts[:-1]) + " and " + parts[-1]

def facts(r, lead_done, lead=""):
    x = dict(r.get("x") or {})
    if lead and x.get("focus") and "deep" not in lead.lower():
        x["focus"] = ", ".join(p for p in x["focus"].split(",") if p.strip().lower() not in ("deep tech", "deep-tech"))
    name, t = r["n"], ART.get(r.get("t"), "investor")
    out = []
    pl = place(r)
    if not lead_done:
        a = "an" if t[0] in "aeiou" else "a"
        out.append(f"{name} is {a} {t}" + (f" based in {pl}." if pl else "."))
    st, fo = stages(x.get("stage") or ""), focus_txt(x.get("focus") or "")
    if st and fo: out.append(f"It invests {st}, with a focus on {fo}.")
    elif st: out.append(f"It invests {st}.")
    elif fo: out.append(f"Its focus areas include {fo}.")
    if lead and "based in" in lead.lower(): pl = ""
    if lead_done and pl and not (st or fo): out.append(f"The firm is based in {pl}.")
    elif lead_done and pl: out[-1] = out[-1][:-1] + f", and the firm is based in {pl}." if len(out[-1]) < 140 else out[-1]
    if x.get("check"): out.append(f"Typical checks run {x['check'].replace('–', ' to ')}.")
    if x.get("raised") and re.match(r"20(1[89]|2\d)", x["raised"]):
        y, amt = [s.strip() for s in x["raised"].split("·")] if "·" in x["raised"] else (x["raised"], "")
        if amt: out.append(f"Its latest fund, closed in {y}, was {amt}.")
    return out

def slugify(n):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", n.lower().replace("&", "and"))).strip("-")

def main(limit=None):
    feed = json.load(open(os.path.join(HERE, "..", "investors-feed-enriched.json")))
    prof = json.load(open(os.path.join(HERE, "profiles.json")))
    site = json.load(open(os.path.join(HERE, "site-text.json")))
    used = set(prof.values())
    rows, stats = [], {"site": 0, "facts": 0}
    for r in feed:
        h = host(r["w"])
        if r.get("t") == "Angel investor": continue
        if "h:" + h in prof or "n:" + r["n"].lower() in prof: continue
        d = site.get(h) or {}
        lead = site_sentence(r["n"], d) if d.get("ok") else None
        body = ([lead] if lead else []) + facts(r, bool(lead), lead or "")
        if len(body) < 2: body.append("Founders can find its website and location on the Colaeb Investor List.")
        stats["site" if lead else "facts"] += 1
        s = slugify(r["n"]) or slugify(h)
        if s in used: s = f"{s}-{slugify(h.split('.')[0])}"
        n = 2
        while s in used: s = f"{s}-{n}"; n += 1
        used.add(s)
        x = r.get("x") or {}
        typ = r.get("t") or "Venture capital"
        pl = place(r)
        seo_t = f"{r['n']}: {typ} Investor Profile | Colaeb"[:70]
        seo_d = (f"{r['n']} is a {ART.get(typ, 'investor')}" + (f" in {pl}" if pl else "") + ". Stage, focus, website and location on the free Colaeb Investor List.")[:160]
        rows.append({"Name": r["n"], "Slug": s, "Investor type": typ, "Stage": x.get("stage", ""), "Focus": x.get("focus", ""),
                     "Check size": x.get("check", ""), "City": r.get("c", ""), "Country": r.get("k", ""), "Latitude": r["la"], "Longitude": r["lo"],
                     "Website": r["w"], "Profile": " ".join(body), "SEO title": seo_t, "SEO description": seo_d, "Featured": "false", "Verified": "false",
                     "_host": h})
        if limit and len(rows) >= limit: break
    return rows, stats

if __name__ == "__main__":
    rows, stats = main()
    out = os.path.join(HERE, "profiles-import-3.csv")
    cols = ["Name", "Slug", "Investor type", "Stage", "Focus", "Check size", "City", "Country", "Latitude", "Longitude", "Website", "Profile", "SEO title", "SEO description", "Featured", "Verified"]
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore"); w.writeheader(); w.writerows(rows)
    json.dump({r["_host"]: r["Slug"] for r in rows}, open(os.path.join(HERE, "profiles-import-3-map.json"), "w"), indent=0)
    print(len(rows), stats)
