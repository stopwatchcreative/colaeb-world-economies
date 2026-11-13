#!/usr/bin/env python3
"""Find investors named in YourInfoDaily's Business coverage and record who led or joined each round.

Runs daily on GitHub Actions. Reads https://www.yourinfodaily.com/p/t/business (and older pages),
keeps a cache of articles already read (yid-articles.json) and writes yid-deals.json:
  {"updated": "...", "deals": {"h:<host>" | "n:<name key>": [{"t": title, "u": url, "d": "2026-11-12", "r": "led"|"in"}]}}
The page joins these to investors by website host, or by name for investors without a website.
"""
import json, os, re, datetime, time
from urllib.parse import urljoin
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
FEED = os.path.join(HERE, "..", "investors-feed.json")
CMS = os.path.join(HERE, "cms-investors.json")
CACHE = os.path.join(HERE, "yid-articles.json")
OUT = os.path.join(HERE, "yid-deals.json")
BASE = "https://www.yourinfodaily.com"
LIST = BASE + "/p/t/business"
UA = "Mozilla/5.0 ColaebInvestorList/1.0 (+https://colaeb.com/investors)"
S = requests.Session(); S.headers.update({"User-Agent": UA})
KEEP_DAYS = 365
MAX_PAGES = int(os.environ.get("YID_PAGES", "60"))

SUFFIX = r"(?:\s+(?:ventures?|capital|partners|vc|fund|funds|management|investments?|group|holdings|llc|lp|inc\.?|ltd\.?|equity|advisors))+$"
STOP = set("""first general global human village next social future true new founders lead upfront index accel benchmark
insight greenoaks lux point general catalyst valor felicis initialized""".split())  # single words too risky to match alone
# ...except these well-known single-word firms, which are matched only right after "led by" / "from" / "including"
SAFE_SHORT = set("accel benchmark insight lux felicis initialized greenoaks index upfront valor".split())
FUNDING_TITLE = re.compile(r"\b(raises?|raised|lands?|secures?|closes?|bags?|nabs?|gets|snags?|funding|round|series [a-f]|seed|pre-seed|investment|backs?|backed|led by|valuation)\b", re.I)
FUNDING = re.compile(r"\b(led|co-led|leads|leading|participation|participated|backed|backers|joined|investors? includ|round|raise[sd]?|funding|seed|series)\b", re.I)


def key_name(s):
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def host(u):
    u = (u or "").lower()
    if not u or "linkedin.com" in u: return ""
    return re.sub(r"^https?://", "", u).split("/")[0].replace("www.", "")


def text_of(html):
    html = re.sub(r"(?is)<(script|style|noscript|svg|nav|footer|header)[^>]*>.*?</\1>", " ", html)
    t = re.sub(r"(?s)<[^>]+>", " ", html)
    t = t.replace("&amp;", "&").replace("&#x27;", "'").replace("&#39;", "'").replace("&quot;", '"').replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", t).strip()


def meta(html, prop):
    m = re.search(r'(?is)<meta[^>]+(?:property|name)="%s"[^>]+content="([^"]*)"' % re.escape(prop), html) or \
        re.search(r'(?is)<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="%s"' % re.escape(prop), html)
    return m.group(1).strip() if m else ""


def article_date(html, list_date=""):
    for p in ("article:published_time", "og:article:published_time", "datePublished"):
        v = meta(html, p)
        if v: return v[:10]
    m = re.search(r'"datePublished"\s*:\s*"([^"]+)"', html) or re.search(r'<time[^>]+datetime="([^"]+)"', html)
    if m: return m.group(1)[:10]
    m = re.search(r"\b(\d{1,2})/(\d{1,2})/(20\d\d)\b", html)
    if m: return "%s-%02d-%02d" % (m.group(3), int(m.group(1)), int(m.group(2)))
    return list_date


def list_articles():
    seen, out = set(), []
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    for page in range(1, MAX_PAGES + 1):
        url = LIST if page == 1 else LIST + "?page=%d" % page
        try:
            html = S.get(url, timeout=20).text
        except Exception as e:
            print("list error", url, e); break
        found = 0; new = 0
        for href, inner in re.findall(r'(?is)<a[^>]+href="([^"]*?/p/[^"#?]+)"[^>]*>(.*?)</a>', html):
            if "/p/t/" in href: continue
            u = urljoin(BASE, href)
            if u in seen: continue
            title = text_of(inner)
            if len(title) < 12: continue
            seen.add(u); found += 1
            if u not in cache: new += 1
            out.append((u, title))
        print("page", page, "articles", found, "new", new, flush=True)
        if not found: break
        if cache and not new and page > 2: break  # caught up with what we already read
        time.sleep(0.5)
    return out, cache


def build_patterns():
    feed = json.load(open(FEED))
    names = [(r["n"], host(r.get("w")), r.get("w", "")) for r in feed if r.get("n")]
    names += [(n, h, "https://" + h) for n, h in json.load(open(CMS))]
    pats = []
    for n, h, w in names:
        key = ("h:" + h) if h else ("n:" + key_name(n))
        variants = {n.strip()}
        alias = re.findall(r"\(([^)]+)\)", n)
        base = re.sub(r"\s*\([^)]*\)", "", n).strip()
        variants.add(base); variants.update(a.strip() for a in alias)
        short = re.sub(SUFFIX, "", base, flags=re.I).strip()
        # A shortened name is only used when it is still distinctive: several words, a known short firm name,
        # or an unusual token (digits / inner capitals like "a16z" or "LocalGlobe"). Avoids "Growth", "Launch", "Founders".
        if short and short != base and (len(short.split()) > 1 or short.lower() in SAFE_SHORT or re.search(r"\d|[a-z][A-Z]", short)):
            variants.add(short)
        for v in variants:
            if len(v) < 3: continue
            words = v.split()
            single = len(words) == 1
            lv = v.lower()
            if single and (lv in STOP and lv not in SAFE_SHORT): continue
            if single and len(v) < 5 and lv not in SAFE_SHORT and not re.search(r"\d", v): continue
            strict = single and lv in SAFE_SHORT
            rx = re.compile(r"(?<![\w&])" + re.escape(v) + r"(?![\w&])")  # case-sensitive: firm names are capitalised
            pats.append((rx, key, n, strict))
    return pats


def roles_in(text, pats):
    found = {}
    sentences = re.split(r"(?<=[.!?])\s+", text)
    for s in sentences:
        if not FUNDING.search(s): continue
        for rx, key, name, strict in pats:
            m = rx.search(s)
            if not m: continue
            before = s[max(0, m.start() - 160):m.start()]
            after = s[m.end():m.end() + 40]
            if strict and not re.search(r"(led by|co-led by|from|including|and|,)\s*$", before.strip() + " ", re.I) and not re.search(r"^\s*(led|co-led)", after, re.I):
                continue
            cues = [(c.end(), "led") for c in re.finditer(r"\b(?:co-)?led by\b|\bleads?\b(?= the)", before, re.I)] + \
                   [(c.end(), "in") for c in re.finditer(r"participation|participated|joined by|joined|alongside|along with|\binvestors\b|\bbackers\b|\bincluding\b|backed by|with support from|also from|\bwith\b|\bplus\b", before, re.I)]
            last = max(cues)[1] if cues else ""
            led = last == "led" or bool(re.search(r"^\s*(?:,\s*which\s+)?(?:led|co-led|leads)\b", after, re.I))
            prev = found.get(key)
            found[key] = "led" if (led or prev == "led") else "in"
    return found


def main():
    arts, cache = list_articles()
    pats = build_patterns()
    print("patterns", len(pats), flush=True)
    for u, title in arts:
        if u in cache and cache[u].get("v") == 3: continue
        try:
            html = S.get(u, timeout=20).text
        except Exception as e:
            print("article error", u, e); continue
        body = text_of(html)
        t0 = meta(html, "og:title") or title
        if not FUNDING_TITLE.search(t0):
            cache[u] = {"t": t0, "d": article_date(html), "m": {}, "v": 3}; continue
        t = meta(html, "og:title") or title
        cache[u] = {"t": t.replace("&amp;", "&"), "d": article_date(html), "m": roles_in(body, pats), "v": 3}
        print("read", cache[u]["d"], t[:70], "->", len(cache[u]["m"]), flush=True)
        time.sleep(0.3)
    json.dump(cache, open(CACHE, "w"), indent=0, sort_keys=True, ensure_ascii=False)
    cutoff = (datetime.date.today() - datetime.timedelta(days=KEEP_DAYS)).isoformat()
    deals = {}
    for u, a in cache.items():
        if not a.get("d") or a["d"] < cutoff: continue
        for key, role in a.get("m", {}).items():
            deals.setdefault(key, []).append({"t": a["t"], "u": u, "d": a["d"], "r": role})
    for k in deals:
        deals[k] = sorted(deals[k], key=lambda x: (x["d"], x["r"] == "led"), reverse=True)[:5]
    json.dump({"updated": datetime.date.today().isoformat(), "deals": deals}, open(OUT, "w"), separators=(",", ":"), ensure_ascii=False)
    print("investors with deals", len(deals), "articles", len(cache))


if __name__ == "__main__":
    main()
