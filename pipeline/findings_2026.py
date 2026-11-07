#!/usr/bin/env python3
"""
2026 Edition Key Findings and Climbers & Fallers.

    python pipeline/findings_2026.py   # writes findings/2026/findings.json

The copy is written per edition; every number in it is formatted here from the edition file,
never typed by hand. For 2027, copy this file to findings_2027.py and rewrite the copy.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EDITION = 2026
ed = json.loads((ROOT / "build" / f"economies-{EDITION}.json").read_text())
E, W, Y = ed["economies"], ed["world"], ed["data_year"]
by = {e["iso3"]: e for e in E}


def T(v): return f"US${v / 1e12:.2f} trillion"
def B(v): return f"US${v / 1e9:.1f} billion"
def M(v): return T(v) if v >= 1e12 else B(v)
def S(v): return f"${v / 1e12:.2f}T" if v >= 1e12 else f"${v / 1e9:.1f}B"
def P(v, nd=1, s=False): return f"{v:+.{nd}f}%" if s else f"{v:.{nd}f}%"
def usd_chg(e): return (e["gdp"] / e["gdp_prev"] - 1) * 100
def fc(e, y): return (e["imf_forecast"] or {}).get(str(y))


def ordn(n):
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


_g = sorted([e for e in E if e["growth"] is not None], key=lambda e: -e["growth"])
def grow_rank(e): return _g.index(e) + 1
_r0 = sorted([e for e in E if e["gdp_history"].get("2000")], key=lambda e: -e["gdp_history"]["2000"])
def rank2000(e): return _r0.index(e) + 1


USA, CHN, GBR, IND, JPN, ETH, GHA = (by[k] for k in ("USA", "CHN", "GBR", "IND", "JPN", "ETH", "GHA"))
both = [e for e in E if e["gdp_prev"]]
world_chg = (sum(e["gdp"] for e in both) / sum(e["gdp_prev"] for e in both) - 1) * 100
tc = [e for e in E if e["gdp"] >= 1e12]
tc_new = [e for e in tc if (e["gdp_prev"] or 0) < 1e12]
smallest100 = sorted(E, key=lambda e: e["gdp"])[:100]
s100 = sum(e["gdp"] for e in smallest100) / W["gdp"] * 100
pcs = sorted([e for e in E if e["gdp_pc"]], key=lambda e: -e["gdp_pc"])
hi, lo = pcs[0], pcs[-1]
fy = 2027
f27 = sorted([e for e in E if fc(e, fy)], key=lambda e: -fc(e, fy))

findings = [
    {"title": f"The world economy reached {T(W['gdp'])}",
     "body": f"World GDP in {Y} came to {T(W['gdp'])} in current U.S. dollars. Measured across the economies with data for both years, dollar GDP rose {P(world_chg, 1)} on {Y - 1}. (World total is the World Bank's world aggregate.)",
     "number": S(W["gdp"]), "link": "?metric=gdp"},
    {"title": f"The U.S. alone is {P(USA['share_world'], 2)} of world output",
     "body": f"At {T(USA['gdp'])}, the United States produced {P(USA['share_world'], 2)} of world GDP. Add China and the two account for {P(USA['share_world'] + CHN['share_world'], 2)}. The U.S. economy is {USA['gdp'] / CHN['gdp']:.2f} times the size of China's.",
     "number": P(USA["share_world"], 2), "link": "?compare=united-states,china"},
    {"title": "The UK retook fifth place from India, narrowly",
     "body": f"The UK's {T(GBR['gdp'])} edged out India's {T(IND['gdp'])}, even though India's real growth ({P(IND['growth'], 1, True)}) outpaced the UK's ({P(GBR['growth'], 1, True)}). Both the World Bank and IMF figures put the UK ahead for {Y}.",
     "number": S(GBR["gdp"]), "link": "?compare=united-kingdom,india"},
    {"title": f"India passes Japan and the UK in {fy}, the IMF projects",
     "body": f"In the IMF's October 2026 forecasts, India reaches {T(fc(IND, fy))} in {fy}, ahead of the UK ({T(fc(GBR, fy))}) and Japan ({T(fc(JPN, fy))}), making it the {ordn(f27.index(IND) + 1)}-largest economy that year. In {Y}, Japan was {ordn(JPN['rank'])} and India {ordn(IND['rank'])}.",
     "number": S(fc(IND, fy)), "link": "?compare=india,japan,united-kingdom"},
    {"title": f"The trillion-dollar club grew to {len(tc)}",
     "body": f"{len(tc)} economies topped US$1 trillion in {Y}, up from {len(tc) - len(tc_new)} in {Y - 1}. The newcomers: " + " and ".join(f"{e['name']} ({T(e['gdp'])})" for e in tc_new) + ".",
     "number": str(len(tc)), "link": f"#rank-{len(tc)}"},
    {"title": "Currency, not output, drove the biggest climb",
     "body": f"Ghana rose {GHA['rank_change']} places to {ordn(GHA['rank'])}, the biggest climb in this edition. Its dollar GDP jumped {P(usd_chg(GHA), 1)} while real output grew {P(GHA['growth'], 1, True)}: most of the gain came from exchange-rate and price effects.",
     "number": f"+{GHA['rank_change']} places", "link": "?metric=rank_change"},
    {"title": "Fast growth, falling rank",
     "body": f"Ethiopia's real economy grew {P(ETH['growth'], 1, True)}, the {ordn(grow_rank(ETH))}-fastest rate in the world, yet it fell {-ETH['rank_change']} places to {ordn(ETH['rank'])} as its GDP measured in dollars dropped {P(-usd_chg(ETH), 1)}.",
     "number": P(ETH["growth"], 1, True), "link": "?metric=growth"},
    {"title": f"Ten economies hold {P(W['top10_share'], 1)} of world output",
     "body": f"The top 10 produced {P(W['top10_share'], 1)} of world GDP. The smallest 100 economies together produced {P(s100, 2)}.",
     "number": P(W["top10_share"], 1), "link": "#rankings"},
    {"title": f"China's economy is {CHN['gdp'] / CHN['gdp_history']['2000']:.1f} times its 2000 size",
     "body": f"China grew from {T(CHN['gdp_history']['2000'])} in 2000 to {T(CHN['gdp'])} in {Y} in current dollars, and from {ordn(rank2000(CHN))} in the world to {ordn(CHN['rank'])}.",
     "number": f"{CHN['gdp'] / CHN['gdp_history']['2000']:.1f}x", "link": "?compare=china,united-states"},
    {"title": f"Per person, a {hi['gdp_pc'] / lo['gdp_pc']:,.0f}-fold gap",
     "body": f"GDP per person ranged from US${hi['gdp_pc']:,.0f} in {hi['name']} to US${lo['gdp_pc']:,.0f} in {lo['name']}, a gap of {hi['gdp_pc'] / lo['gdp_pc']:,.0f} times.",
     "number": f"{hi['gdp_pc'] / lo['gdp_pc']:,.0f}x", "link": f"?compare={hi['slug']},{lo['slug']}&metric=gdp_pc"},
]


def reason(e):
    u, g, inf = usd_chg(e), e["growth"], e["inflation"]
    gap = u - g
    s = f"Dollar GDP {'rose' if u >= 0 else 'fell'} {P(abs(u), 1)} against real growth of {P(g, 1, True)}"
    if inf is not None:
        s += f" and inflation of {P(inf, 1)}"
    s += ". "
    if e["rank_change"] > 0:
        if g <= 0:
            s += "Real output shrank, so the climb came entirely from exchange-rate and price effects."
        elif g / u < 1 / 3:
            s += "Most of the climb came from exchange-rate and price effects, not output."
        else:
            s += "Real growth and exchange-rate and price effects both contributed."
    else:
        if g > 0 and u < 0:
            s += "A weaker dollar value offset real growth and drove the fall."
        elif abs(u) < 5:
            s += "Others grew faster in dollar terms and moved past it."
        else:
            s += "Both output and the dollar value declined."
    return s


mv = sorted([e for e in E if e["rank_change"] is not None], key=lambda e: -e["rank_change"])
fmt = lambda e: {"slug": e["slug"], "name": e["name"], "rank": e["rank"], "prior_rank": e["prior_rank"],
                 "rank_change": e["rank_change"], "gdp": M(e["gdp"]), "usd_change": P(usd_chg(e), 1, True),
                 "real_growth": P(e["growth"], 1, True), "reason": reason(e)}
out = {"edition": EDITION, "data_year": Y,
       "movement_note": f"Movement compares {Y} with {Y - 1} GDP ranks for the same economies (inaugural edition). Revisions to past data are not counted as movement in this edition.",
       "findings": findings, "climbers": [fmt(e) for e in mv[:5]], "fallers": [fmt(e) for e in mv[::-1][:5]]}
p = ROOT / "findings" / str(EDITION)
p.mkdir(parents=True, exist_ok=True)
(p / "findings.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
for f in findings:
    print("*", f["title"], "|", f["body"])
for k in ("climbers", "fallers"):
    for e in out[k]:
        print(k[:5], e["name"], e["rank_change"], e["reason"])
