#!/usr/bin/env python3
"""Merge what crawl.py learned from investor websites into the feed the page loads.

investors-feed.json (built by build.py from Manny's source lists)  +  enrich/sites.json
  ->  investors/investors-feed-enriched.json

- Fills stage, focus and check size only where the source lists left them blank (source data wins).
- Drops investors whose website failed two monthly checks in a row (dead or parked domain).
- Holds back listings that look wrong (a third-party or broken page as the website, an unlikely stage for the
  investor type, or a firm that is not an investor). They go to enrich/held.json for review instead of the page.
  Add a name or host to enrich/hold.tsv to hold one by hand, or to enrich/keep.tsv to show one anyway.
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
FEED = os.path.join(HERE, "..", "investors-feed.json")
SITES = os.path.join(HERE, "sites.json")
OUT = os.path.join(HERE, "..", "investors-feed-enriched.json")
HELD = os.path.join(HERE, "held.json")

# Websites on these hosts are someone else's page about the investor, not the investor's own site.
THIRD_PARTY = {"pitchbook.com", "crunchbase.com", "thehub.io", "italian.tech", "about.me", "eif.org", "dealroom.co",
               "f6s.com", "startupportugal.com", "british-business-bank.co.uk", "wellfound.com", "angel.co", "cbinsights.com"}
# Paths that point at a news item, a legal page or a broken link rather than the investor's home page.
BAD_PATH = re.compile(r"(?i)/(privacy|undefined|lander|n|stories|news|newsroom|press-media|press-releases|reports|legacy-programmes)(/|$|\.)|press-release|/20[01]\d/")
# Firms that advise on deals rather than invest.
NOT_INVESTOR = re.compile(r"(?i)^(drake star)$")
LATE = re.compile(r"Series [B-F]|Growth|Late")


def tsv(name):
    path = os.path.join(HERE, name)
    if not os.path.exists(path): return {}
    out = {}
    for line in open(path):
        line = line.rstrip("\n")
        if not line.strip() or line.startswith("#"): continue
        k, _, why = line.partition("\t")
        out[k.strip().lower()] = why.strip() or "held by hand"
    return out


def hold_reason(r, hand, keep):
    n, w = r.get("n", ""), r.get("w", "")
    h, path = host(w), re.sub(r"^https?://[^/]+", "", w or "")
    if n.lower() in keep or (h and h in keep): return ""
    if n.lower() in hand: return hand[n.lower()]
    if h and h in hand: return hand[h]
    if h in THIRD_PARTY: return "website is a third-party page (" + h + ")"
    if path.strip("/") and BAD_PATH.search(path): return "website points to a news, legal or broken page"
    if NOT_INVESTOR.search(n): return "advisory firm, not an investor"
    st = (r.get("x") or {}).get("stage", "")
    if r.get("t") in ("Accelerator", "Angel investor", "Angel network") and LATE.search(st):
        return "unlikely stage for an " + r["t"].lower() + " (" + st + ")"
    return ""


def host(u):
    u = (u or "").lower()
    if not u or "linkedin.com" in u: return ""
    return re.sub(r"^https?://", "", u).split("/")[0].replace("www.", "")


def tidy_stage(s):
    parts = [p.strip() for p in re.split(r",+", s or "") if p.strip()]
    out = []
    for p in parts:
        p = re.sub(r"(?i)^pre-?seed$", "Pre-seed", p); p = re.sub(r"(?i)^seed$", "Seed", p)
        p = re.sub(r"(?i)^series ([a-f])$", lambda m: "Series " + m.group(1).upper(), p)
        if p.lower() not in [o.lower() for o in out]: out.append(p)
    return ", ".join(out)


def main():
    feed = json.load(open(FEED))
    sites = json.load(open(SITES)) if os.path.exists(SITES) else {}
    out, held, st = [], [], {"kept": 0, "dropped_dead": 0, "held": 0, "stage_added": 0, "focus_added": 0, "check_added": 0}
    hand, keep = tsv("hold.tsv"), tsv("keep.tsv")
    for r in feed:
        s = sites.get(host(r.get("w")))
        if s and s.get("status") == "dead" and s.get("dead_runs", 0) >= 2:
            st["dropped_dead"] += 1; continue
        if s and s.get("status") == "ok":
            x = dict(r.get("x") or {})
            for k in ("stage", "focus", "check"):
                if s.get(k) and not x.get(k):
                    x[k] = s[k]; st[k + "_added"] += 1
            if x: r = {**r, "x": x}
        if (r.get("x") or {}).get("stage"):
            r = {**r, "x": {**r["x"], "stage": tidy_stage(r["x"]["stage"])}}
        if r.get("t") == "Investor": r = {**r, "t": "Venture capital"}  # too vague to filter by
        why = hold_reason(r, hand, keep)
        if why:
            held.append({"n": r.get("n"), "w": r.get("w"), "t": r.get("t"), "k": r.get("k"), "why": why}); st["held"] += 1; continue
        out.append(r); st["kept"] += 1
    json.dump(out, open(OUT, "w"), separators=(",", ":"), ensure_ascii=False)
    json.dump(sorted(held, key=lambda o: o["n"].lower()), open(HELD, "w"), indent=1, ensure_ascii=False)
    tot = len(out)
    have = lambda k: sum(1 for r in out if (r.get("x") or {}).get(k))
    print(st, "| now with stage", have("stage"), "/", tot, "focus", have("focus"), "check", have("check"))


if __name__ == "__main__":
    main()
