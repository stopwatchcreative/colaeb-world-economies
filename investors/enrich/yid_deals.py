#!/usr/bin/env python3
"""Find investors named in YourInfoDaily's Business coverage and record who led or joined each round.

Runs daily on GitHub Actions. Reads https://www.yourinfodaily.com/p/t/business (and older pages),
keeps a cache of articles already read (yid-articles.json) and writes yid-deals.json:
  {"updated": "...", "deals": {"h:<host>" | "n:<name key>": [{"t": title, "u": url, "d": "2026-11-12", "r": "led"|"in"}]}}
The page joins these to investors by website host, or by name for investors without a website.
"""
import html as html_lib
import json, os, re, datetime, time
from urllib.parse import urljoin
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
FEED = os.path.join(HERE, "..", "investors-feed.json")
CMS = os.path.join(HERE, "cms-investors.json")
CACHE = os.path.join(HERE, "yid-articles.json")
OUT = os.path.join(HERE, "yid-deals.json")
ACACHE = os.path.join(HERE, "yid-archive.json")  # The Funding Archive on yourinfodaily.com/news: headlines linking to the original source
BASE = "https://www.yourinfodaily.com"
LIST = BASE + "/p/t/business"
ARCHIVE = BASE + "/news"
UA = "Mozilla/5.0 ColaebInvestorList/1.0 (+https://colaeb.com/investors)"
S = requests.Session(); S.headers.update({"User-Agent": UA})
KEEP_DAYS = int(os.environ.get("YID_KEEP_DAYS", "3650"))  # historical archive included; each investor shows its 5 newest
DEEP = os.environ.get("YID_DEEP") == "1"  # walk every Business page, not just until caught up
MAX_PAGES = int(os.environ.get("YID_PAGES", "400" if DEEP else "60"))

SUFFIX = r"(?:\s+(?:ventures?|capital|partners|vc|fund|funds|management|investments?|group|holdings|llc|lp|inc\.?|ltd\.?|equity|advisors))+$"
STOP = set("""first general global human village next social future true new founders lead upfront index accel benchmark
insight greenoaks lux point general catalyst valor felicis initialized backed seed series round raise""".split())  # single words too risky to match alone
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
        if cache and not new and page > 2 and not DEEP: break  # caught up with what we already read
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
        # A shortened name ("Lux" for "Lux Capital") is only used for well-known short names or unusual tokens
        # like "a16z"; otherwise "New York Venture Partners" would match "New York" and "Founders Fund" "Founders".
        if short and short != base and (short.lower() in SAFE_SHORT or re.search(r"\d[a-z]|[a-z][A-Z]", short)):
            variants.add(short)
        if re.fullmatch(r"[$\d.,]+\s*[KMB]?", n.strip(), re.I): continue  # junk names like "200M"
        for v in variants:
            if len(v) < 3: continue
            words = v.split()
            single = len(words) == 1
            lv = v.lower()
            if single and (lv in STOP and lv not in SAFE_SHORT): continue
            if single and len(v) < 5 and lv not in SAFE_SHORT and not re.search(r"\d", v): continue
            # One-word names ("Amplify", "Conviction") are also ordinary words, so they only count in an investor list
            # ("led by Amplify", "from Conviction, ...").
            strict = single
            rx = re.compile(r"(?<![\w&])" + re.escape(v) + r"(?![\w&])")  # case-sensitive: firm names are capitalised
            pats.append((rx, key, n, strict))
    return pats


VER = 6  # bump when the matching rules change: cached articles are read again

ROUND = re.compile(r"\b(pre-seed|seed|series [a-h]|growth round|bridge round)\b", re.I)
PAST = re.compile(r"\b(previous(?:ly)?|earlier|prior|last year|first raised|had raised|in 20(?:1\d|2[0-4]))\b", re.I)


def clean_title(t):
    """Decode HTML entities left in og:title (e.g. &#039; -> ')."""
    t = html_lib.unescape(html_lib.unescape(t or ""))
    return re.sub(r"\s+", " ", t).strip()


def round_of(title):
    m = ROUND.search(title or "")
    return m.group(1).lower() if m else ""


def roles_in(text, pats, this_round=""):
    found = {}
    sentences = re.split(r"(?<=[.!?])\s+", text)
    for s in sentences:
        if not FUNDING.search(s): continue
        # Background on earlier rounds names past investors: only tag investors in this round.
        rounds = {r.lower() for r in ROUND.findall(s)}
        if this_round and rounds and this_round not in rounds: continue
        if PAST.search(s) and this_round not in rounds: continue
        hits = []
        for rx, key, name, strict in pats:
            for m in rx.finditer(s):
                hits.append((m.start(), m.end(), key, strict))
        # longest names win: "Female Founders Fund" hides the "Founders Fund" inside it
        hits.sort(key=lambda h: (-(h[1] - h[0]), h[0]))
        taken = []
        for st, en, key, strict in hits:
            if any(st < e and en > b for b, e in taken): continue
            before = s[max(0, st - 160):st]
            after = s[en:en + 40]
            if strict and not re.search(r"(led by|co-led by|from|including|includ\w+|and|,)\s*$", before.strip() + " ", re.I) and not re.search(r"^\s*(led|co-led)", after, re.I):
                continue
            taken.append((st, en))
            cues = [(c.end(), "led") for c in re.finditer(r"\b(?:co-)?led by\b|\bleads?\b(?= the)", before, re.I)] + \
                   [(c.end(), "in") for c in re.finditer(r"participation|participated|joined by|joined|alongside|along with|\binvestors\b|\bbackers\b|\bincluding\b|backed by|with support from|also from|\bwith\b|\bplus\b", before, re.I)]
            last = max(cues)[1] if cues else ""
            led = last == "led" or bool(re.search(r"^\s*(?:,\s*which\s+)?(?:led|co-led|leads)\b", after, re.I))
            prev = found.get(key)
            found[key] = "led" if (led or prev == "led") else "in"
    return found


# Investors whose name is also an everyday funding word ("Backed VC" vs "backed by") are never tagged from articles.
# Generic names ("Global Investors", "Healthcare Ventures") match ordinary article wording, so their tags are not trusted.
NEVER = {"h:backed.vc", "h:enterpriseequity.ie", "h:expansion-vc.eu", "h:ifinancialventures.com", "h:founderequity.com", "h:frontiergrowth.com", "h:draperfrontier.com", "h:future.ventures", "h:generationvc.com", "h:globalinvestors.com.au", "h:growthpartners.capital", "h:healthcareventures.vc", "h:innovation-capital.com", "n:seedroundcapital"}


# ------------------------------------------------------------ The Funding Archive (yourinfodaily.com/news)
# The /news page embeds the funding desk's archive as `var D=[[title, source url, outlet], ...]` (1,400+ rounds).
# Each round is read from its original source (title, opening paragraphs, publish date); when the source
# can't be read, the headline alone is used. Undated rounds take the date of their nearest dated neighbour.
URL_DATE = re.compile(r"/(20\d\d)[/-](\d\d)[/-](\d\d)")
URL_MONTH = re.compile(r"/(20\d\d)/(\d\d)/")
AMOUNT = re.compile(r"[$€£]\s?[\d.,]+\s?(?:[MBK]|million|billion)", re.I)


def archive_rows():
    try:
        html = S.get(ARCHIVE, timeout=30).text
    except Exception as e:
        print("archive error", e); return []
    i = html.find("var D=")
    if i < 0: print("archive: no data"); return []
    try:
        rows, _ = json.JSONDecoder().raw_decode(html, i + 6)
    except Exception as e:
        print("archive parse error", e); return []
    return [r for r in rows if isinstance(r, list) and len(r) >= 2 and r[0] and r[1]]


def lead_text(html):
    """Opening paragraphs of an article: avoids sidebars and 'related stories' that name other rounds."""
    paras = []
    for p in re.findall(r"(?is)<p[^>]*>(.*?)</p>", html):
        t = text_of(p)
        if len(t) > 40: paras.append(t)
        if len(paras) >= 14: break
    return " ".join(paras)


def read_archive(pats):
    from concurrent.futures import ThreadPoolExecutor
    rows = archive_rows()
    print("archive rounds", len(rows), flush=True)
    cache = json.load(open(ACACHE)) if os.path.exists(ACACHE) else {}
    todo = [(n, r) for n, r in enumerate(rows) if cache.get(r[1], {}).get("v") != VER]

    def one(item):
        n, r = item
        title, u = clean_title(r[0]), r[1]
        html = ""
        try:
            resp = S.get(u, timeout=12)
            if resp.ok and "html" in resp.headers.get("content-type", "html"): html = resp.text[:600000]
        except Exception:
            pass
        d = article_date(html, "") if html else ""
        if not re.match(r"20\d\d-\d\d-\d\d$", d or ""):
            m = URL_DATE.search(u)
            d = "%s-%s-%s" % m.groups() if m else ""
            if not d:
                m = URL_MONTH.search(u)
                d = "%s-%s-15" % m.groups() if m else ""
        text = title + ". " + (meta(html, "og:description") + ". " if html else "") + (lead_text(html) if html else "")
        return u, {"t": title, "d": d, "m": roles_in(text, pats, round_of(title)), "v": VER, "s": (r[2] if len(r) > 2 else "") or "", "n": n, "read": bool(html)}

    with ThreadPoolExecutor(max_workers=8) as ex:
        for k, (u, a) in enumerate(ex.map(one, todo)):
            cache[u] = a
            if k % 100 == 0: print("archive read", k, "/", len(todo), flush=True)
    # position on the page is chronological: undated rounds borrow the nearest dated neighbour's date
    order = {r[1]: n for n, r in enumerate(rows)}
    dated = sorted((order[u], a["d"]) for u, a in cache.items() if u in order and a.get("d"))
    for u, a in cache.items():
        if u in order: a["n"] = order[u]
        if a.get("d") or u not in order or not dated: continue
        a["d"] = min(dated, key=lambda x: abs(x[0] - order[u]))[1]; a["est"] = 1
    json.dump(cache, open(ACACHE, "w"), indent=0, sort_keys=True, ensure_ascii=False)
    print("archive: read from source", sum(1 for a in cache.values() if a.get("read")), "of", len(cache),
          "| rounds with investors", sum(1 for a in cache.values() if a.get("m")), flush=True)
    return cache


def write_deals(cache, archive=None):
    """Turn the article cache into yid-deals.json: up to 5 rounds per investor, newest first."""
    cutoff = (datetime.date.today() - datetime.timedelta(days=KEEP_DAYS)).isoformat()
    deals = {}
    sources = [(cache, True)] + ([(archive, False)] if archive else [])
    for src, is_yid in sources:
        for u, a in src.items():
            if not a.get("d") or a["d"] < cutoff: continue
            for key, role in a.get("m", {}).items():
                if key in NEVER: continue
                deals.setdefault(key, []).append({"t": clean_title(a["t"]), "u": u, "d": a["d"], "r": role, "_y": is_yid})
    for k in deals:
        rows = sorted(deals[k], key=lambda x: (x["_y"], x["d"], x["r"] == "led"), reverse=True)
        keep = []

        def near(a, b):
            try: return abs((datetime.date.fromisoformat(a[:10]) - datetime.date.fromisoformat(b[:10])).days) <= 21
            except ValueError: return False
        for x in rows:  # the same round covered by YourInfoDaily and by the archive's source: keep one
            amt = AMOUNT.search(x["t"])
            if amt and any(AMOUNT.search(y["t"]) and AMOUNT.search(y["t"]).group(0).replace(" ", "") == amt.group(0).replace(" ", "")
                           and near(x["d"], y["d"]) for y in keep):
                continue
            keep.append(x)
        for x in keep: x.pop("_y", None)
        deals[k] = sorted(keep, key=lambda x: (x["d"], x["r"] == "led"), reverse=True)[:5]
    json.dump({"updated": datetime.date.today().isoformat(), "deals": deals}, open(OUT, "w"), separators=(",", ":"), ensure_ascii=False)
    return deals


def main():
    arts, cache = list_articles()
    pats = build_patterns()
    print("patterns", len(pats), flush=True)
    # Articles read under older matching rules are read again, so a rules change applies to the whole year.
    seen = {u for u, _ in arts}
    arts = list(arts) + [(u, a.get("t", "")) for u, a in cache.items() if a.get("v") != VER and u not in seen]
    for u, title in arts:
        if u in cache and cache[u].get("v") == VER: continue
        try:
            html = S.get(u, timeout=20).text
        except Exception as e:
            print("article error", u, e); continue
        body = text_of(html)
        t0 = meta(html, "og:title") or title
        if not FUNDING_TITLE.search(t0):
            cache[u] = {"t": clean_title(t0), "d": article_date(html), "m": {}, "v": VER}; continue
        t = meta(html, "og:title") or title
        cache[u] = {"t": clean_title(t), "d": article_date(html), "m": roles_in(body, pats, round_of(t)), "v": VER}
        print("read", cache[u]["d"], t[:70], "->", len(cache[u]["m"]), flush=True)
        time.sleep(0.3)
    json.dump(cache, open(CACHE, "w"), indent=0, sort_keys=True, ensure_ascii=False)
    archive = read_archive(pats)
    deals = write_deals(cache, archive)
    print("investors with deals", len(deals), "articles", len(cache))


if __name__ == "__main__":
    main()
