#!/usr/bin/env python3
"""Read the websites listed in describe-hosts.txt and save the text that describes each firm.

For each host: the homepage and the first "about"-style page linked from it. Saves the page title,
meta/og description and the opening paragraphs to site-text.json, which is used to write the
2-4 sentence descriptions on investor profile pages (colaeb.com/investors/<slug>).
"""
import json, os, re, time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlparse
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
HOSTS = os.path.join(HERE, "describe-hosts.txt")
OUT = os.path.join(HERE, "site-text.json")
UA = "Mozilla/5.0 (compatible; ColaebInvestorList/1.0; +https://colaeb.com/investors)"
ABOUT = re.compile(r"/(about|about-us|who-we-are|thesis|approach|philosophy|our-story|firm|team|what-we-do|invest)(/|$)", re.I)


def clean(t):
    t = re.sub(r"(?s)<[^>]+>", " ", t)
    for a, b in (("&amp;", "&"), ("&#x27;", "'"), ("&#39;", "'"), ("&rsquo;", "'"), ("&quot;", '"'), ("&nbsp;", " "), ("&mdash;", "-"), ("&ndash;", "-")):
        t = t.replace(a, b)
    return re.sub(r"\s+", " ", t).strip()


def meta(html, prop):
    m = re.search(r'(?is)<meta[^>]+(?:property|name)=["\']%s["\'][^>]*content=["\']([^"\']*)' % re.escape(prop), html) or \
        re.search(r'(?is)<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']%s["\']' % re.escape(prop), html)
    return clean(m.group(1)) if m else ""


def paras(html, n=10):
    html = re.sub(r"(?is)<(script|style|noscript|svg|nav|footer|header|form)[^>]*>.*?</\1>", " ", html)
    out = []
    for p in re.findall(r"(?is)<(?:p|h1|h2|h3)[^>]*>(.*?)</(?:p|h1|h2|h3)>", html):
        t = clean(p)
        if 40 <= len(t) <= 600 and not re.search(r"cookie|privacy|©|copyright|subscribe|newsletter", t, re.I) and t not in out:
            out.append(t)
        if len(out) >= n: break
    return out


def get(url):
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=15, allow_redirects=True)
        if r.ok and "html" in r.headers.get("content-type", "html"): return r.url, r.text[:800000]
    except Exception:
        pass
    return "", ""


def one(host):
    url, html = get("https://" + host)
    if not html: url, html = get("http://" + host)
    if not html: return host, {"ok": False}
    rec = {"ok": True, "url": url, "title": clean(re.search(r"(?is)<title[^>]*>(.*?)</title>", html).group(1)) if re.search(r"(?is)<title[^>]*>(.*?)</title>", html) else "",
           "desc": meta(html, "description"), "og": meta(html, "og:description"), "home": paras(html)}
    base = urlparse(url).netloc
    for href in re.findall(r'(?is)<a[^>]+href=["\']([^"\'#]+)', html):
        u = urljoin(url, href)
        if urlparse(u).netloc == base and ABOUT.search(urlparse(u).path):
            _, h2 = get(u)
            if h2: rec["about_url"], rec["about"] = u, paras(h2, 8)
            break
    return host, rec


def main():
    hosts = [h.strip() for h in open(HOSTS) if h.strip() and not h.startswith("#")]
    data = json.load(open(OUT)) if os.path.exists(OUT) else {}
    todo = [h for h in hosts if h not in data]
    print("hosts", len(hosts), "to read", len(todo), flush=True)
    with ThreadPoolExecutor(max_workers=8) as ex:
        for k, (h, rec) in enumerate(ex.map(one, todo)):
            rec["read"] = time.strftime("%Y-%m-%d"); data[h] = rec
            if k % 50 == 0: print("read", k, flush=True)
    json.dump(data, open(OUT, "w"), indent=0, sort_keys=True, ensure_ascii=False)
    print("ok", sum(1 for v in data.values() if v.get("ok")), "of", len(data))


if __name__ == "__main__":
    main()
