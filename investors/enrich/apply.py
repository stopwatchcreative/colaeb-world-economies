#!/usr/bin/env python3
"""Merge what crawl.py learned from investor websites into the feed the page loads.

investors-feed.json (built by build.py from Manny's source lists)  +  enrich/sites.json
  ->  investors/investors-feed-enriched.json

- Fills stage, focus and check size only where the source lists left them blank (source data wins).
- Drops investors whose website failed two monthly checks in a row (dead or parked domain).
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
FEED = os.path.join(HERE, "..", "investors-feed.json")
SITES = os.path.join(HERE, "sites.json")
OUT = os.path.join(HERE, "..", "investors-feed-enriched.json")


def host(u):
    u = (u or "").lower()
    if not u or "linkedin.com" in u: return ""
    return re.sub(r"^https?://", "", u).split("/")[0].replace("www.", "")


def main():
    feed = json.load(open(FEED))
    sites = json.load(open(SITES)) if os.path.exists(SITES) else {}
    out, st = [], {"kept": 0, "dropped_dead": 0, "stage_added": 0, "focus_added": 0, "check_added": 0}
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
        out.append(r); st["kept"] += 1
    json.dump(out, open(OUT, "w"), separators=(",", ":"), ensure_ascii=False)
    tot = len(out)
    have = lambda k: sum(1 for r in out if (r.get("x") or {}).get(k))
    print(st, "| now with stage", have("stage"), "/", tot, "focus", have("focus"), "check", have("check"))


if __name__ == "__main__":
    main()
