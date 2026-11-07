#!/usr/bin/env python3
"""
Fact sheets for profile writing.

    python pipeline/profile_facts.py --edition 2026     # writes build/facts-<edition>/<slug>.txt

Every number a profile may use is pre-formatted here, so profiles never compute or recall
figures. `check_profiles.py` then verifies that every number in a profile appears in its sheet.
Only the edition file is read: no outside data.
"""
from __future__ import annotations

import argparse, json, math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def money(v: float | None) -> str | None:
    if v is None:
        return None
    if v >= 1e12:
        return f"US${v / 1e12:.2f} trillion"
    if v >= 1e9:
        return f"US${v / 1e9:.1f} billion"
    return f"US${v / 1e6:.0f} million"


def pct(v, nd=1, sign=False):
    if v is None:
        return None
    return f"{v:+.{nd}f}%" if sign else f"{v:.{nd}f}%"


def num(v):
    return None if v is None else f"{v:,.0f}"


def people(v):
    if v is None:
        return None
    if v >= 1e9:
        return f"{v / 1e9:.2f} billion"
    if v >= 1e6:
        return f"{v / 1e6:.1f} million"
    return f"{v:,.0f}"


def ordinal(n: int) -> str:
    suf = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suf}"


def rank_of(rows, key):
    vals = sorted([r for r in rows if key(r) is not None], key=lambda r: -key(r))
    return {r["iso3"]: i + 1 for i, r in enumerate(vals)}, len(vals)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--edition", type=int, required=True)
    ap.add_argument("--src", help="edition json (default build/economies-<edition>.json)")
    a = ap.parse_args()
    src = Path(a.src or ROOT / "build" / f"economies-{a.edition}.json")
    ed = json.loads(src.read_text())
    E, Y, N = ed["economies"], ed["data_year"], len(ed["economies"])
    by = {e["iso3"]: e for e in E}
    y0 = str(min(int(k) for e in E for k in e["gdp_history"]))
    pc_rank, pc_n = rank_of(E, lambda e: e["gdp_pc"])
    r0, n0 = rank_of(E, lambda e: e["gdp_history"].get(y0))
    fy = str(max(int(k) for e in E for k in (e["imf_forecast"] or {})))
    rf, nf = rank_of(E, lambda e: (e["imf_forecast"] or {}).get(fy))
    reg_rank = {}
    for reg in {e["region"] for e in E}:
        rr = sorted([e for e in E if e["region"] == reg], key=lambda e: e["rank"])
        for i, e in enumerate(rr):
            reg_rank[e["iso3"]] = (i + 1, len(rr))
    ordered = sorted(E, key=lambda e: e["rank"])
    out = ROOT / "build" / f"facts-{a.edition}"
    out.mkdir(parents=True, exist_ok=True)
    for i, e in enumerate(ordered):
        L = []
        add = lambda k, v: L.append(f"{k}: {v}") if v is not None else None
        add("Economy", e["name"])
        add("Region", f"{e['region']} ({ordinal(reg_rank[e['iso3']][0])} largest of {reg_rank[e['iso3']][1]} economies in the region)")
        add("Income group (World Bank)", e["income_group"])
        add("Capital", e["capital"]); add("Currency", e["currency"])
        add(f"GDP rank, {Y}", f"{ordinal(e['rank'])} of {N}")
        if e["prior_rank"]:
            ch = e["rank_change"] or 0
            mv = "unchanged" if ch == 0 else (f"up {ch} place{'s' if abs(ch) != 1 else ''}" if ch > 0 else f"down {-ch} place{'s' if abs(ch) != 1 else ''}")
            add(f"GDP rank, {Y - 1}", f"{ordinal(e['prior_rank'])} ({mv})")
        add(f"GDP, {Y} (current US$)", money(e["gdp"]))
        if e["gdp_prev"]:
            add(f"GDP, {Y - 1} (current US$)", money(e["gdp_prev"]))
            add(f"Change in US$ GDP, {Y - 1} to {Y}", pct((e["gdp"] / e["gdp_prev"] - 1) * 100, 1, True))
        add(f"Real GDP growth, {Y}", pct(e["growth"], 1, True))
        if e["gdp_prev"] and e["growth"] is not None:
            gap = (e["gdp"] / e["gdp_prev"] - 1) * 100 - e["growth"]
            if abs(gap) >= 5:
                add("Note", f"US$ GDP change ran {abs(gap):.1f} percentage points {'above' if gap > 0 else 'below'} real growth: the difference is exchange-rate and price effects, not output")
        add("Share of world GDP", f"{e['share_world']:.2f}%" if e["share_world"] >= 0.01 else "less than 0.01%")
        if e["gdp_pc"] is not None:
            add(f"GDP per capita, {Y}", f"US${num(e['gdp_pc'])} ({ordinal(pc_rank[e['iso3']])} of {pc_n})")
        if e["gdp_pc_ppp"] is not None:
            add(f"GDP per capita, PPP, {Y}", f"${num(e['gdp_pc_ppp'])} international dollars" + (f" ({ordinal(e['gdp_pc_ppp_rank'])})" if e["gdp_pc_ppp_rank"] else ""))
        add("Population", people(e["population"]))
        add("Inflation (consumer prices)", pct(e["inflation"]))
        add("Unemployment (% of labor force)", pct(e["unemployment"]))
        add("Government gross debt (% of GDP, IMF)", pct(e["debt_pct_gdp"]))
        for s in e["sectors"] or []:
            add(f"Sector: {s['sector']} (value added, % of GDP, {s['year']})", pct(s["share"]))
        if e["manufacturing_pct"] is not None:
            add(f"Manufacturing, part of industry (% of GDP, {e['manufacturing_year']})", pct(e["manufacturing_pct"]))
        g0 = e["gdp_history"].get(y0)
        if g0:
            add(f"GDP, {y0}", money(g0))
            add(f"GDP growth in US$ terms, {y0} to {Y}", f"{e['gdp'] / g0:.1f}x")
            add(f"GDP rank, {y0} (among this edition's economies with {y0} data)", f"{ordinal(r0[e['iso3']])} of {n0}")
        hist = {int(k): v for k, v in e["gdp_history"].items() if v}
        if hist:
            pk = max(hist, key=hist.get)
            if pk != Y:
                add("Peak US$ GDP year", f"{pk} ({money(hist[pk])})")
        f = (e["imf_forecast"] or {}).get(fy)
        if f:
            add(f"IMF forecast GDP, {fy}", money(f))
            add(f"IMF forecast change, {Y} to {fy}", pct((f / e["gdp"] - 1) * 100, 0, True))
            add(f"Rank by IMF {fy} forecast (among {nf} economies with forecasts)", ordinal(rf[e["iso3"]]))
        if e["size_equivalent"]:
            add("U.S. size equivalent", e["size_equivalent"]["label"])
        if i > 0:
            add("Next larger economy", f"{ordered[i - 1]['name']} ({ordinal(ordered[i - 1]['rank'])})")
        if i < N - 1:
            add("Next smaller economy", f"{ordered[i + 1]['name']} ({ordinal(ordered[i + 1]['rank'])})")
        if e["gdp_pc_ppp_rank"] and pc_rank.get(e["iso3"]):
            d = pc_rank[e["iso3"]] - e["gdp_pc_ppp_rank"]
            if abs(d) >= 15:
                add("Note", f"ranks {abs(d)} places {'higher' if d > 0 else 'lower'} on PPP per capita than on nominal per capita: local prices are {'low' if d > 0 else 'high'}")
        for k, why in (e["missing"] or {}).items():
            add(f"Missing: {k}", why)
        if e.get("note"):
            add("Data note", e["note"])
        (out / f"{e['slug']}.txt").write_text("\n".join(L) + "\n")
    print(f"{N} fact sheets -> {out}")


if __name__ == "__main__":
    main()
