#!/usr/bin/env python3
"""Merge investor sources into investors-feed.json for colaeb.com/investors.

Rule (Manny): include an investor only if it has at least one contact: website, LinkedIn or email.
Sources live in this folder; see SOURCES.md. Websites listed in dead.txt (failed the live check) are dropped.
"""
import csv, json, re, os, unicodedata, collections
import geonamescache

HERE = os.path.dirname(os.path.abspath(__file__))
P = lambda f: os.path.join(HERE, f)
gc = geonamescache.GeonamesCache()

EXCLUDE = {"rev1ventures.com", "jumpstartinc.org"}  # removed by Manny
# Already live in Webflow CMS (cn.js also dedupes by host, this just keeps the feed lean)
CMS = {"drivecapital.com", "cincytechusa.com", "m25vc.com", "highalpha.com", "kaporcapital.com", "harlem.capital",
       "goldenseeds.com", "collab.capital", "precursorvc.com", "hustlefund.vc", "firstround.com", "a16z.com",
       "ycombinator.com", "techstars.com", "plugandplaytechcenter.com", "masschallenge.org", "intelcapital.com",
       "seedcamp.com", "kaszek.com", "blume.vc", "future.africa", "blackbird.vc"}

def norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\b(the|llc|inc|lp|ltd|gmbh|partners|partner|ventures|venture|capital|vc|fund|group|management|investments)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", "", s)

def dom(u):
    u = (u or "").strip().lower()
    if not u or "crunchbase.com" in u or "notion.so" in u or "angel.co" in u or "linkedin.com" in u: return ""
    u = re.sub(r"^https?://", "", u); u = re.sub(r"^www\d?\.", "", u)
    u = u.split("?")[0].split("#")[0].rstrip("/")
    return u

def host(u): return dom(u).split("/")[0]

# ---------------------------------------------------------------- geocoding
CITIES = gc.get_cities()
by_name = collections.defaultdict(list)
for c in CITIES.values():
    for nm in {c["name"]} | set(a for a in c.get("alternatenames", []) if a and len(a) < 40):
        by_name[nm.lower()].append(c)
COUNTRIES = gc.get_countries()
cc_by_name = {v["name"].lower(): k for k, v in COUNTRIES.items()}
cc_by_name.update({"uk": "GB", "united kingdom": "GB", "usa": "US", "us": "US", "united states": "US", "czechia": "CZ",
                   "czech republic": "CZ", "south korea": "KR", "korea": "KR", "russia": "RU", "uae": "AE", "the netherlands": "NL",
                   "turkey": "TR", "netherlands": "NL", "luxemburg": "LU", "czech republic": "CZ", "türkiye": "TR", "taiwan": "TW", "vietnam": "VN", "hong kong": "HK", "ivory coast": "CI"})
COUNTRY_LABEL = {"US": "United States", "GB": "United Kingdom"}
ALIAS = {"washington d.c.": ("Washington", "DC"), "dc": ("Washington", "DC"), "st louis": ("St. Louis", None), "saint louis": ("St. Louis", None),
         "ft lauderdale": ("Fort Lauderdale", None), "new york": ("New York City", None), "nyc": ("New York City", "NY"),
         "brooklyn": ("Brooklyn", None), "la jolla": ("San Diego", "CA"), "playa vista": ("Los Angeles", "CA"),
         "west hollywood": ("West Hollywood", "CA"), "chestnut hill": ("Newton", "MA"), "champaign": ("Champaign", "IL")}

def largest(cands):
    return max(cands, key=lambda c: c.get("population", 0)) if cands else None

def geo_city(city, state=None, cc="US"):
    k = (city or "").strip().lower().rstrip(".")
    if k in ALIAS:
        city, st = ALIAS[k]; state = st or state; k = city.lower()
    cands = [c for c in by_name.get(k, []) if c["countrycode"] == cc]
    if state and cc == "US":
        s2 = [c for c in cands if c.get("admin1code") == state]
        cands = s2 or cands
    c = largest(cands)
    return (c["latitude"], c["longitude"]) if c else None

CENTER = {"US": (39.83, -98.58), "CA": (56.13, -106.35)}
def geo_country(cc):
    if cc in CENTER: return CENTER[cc]
    c = largest([c for c in CITIES.values() if c["countrycode"] == cc])
    return (c["latitude"], c["longitude"]) if c else None

STATE_NAMES = {k: v["name"] for k, v in gc.get_us_states().items()}

# ---------------------------------------------------------------- records
recs = {}   # key -> record
name_idx = {}

def key_for(name, web, li):
    h = host(web)
    if h: return "h:" + h
    if li: return "l:" + li.lower().rstrip("/")
    return None

def upsert(name, web="", li="", email="", **kw):
    web_d = dom(web); h = host(web)
    if h in EXCLUDE: return
    nk = norm(name)
    k = key_for(name, web_d, li)
    if not k and nk in name_idx: k = name_idx[nk]
    if k and k not in recs and nk in name_idx and name_idx[nk] in recs:
        k = name_idx[nk]  # same firm under a different/missing domain
    if not k:
        if not (web_d or li or email): return  # no contact -> skip (Manny's rule)
        k = "n:" + nk
    r = recs.setdefault(k, {"name": name, "web": "", "li": "", "email": "", "city": "", "state": "", "cc": "", "src": set()})
    if web_d and not r["web"]: r["web"] = web_d
    if li and not r["li"]: r["li"] = li
    if email and not r["email"]: r["email"] = email
    for f, v in kw.items():
        if v and not r.get(f): r[f] = v
    name_idx.setdefault(nk, k)

# Euro Tech VC Funds 2016-2026 (uploaded CSV): latest vehicle per firm
eu = list(csv.DictReader(open(P("euro.csv"), encoding="utf-8-sig", errors="replace")))
eu.sort(key=lambda x: x.get("Yr") or "")
for x in eu:
    cty = re.sub(r"[^\w ]", "", x["Main HQ"]).strip()
    cc = cc_by_name.get(cty.lower(), "")
    upsert(x["Fund Name"].strip(), x["Web"], (x["LI"] or "").strip(), cc=cc,
           year=x.get("Yr", ""), size=(x.get("Size") or "").replace(" ", ""), focus=x.get("Sector focus", ""))
for r in recs.values(): r["src"].add("euro")

# Google Sheet: Ultimate List of 750+ Seed Funds (name|city|state|domain)
for line in open(P("gsheet.txt")):
    p = line.rstrip("\n").split("|")
    if len(p) < 4: continue
    before = set(recs)
    upsert(p[0], p[3], city=p[1], state=p[2], cc="US", stage="Seed")
    for k, r in recs.items():
        if norm(r["name"]) == norm(p[0]) or (p[3] and host(p[3]) and k == "h:" + host(p[3])): r["src"].add("gsheet")

# Airtable list 1 (name|domain|region)
for line in open(P("airtable1.txt")):
    p = line.rstrip("\n").split("|")
    if len(p) < 3: continue
    reg = {"NA": "", "EU": "", "G": "", "Asia": ""}.get(p[2], "")
    upsert(p[0], p[1], stage="Pre-seed", cc="US" if p[2] == "NA" else "")

# extra sources dropped in as TSV with header: name, website, linkedin, email, city, state, country, type, stage, focus
for f in sorted(os.listdir(HERE)):
    if f.startswith("src_") and f.endswith(".tsv"):
        for x in csv.DictReader(open(P(f)), delimiter="\t"):
            cc = cc_by_name.get((x.get("country") or "").strip().lower(), x.get("country", "")[:2].upper() if len(x.get("country", "")) == 2 else "")
            upsert(x["name"].strip(), x.get("website", ""), (x.get("linkedin") or "").strip(), (x.get("email") or "").strip(),
                   city=x.get("city", ""), state=x.get("state", ""), cc=cc, type=x.get("type", ""), stage=x.get("stage", ""), focus=x.get("focus", ""), check=x.get("check", ""))

# Website fixes by investor name (listing pointed at an aggregator page)
WEB_FIX = {"futuristic.vc": "futuristic.vc"}
if os.path.exists(P("web_fixes.tsv")):
    for x in csv.DictReader(open(P("web_fixes.tsv")), delimiter="\t"):
        k = name_idx.get(norm(x["name"]))
        if k in recs: recs[k]["web"] = dom(x["website"])

# Location overrides by domain (HQs confirmed by hand)
for x in csv.DictReader(open(P("loc_overrides.tsv")), delimiter="\t"):
    r = recs.get("h:" + x["domain"])
    if r: r["city"], r["state"], r["cc"] = x["city"], x["state"], x["cc"]

# Browser-scraped lists: name|website|linkedin|email|city|country|type|stage|focus
GENERIC = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com", "me.com", "protonmail.com", "live.com"}
for f in sorted(os.listdir(HERE)):
    if not (f.startswith("src_") and f.endswith(".txt")): continue
    for line in open(P(f)):
        p = (line.rstrip("\n") + "|" * 9).split("|")[:9]
        nm, web, li, em, city, country, typ, stage, focus = [x.strip() for x in p]
        m = re.search(r"[\w.+-]+@([\w-]+(?:\.[\w-]+)+)", em)
        em = m.group(0).lower() if m else ""
        if not web and m and m.group(1).lower() not in GENERIC: web = m.group(1).lower()
        if "linkedin.com" in web: li, web = li or web, ""
        st = ""
        SN = {v.lower(): k for k, v in STATE_NAMES.items()}; SN["district of columbia"] = "DC"
        if country.lower() in SN: st, country = SN[country.lower()], ""
        elif city.lower() in SN and country: st, city, country = SN[city.lower()], country, ""
        mm = re.match(r"^(.*?),\s*([A-Z]{2})$", city)
        if mm and mm.group(2) in STATE_NAMES: city, st = mm.group(1), mm.group(2)
        cc = cc_by_name.get(country.lower(), "") or ("US" if st else "")
        if not cc and city.lower() in cc_by_name: cc, city = cc_by_name[city.lower()], ""
        if city.lower() in ("other", "remote", "global", "n/a"): city = ""
        stage = re.sub(r"\s+(?=(Pre-seed|Seed\+?|Late Seed|Series [A-D]|angel|Growth))", ", ", stage)
        upsert(nm, web, li, "", city=city, state=st, cc=cc, type=typ, stage=stage, focus=focus[:60])

# Shai Goldman fund list: no contacts, used only to add "latest fund" to firms already present
shai = list(csv.reader(open(P("shai.csv"))))
latest = {}
for x in shai[12:]:
    if len(x) > 6 and x[1].strip() and re.match(r"^20\d\d$", x[4].strip()):
        n = norm(x[1]);
        if x[4] > latest.get(n, ("",))[0]: latest[n] = (x[4].strip(), x[2].strip())
for r in recs.values():
    hit = latest.get(norm(r["name"]))
    if hit and (not r.get("year") or hit[0] > r["year"]): r["year"], r["size"] = hit[0], (hit[1] + "M" if hit[1] and not hit[1].endswith("M") else hit[1])

# ---------------------------------------------------------------- output
dead = set(l.strip() for l in open(P("dead.txt"))) if os.path.exists(P("dead.txt")) else set()
def gtype(name, t):
    if t: return t
    n = name.lower()
    if re.search(r"angel", n): return "Angel network"
    if re.search(r"accelerator|incubator|techstars|y combinator|500 startups|angelpad|gener8tor|\bhax\b|boost vc|launchpad|startup labs|skydeck|plug and play", n): return "Accelerator"
    return "Venture capital"

out, stats = [], collections.Counter()
for k, r in recs.items():
    h = host(r["web"])
    if h in CMS or h in EXCLUDE: stats["in_cms"] += 1; continue
    if h and h in dead:
        if r["li"]: r["web"] = ""
        elif r.get("year", "") >= "2023": pass  # raised recently: keep despite a failed check
        else: stats["dead"] += 1; continue
    web = ("https://" + r["web"]) if r["web"] else (r["li"] if r["li"] else ("mailto:" + r["email"] if r["email"] else ""))
    if not web: stats["no_contact"] += 1; continue
    cc = r["cc"] or ("US" if r["state"] else "")
    if not cc and r["city"]:
        c0 = largest(by_name.get(r["city"].strip().lower(), []))
        if c0: cc = c0["countrycode"]
    ll = geo_city(r["city"], r["state"], cc) if r["city"] and cc else None
    if not ll and r["city"] and cc and cc != "US": ll = geo_city(r["city"], None, cc)
    city = r["city"] if ll else ""
    if not ll and cc: ll = geo_country(cc)
    if not ll: stats["no_location"] += 1; continue
    if city.lower() in ("washington d.c.", "dc"): city = "Washington, DC"
    country = COUNTRY_LABEL.get(cc) or (COUNTRIES.get(cc, {}).get("name") or cc)
    if cc == "US" and r["state"] and city and r["state"] in STATE_NAMES and "," not in city: city = city + ", " + r["state"]
    x = {}
    if r.get("stage"): x["stage"] = r["stage"]
    if r.get("focus"): x["focus"] = r["focus"]
    if r.get("check"): x["check"] = r["check"]
    if r.get("year"): x["raised"] = r["year"] + (" · " + r["size"] if r.get("size") else "")
    o = {"n": r["name"], "w": web, "t": gtype(r["name"], r.get("type")), "c": city, "k": country,
         "la": round(ll[0], 3), "lo": round(ll[1], 3)}
    if x: o["x"] = x
    out.append(o); stats["out"] += 1
out.sort(key=lambda o: o["n"].lower())
json.dump(out, open(P("investors-feed.json"), "w"), separators=(",", ":"), ensure_ascii=False)
print(dict(stats), "records", len(recs))
