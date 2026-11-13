#!/usr/bin/env python3
"""Read each investor's website and record what it says about stage, sector focus and check size.

Runs on GitHub Actions (monthly, or on demand). Output: investors/enrich/sites.json, keyed by host:
  {"status": "ok"|"dead"|"blocked", "dead_runs": n, "stage": "...", "focus": "...", "check": "...",
   "latest_year": 2026, "checked": "2026-11-13"}
A host is only treated as gone after two dead checks in a row, so a site that is briefly down is kept.
"""
import json, os, re, sys, time, datetime, concurrent.futures as cf
from urllib.parse import urljoin, urlparse
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
FEED = os.path.join(HERE, "..", "investors-feed.json")
OUT = os.path.join(HERE, "sites.json")
TODAY = datetime.date.today().isoformat()
MAX_AGE_DAYS = int(os.environ.get("MAX_AGE_DAYS", "25"))  # skip hosts checked more recently than this
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 ColaebInvestorList/1.0 (+https://colaeb.com/investors)"
S = requests.Session(); S.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.8"})

STAGES = [("Pre-seed", r"pre[\s-]?seed"), ("Seed", r"(?<!pre-)(?<!pre )\bseed\b"), ("Series A", r"series\s*a\b"),
          ("Series B", r"series\s*b\b"), ("Growth", r"growth[\s-](?:stage|equity)|late[\s-]stage|expansion[\s-]stage")]
SECTORS = [  # label, pattern. Labels use words match.js already understands.
    ("Fintech", r"fintech|financial services|payments?\b|insurtech|banking"),
    ("Crypto and web3", r"crypto|web3|blockchain|defi\b"),
    ("AI", r"\bai\b|artificial intelligence|machine learning|\bml\b|generative"),
    ("Data and analytics", r"\bdata infrastructure|analytics|big data"),
    ("SaaS and enterprise software", r"\bsaas\b|enterprise software|b2b software|\bb2b\b|future of work|devtools|developer tools"),
    ("Cybersecurity", r"cyber ?security|infosec"),
    ("Health", r"digital health|healthcare|health ?tech|medtech|medical devices?|\bhealth\b"),
    ("Biotech and life sciences", r"biotech|life sciences|therapeutics|pharma"),
    ("Climate and energy", r"climate|clean ?tech|clean energy|decarboni|sustainab|carbon|renewable"),
    ("Mobility and logistics", r"mobility|transportation|logistics|supply chain"),
    ("Consumer", r"\bconsumer\b|dtc\b|d2c|direct[- ]to[- ]consumer|\bcpg\b"),
    ("E-commerce and marketplaces", r"e-?commerce|marketplaces?\b|retail tech"),
    ("Media and creator economy", r"creator economy|creator tools|\bcreators\b|media (?:startups|companies|tech|and entertainment)|digital media|entertainment|music tech|streaming"),
    ("Gaming and sports", r"gaming|esports|\bgames?\b|sports ?tech|fitness"),
    ("Education", r"edtech|education|learning"),
    ("Real estate and proptech", r"proptech|real estate|construction tech|built environment"),
    ("Food and agriculture", r"food ?tech|agtech|agri|farm"),
    ("Deep tech and hardware", r"deep ?tech|hardware|robotics|semiconductor|quantum|space ?tech|aerospace|defen[cs]e tech|frontier tech"),
]
PARKED = re.compile(r"domain (?:is )?for sale|buy this domain|this domain may be for sale|parked free|domain parking|hugedomains|sedo\.com|dan\.com", re.I)
ABOUT = re.compile(r"about|thesis|invest|focus|approach|what-we|strategy|who-we|criteria|founders|apply", re.I)
MONEY = r"\$\s?(\d{1,4}(?:\.\d+)?)\s?(k|m|mm|million|thousand|b)?\b"
CHECK = re.compile(MONEY + r"\s?(?:-|–|—|to|and)\s?" + MONEY, re.I)
CHECK_CTX = re.compile(r"check|ticket|initial|first|invest|cheque|commit", re.I)


def text_of(html):
    html = re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", html)
    title = " ".join(re.findall(r"(?is)<title[^>]*>(.*?)</title>", html))
    meta = " ".join(re.findall(r'(?is)<meta[^>]+(?:name|property)="(?:description|og:description)"[^>]+content="([^"]*)"', html))
    body = re.sub(r"(?s)<[^>]+>", " ", html)
    body = re.sub(r"&nbsp;|&#160;", " ", body); body = re.sub(r"&amp;", "&", body)
    return re.sub(r"\s+", " ", title + " . " + meta + " . " + body).strip(), (title + " " + meta)


def fmt(v, u):
    v = float(v); u = (u or "").lower()
    mult = 1e3 if u in ("k", "thousand") else 1e9 if u == "b" else 1e6 if u in ("m", "mm", "million") else 1
    n = v * mult
    if n < 1e3: return None
    return ("$%gK" % (n / 1e3)) if n < 1e6 else ("$%gM" % round(n / 1e6, 2)) if n < 1e9 else ("$%gB" % (n / 1e9))


def find_check(t):
    for m in CHECK.finditer(t):
        ctx = t[max(0, m.start() - 120): m.end() + 60]
        if not CHECK_CTX.search(ctx) or re.search(r"fund (?:size|of)|aum|under management|raised|portfolio companies", ctx, re.I):
            continue
        a, b = fmt(m.group(1), m.group(2) or m.group(4)), fmt(m.group(3), m.group(4))
        if a and b and a != b:
            return a + "–" + b
    return ""


def classify(texts, head):
    t = " ".join(texts)
    low = t.lower()
    stage = [lab for lab, rx in STAGES if re.search(rx, low)]
    scores = []
    for lab, rx in SECTORS:
        n = len(re.findall(rx, low))
        if re.search(rx, head.lower()): n += 3
        if n >= 2: scores.append((n, lab))
    scores.sort(reverse=True)
    focus = [lab for _, lab in scores[:6]]
    years = [int(y) for y in re.findall(r"(?:©|copyright|&copy;)\s*(?:\d{4}\s*[-–]\s*)?(20\d\d)", t, re.I)] or \
            [int(y) for y in re.findall(r"\b(202[0-9])\b", t)]
    return {"stage": ", ".join(stage), "focus": ", ".join(focus), "check": find_check(t),
            "latest_year": max(years) if years else None}


def get(url):
    r = S.get(url, timeout=12, allow_redirects=True)
    ctype = r.headers.get("content-type", "")
    return r, (r.text if "html" in ctype or not ctype else "")


def crawl(host, prev):
    rec = {"checked": TODAY}
    try:
        r, html = get("https://" + host)
    except requests.exceptions.SSLError:
        try: r, html = get("http://" + host)
        except Exception: r, html = None, ""
    except Exception:
        r, html = None, ""
    if r is None or r.status_code in (404, 410) or r.status_code >= 500 or (html and PARKED.search(html[:20000])):
        rec["status"] = "dead"; rec["dead_runs"] = (prev or {}).get("dead_runs", 0) + 1
        return host, {**(prev or {}), **rec}
    if r.status_code in (401, 403, 429) or not html:
        rec["status"] = "blocked"
        return host, {**(prev or {}), **rec, "dead_runs": 0}
    texts, heads = [], []
    t, head = text_of(html); texts.append(t); heads.append(head)
    base = r.url
    links = []
    for href in re.findall(r'(?i)href="([^"#]+)"', html):
        u = urljoin(base, href)
        if urlparse(u).netloc.replace("www.", "") == urlparse(base).netloc.replace("www.", "") and ABOUT.search(urlparse(u).path):
            if u not in links: links.append(u)
    for u in links[:3]:
        try:
            _, h2 = get(u)
            if h2: t2, hd2 = text_of(h2); texts.append(t2[:60000]); heads.append(hd2)
        except Exception:
            pass
    rec.update(classify(texts, " ".join(heads)))
    rec["status"] = "ok"; rec["dead_runs"] = 0
    if urlparse(base).netloc.replace("www.", "") != host:
        rec["moved_to"] = urlparse(base).netloc.replace("www.", "")
    return host, rec


def main():
    feed = json.load(open(FEED))
    old = json.load(open(OUT)) if os.path.exists(OUT) else {}
    hosts = []
    for r in feed:
        w = (r.get("w") or "").lower()
        if not w or "linkedin.com" in w: continue
        h = re.sub(r"^https?://", "", w).split("/")[0].replace("www.", "")
        if h and h not in hosts: hosts.append(h)
    limit = int(os.environ.get("LIMIT", "0") or 0)
    todo = []
    for h in hosts:
        p = old.get(h)
        if p and p.get("checked") and (datetime.date.fromisoformat(p["checked"]) > datetime.date.today() - datetime.timedelta(days=MAX_AGE_DAYS)):
            continue
        todo.append(h)
    if limit: todo = todo[:limit]
    print("hosts", len(hosts), "to check", len(todo), flush=True)
    done = 0; t0 = time.time()
    with cf.ThreadPoolExecutor(max_workers=int(os.environ.get("WORKERS", "40"))) as ex:
        futs = [ex.submit(crawl, h, old.get(h)) for h in todo]
        for f in cf.as_completed(futs):
            try:
                h, rec = f.result(timeout=90); old[h] = rec
            except Exception as e:
                print("err", e, flush=True)
            done += 1
            if done % 200 == 0:
                print(done, "done", round(time.time() - t0), "s", flush=True)
                json.dump(old, open(OUT, "w"), indent=0, sort_keys=True)
    json.dump(old, open(OUT, "w"), indent=0, sort_keys=True)
    st = {}
    for v in old.values(): st[v.get("status")] = st.get(v.get("status"), 0) + 1
    print("status counts", st)
    print("with stage", sum(1 for v in old.values() if v.get("stage")), "with focus", sum(1 for v in old.values() if v.get("focus")),
          "with check", sum(1 for v in old.values() if v.get("check")))


if __name__ == "__main__":
    main()
