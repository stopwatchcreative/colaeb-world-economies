#!/usr/bin/env python3
"""
World Ranking of Economies — edition builder.

One command produces a complete, validated, immutable edition:

    python pipeline/build_edition.py --edition 2026            # fetch + build + validate
    python pipeline/build_edition.py --edition 2026 --dry-run  # build into build/, never data/
    python pipeline/build_edition.py --edition 2026 --spot-check 10

Outputs (never overwritten once released):
    data/economies-<edition>.json   the edition data file the site reads
    data/economies-<edition>.csv    full dataset with source columns
    data/sources-<edition>.json     every source, URL and retrieval timestamp
    build/validation-<edition>.txt  validation report
    build/cms-economies-<edition>.json  rows mapped to Webflow CMS field slugs

Environment:
    BEA_API_KEY     required for U.S. state / metro "size equivalents"
    UN_WPP_TOKEN    optional; UN WPP population fill for economies missing WB population
"""
from __future__ import annotations

import argparse, csv, datetime as dt, gzip, json, math, os, random, re, sys, time, unicodedata
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
DATA, BUILD, PROFILES, FINDINGS = ROOT / "data", ROOT / "build", ROOT / "profiles", ROOT / "findings"
RELEASED = DATA / "released.json"          # editions listed here are frozen forever
COUNTRIES_PKG = ROOT / "pipeline" / "vendor" / "countries.json"   # mledoze/countries (npm: world-countries)

WB = "https://api.worldbank.org/v2"
IMF = "https://www.imf.org/external/datamapper/api/v1"
BEA = "https://apps.bea.gov/api/data"
UN = "https://population.un.org/dataportalapi/api/v1"

SOURCES: list[dict] = []
UA = {"User-Agent": "colaeb-wer-pipeline/1.0"}


# ---------------------------------------------------------------- utilities
def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def log_source(name: str, url: str, **extra) -> None:
    SOURCES.append({"name": name, "url": url, "retrieved": now_iso(), **extra})


def get_json(url: str, params: dict | None = None, headers: dict | None = None, tries: int = 4):
    for i in range(tries):
        try:
            r = requests.get(url, params=params, headers={**UA, **(headers or {})}, timeout=90)
            r.raise_for_status()
            return r.json()
        except Exception as e:  # network hiccups / 5xx
            if i == tries - 1:
                raise RuntimeError(f"GET failed {url} {params}: {e}") from e
            time.sleep(2 ** i)


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s


def r(x, nd=2):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(x, nd)


# ---------------------------------------------------------------- World Bank
def wb_meta() -> dict:
    url = f"{WB}/country"
    js = get_json(url, {"format": "json", "per_page": 500})
    log_source("World Bank country metadata (regions, income groups, capitals)", url + "?format=json&per_page=500")
    out = {}
    for c in js[1]:
        if c["region"]["id"] == "NA":       # aggregates
            continue
        out[c["id"]] = {
            "wb_name": c["name"], "region": c["region"]["value"].strip(),
            "income_group": c["incomeLevel"]["value"].strip(), "capital": c["capitalCity"] or None,
        }
    return out


def wb_indicator(code: str, y0: int, y1: int) -> tuple[dict, str | None]:
    """returns {iso3: {year: value}}, lastupdated"""
    url = f"{WB}/country/all/indicator/{code}"
    out: dict[str, dict[int, float]] = {}
    page, pages, last = 1, 1, None
    while page <= pages:
        js = get_json(url, {"format": "json", "date": f"{y0}:{y1}", "per_page": 20000, "page": page})
        hdr, rows = js[0], js[1] or []
        pages, last = hdr.get("pages", 1), hdr.get("lastupdated")
        for row in rows:
            iso, v = row.get("countryiso3code"), row.get("value")
            if iso and v is not None:
                out.setdefault(iso, {})[int(row["date"])] = float(v)
        page += 1
    log_source(f"World Bank WDI {code}", f"{url}?format=json&date={y0}:{y1}", source_last_updated=last)
    return out, last


# ---------------------------------------------------------------- IMF WEO (DataMapper)
def imf_indicator(code: str, remap: dict) -> dict:
    url = f"{IMF}/{code}"
    js = get_json(url)
    vals = js.get("values", {}).get(code, {})
    out = {}
    for iso, series in vals.items():
        iso = remap.get(iso, iso)
        out[iso] = {int(y): float(v) for y, v in series.items() if v is not None}
    log_source(f"IMF WEO {code}", url)
    return out


# ---------------------------------------------------------------- BEA (size equivalents)
def bea_gdp(year: int) -> list[dict]:
    key = os.environ.get("BEA_API_KEY")
    if not key:
        print("! BEA_API_KEY not set: size equivalents will be empty", file=sys.stderr)
        return []
    rows = []
    for table, geo, kind in (("SAGDP2", "STATE", "state"), ("CAGDP2", "MSA", "metro")):
        params = {"UserID": key, "method": "GetData", "datasetname": "Regional", "TableName": table,
                  "LineCode": 1, "GeoFips": geo, "Year": "LAST5", "ResultFormat": "json"}
        js = get_json(BEA, params)
        data = js["BEAAPI"]["Results"]["Data"]
        years = sorted({int(d["TimePeriod"]) for d in data if int(d["TimePeriod"]) <= year})
        use = years[-1]
        for d in data:
            if int(d["TimePeriod"]) != use or d["GeoFips"] in ("00000", "00998"):
                continue
            try:
                v = float(d["DataValue"].replace(",", "")) * 1e6  # millions of current dollars
            except ValueError:
                continue
            name = re.sub(r"\s*\(Metropolitan Statistical Area\)", "", d["GeoName"]).replace(" *", "")
            rows.append({"name": name, "kind": kind, "year": use, "gdp": v})
        log_source(f"BEA Regional {table} ({kind} GDP, current $)", f"{BEA}?datasetname=Regional&TableName={table}&LineCode=1&GeoFips={geo}", data_year_used=use)
    return rows


# ---------------------------------------------------------------- UN WPP (population fill)
def un_population(m49_codes: dict[str, str], year: int) -> dict:
    tok = os.environ.get("UN_WPP_TOKEN")
    if not tok or not m49_codes:
        return {}
    out = {}
    for iso, m49 in m49_codes.items():
        url = f"{UN}/data/indicators/49/locations/{int(m49)}/start/{year}/end/{year}"
        try:
            js = get_json(url, headers={"Authorization": f"Bearer {tok}"})
            vals = [d for d in js.get("data", []) if d.get("variant") == "Median" and d.get("sex") == "Both sexes"]
            if vals:
                out[iso] = float(vals[0]["value"]) * 1000 if vals[0].get("unit", "").startswith("Thousand") else float(vals[0]["value"])
        except Exception as e:
            print(f"! UN WPP {iso}: {e}", file=sys.stderr)
    log_source("UN World Population Prospects (total population, median variant)", f"{UN}/data/indicators/49", economies=sorted(out))
    return out


# ---------------------------------------------------------------- build
FIELD_SOURCES = {}  # iso -> {field: source}


def pick(iso, field, year, wb_series, imf_series=None, imf_scale=1.0, nd=2, allow_prev=False):
    """WB first, IMF second. Records which source was used. allow_prev lets structural shares use latest year <= year."""
    src = FIELD_SOURCES.setdefault(iso, {})
    s = (wb_series or {}).get(iso, {})
    if year in s:
        src[field] = "World Bank WDI"; return r(s[year], nd), year
    if allow_prev:
        prev = [y for y in s if y <= year]
        if prev:
            y = max(prev); src[field] = f"World Bank WDI ({y})"; return r(s[y], nd), y
    if imf_series is not None:
        si = imf_series.get(iso, {})
        if year in si:
            src[field] = "IMF WEO"; return r(si[year] * imf_scale, nd), year
    src[field] = None
    return None, None


def build(cfg: dict, args) -> dict:
    E, Y, Y0, H = cfg["edition_year"], cfg["data_year"], cfg["history_start"], cfg["forecast_years"]
    remap = cfg["imf_to_iso3"]

    meta = wb_meta()
    wb = {k: wb_indicator(code, Y0, Y)[0] for k, code in cfg["wb_indicators"].items()}
    imf = {k: imf_indicator(code, remap) for k, code in cfg["imf_indicators"].items()}

    world_gdp = wb["gdp"].get("WLD", {}).get(Y)
    if world_gdp is None:
        raise SystemExit("World Bank world aggregate (WLD) GDP missing for data year; is the July update out?")

    # country reference data (flags, currencies, common names, M49) from mledoze/countries
    pkg = json.loads(COUNTRIES_PKG.read_text())
    pmap = {cfg["countries_pkg_to_iso3"].get(c["cca3"], c["cca3"]): c for c in pkg}
    log_source("mledoze/countries (flags, currencies, common names; ODbL)", "https://github.com/mledoze/countries")

    # ---- universe: WB economies with GDP in data year, + WB economies filled from IMF, + IMF additions (Taiwan)
    universe, fill_log = {}, []
    for iso, m in meta.items():
        if Y in wb["gdp"].get(iso, {}):
            universe[iso] = {**m, "gdp_source": "World Bank WDI"}
        elif Y in imf["gdp_bn"].get(iso, {}):
            universe[iso] = {**m, "gdp_source": "IMF WEO"}
            fill_log.append(f"{iso} {m['wb_name']}: GDP {Y} not in WDI, filled from IMF WEO")
    for iso, add in cfg["imf_additions"].items():
        if Y in imf["gdp_bn"].get(iso, {}):
            universe[iso] = {k: add.get(k) for k in ("wb_name", "region", "income_group", "capital")} | {"gdp_source": "IMF WEO", "note": add["note"]}
            fill_log.append(f"{iso} {add['name']}: not in WDI, added from IMF WEO")
    excluded = sorted(f"{iso} {m['wb_name']}" for iso, m in meta.items() if iso not in universe)

    # optional UN population fill
    need_pop = {iso: pmap[iso].get("ccn3") for iso in universe
                if Y not in wb["population"].get(iso, {}) and iso in pmap and pmap[iso].get("ccn3")}
    un_pop = un_population(need_pop, Y)

    rows = []
    for iso, u in universe.items():
        p = pmap.get(iso, {})
        name = cfg["display_name_overrides"].get(iso) or (cfg["imf_additions"].get(iso, {}).get("name")) \
            or (p.get("name", {}).get("common")) or u["wb_name"]
        gdp, _ = pick(iso, "gdp", Y, wb["gdp"], imf["gdp_bn"], 1e9, 0)
        gdp_prev, _ = pick(iso, "gdp_prev", Y - 1, wb["gdp"], imf["gdp_bn"], 1e9, 0)
        pop, _ = pick(iso, "population", Y, wb["population"], imf["population_m"], 1e6, 0)
        if pop is None and iso in un_pop:
            pop = r(un_pop[iso], 0); FIELD_SOURCES[iso]["population"] = "UN WPP"

        history = {}
        for yr in range(Y0, Y + 1):
            v, _ = pick(iso, f"_h{yr}", yr, wb["gdp"], imf["gdp_bn"], 1e9, 0)
            if v is not None:
                history[yr] = v
        forecast = {yr: r(imf["gdp_bn"][iso][yr] * 1e9, 0) for yr in range(Y + 1, Y + H + 1)
                    if yr in imf["gdp_bn"].get(iso, {})}

        sectors = []
        for key, label in (("agri_pct", "Agriculture"), ("industry_pct", "Industry"), ("services_pct", "Services")):
            v, yr = pick(iso, key, Y, wb[key], None, nd=1, allow_prev=True)
            if v is not None:
                sectors.append({"sector": label, "share": v, "year": yr})
        manuf, manuf_y = pick(iso, "manuf_pct", Y, wb["manuf_pct"], None, nd=1, allow_prev=True)
        sectors.sort(key=lambda s: -s["share"])

        row = {
            "iso3": iso, "slug": slugify(name), "name": name, "wb_name": u.get("wb_name"),
            "flag": p.get("flag"), "region": u["region"], "income_group": u["income_group"] or None,
            "currency": ", ".join(f"{c['name']} ({k})" for k, c in (p.get("currencies") or {}).items()) or None,
            "capital": u.get("capital") or (p.get("capital") or [None])[0],
            "gdp": gdp, "gdp_prev": gdp_prev, "share_world": r(gdp / world_gdp * 100, 3),
            "growth": pick(iso, "growth", Y, wb["growth"], imf["growth"], 1, 2)[0],
            "gdp_pc": pick(iso, "gdp_pc", Y, wb["gdp_pc"], imf["gdp_pc"], 1, 0)[0],
            "gdp_pc_ppp": pick(iso, "gdp_pc_ppp", Y, wb["gdp_pc_ppp"], imf["gdp_pc_ppp"], 1, 0)[0],
            "population": pop,
            "inflation": pick(iso, "inflation", Y, wb["inflation"], imf["inflation"], 1, 2)[0],
            "unemployment": pick(iso, "unemployment", Y, wb["unemployment"], imf["unemployment"], 1, 2)[0],
            "debt_pct_gdp": pick(iso, "debt", Y, None, imf["debt"], 1, 1)[0],
            "sectors": sectors[:3], "manufacturing_pct": manuf, "manufacturing_year": manuf_y,
            "gdp_history": history, "imf_forecast": forecast,
            "note": u.get("note"),
        }
        FIELD_SOURCES[iso] = {k: v for k, v in FIELD_SOURCES[iso].items() if not k.startswith("_h")}
        row["field_sources"] = FIELD_SOURCES[iso]
        rows.append(row)

    # ---- ranks
    rows.sort(key=lambda x: -x["gdp"])
    for i, x in enumerate(rows, 1):
        x["rank"] = i
    prior = None
    if cfg.get("prior_edition_file"):
        prior = json.loads((ROOT / cfg["prior_edition_file"]).read_text())
        pr = {e["iso3"]: e for e in prior["economies"]}
        for x in rows:
            p_ = pr.get(x["iso3"])
            x["prior_rank"] = p_["rank"] if p_ else None
            x["rank_history"] = {**(p_["rank_history"] if p_ else {}), str(E): x["rank"]}
        movement_basis = f"Compared with the {prior['edition']} Edition ({prior['data_year']} data)"
    else:
        ranked_prev = sorted([x for x in rows if x["gdp_prev"]], key=lambda x: -x["gdp_prev"])
        prev_rank = {x["iso3"]: i for i, x in enumerate(ranked_prev, 1)}
        for x in rows:
            x["prior_rank"] = prev_rank.get(x["iso3"])
            x["rank_history"] = {str(E): x["rank"]}
        movement_basis = f"Inaugural edition: movement compares {Y} with {Y - 1} GDP for the same set of economies"
    for x in rows:
        x["rank_change"] = (x["prior_rank"] - x["rank"]) if x["prior_rank"] else None

    ppp = sorted([x for x in rows if x["gdp_pc_ppp"]], key=lambda x: -x["gdp_pc_ppp"])
    pr_ = {x["iso3"]: i for i, x in enumerate(ppp, 1)}
    for x in rows:
        x["gdp_pc_ppp_rank"] = pr_.get(x["iso3"])

    # ---- size equivalents (closest U.S. state or metro GDP)
    us = bea_gdp(Y)
    top = max(us, key=lambda s: s["gdp"]) if us else None
    for x in rows:
        if x["iso3"] == "USA" or not us:
            x["size_equivalent"] = None
            continue
        if x["gdp"] > top["gdp"] * 1.15:
            x["size_equivalent"] = {"label": f"Larger than any U.S. state ({x['gdp'] / top['gdp']:.1f}× {top['name']})",
                                    "name": top["name"], "kind": "state", "gdp": top["gdp"], "year": top["year"]}
            continue
        best = min(us, key=lambda s: abs(math.log(s["gdp"] / x["gdp"])))
        x["size_equivalent"] = {"label": f"About the size of {best['name']}" + (" metro area" if best["kind"] == "metro" else ""),
                                **best}

    # ---- missing-value notes
    labels = {"growth": "GDP growth", "gdp_pc": "GDP per capita", "gdp_pc_ppp": "GDP per capita, PPP",
              "population": "Population", "inflation": "Inflation", "unemployment": "Unemployment",
              "debt_pct_gdp": "Government gross debt"}
    for x in rows:
        notes = {}
        for k, lab in labels.items():
            if x[k] is None:
                src = "IMF WEO" if k == "debt_pct_gdp" else "the World Bank (WDI) or the IMF (WEO)"
                notes[k] = f"{lab} for {Y} is not reported by {src} for this economy."
        if not x["sectors"]:
            notes["sectors"] = "Sector shares are not reported in WDI for this economy."
        if x["size_equivalent"] is None and x["iso3"] != "USA":
            notes["size_equivalent"] = "U.S. state/metro comparison unavailable (BEA data not loaded)."
        x["missing"] = notes

    # ---- profiles (editorial, versioned per edition)
    for x in rows:
        f = PROFILES / str(E) / f"{x['slug']}.md"
        x["profile"] = f.read_text().strip() if f.exists() else None

    sum_gdp = sum(x["gdp"] for x in rows)
    out = {
        "schema": "wer-edition/1",
        "edition": E, "data_year": Y,
        "title": f"World Ranking of Economies — {E} Edition ({Y} data)",
        "generated": now_iso(), "release_date": cfg.get("release_date"),
        "next_edition_expected": cfg.get("next_edition_expected"),
        "imf_weo": cfg["imf_weo_label"],
        "movement_basis": movement_basis,
        "world": {"gdp": world_gdp, "count": len(rows), "sum_of_economies": sum_gdp,
                  "top10_share": r(sum(x["gdp"] for x in rows[:10]) / world_gdp * 100, 2)},
        "universe_notes": {"filled_from_imf": fill_log, "excluded_no_gdp": excluded},
        "economies": rows,
    }
    return out


# ---------------------------------------------------------------- validation
REQUIRED = {"iso3": str, "slug": str, "name": str, "region": str, "gdp": (int, float), "rank": int,
            "share_world": (int, float), "gdp_history": dict, "imf_forecast": dict, "missing": dict,
            "rank_history": dict, "sectors": list, "field_sources": dict}


def validate(ed: dict, cfg: dict) -> list[str]:
    errs, warn = [], []
    eco = ed["economies"]
    n = len(eco)
    if cfg.get("expected_count") and n != cfg["expected_count"]:
        errs.append(f"record count {n} != expected {cfg['expected_count']}")
    ranks = [e["rank"] for e in eco]
    if len(set(ranks)) != n or sorted(ranks) != list(range(1, n + 1)):
        errs.append("ranks are not a unique 1..N sequence")
    for k in ("iso3", "slug"):
        vals = [e[k] for e in eco]
        if len(set(vals)) != n:
            errs.append(f"duplicate {k}: {sorted({v for v in vals if vals.count(v) > 1})}")
    for e in eco:
        for f, t in REQUIRED.items():
            if f not in e or (e[f] is None) or not isinstance(e[f], t):
                errs.append(f"{e.get('iso3')}: field {f} missing or wrong type")
        if e["gdp"] <= 0:
            errs.append(f"{e['iso3']}: non-positive GDP")
        for f in ("growth", "inflation"):
            if e[f] is not None and abs(e[f]) > 400:
                warn.append(f"{e['iso3']}: {f} = {e[f]} (outlier, check)")
    diff = (ed["world"]["sum_of_economies"] - ed["world"]["gdp"]) / ed["world"]["gdp"] * 100
    line = f"sum of economies vs World Bank world GDP: {diff:+.2f}%"
    (errs if abs(diff) > 1 else warn).append(line)
    no_profile = [e["slug"] for e in eco if not e["profile"]]
    if no_profile:
        warn.append(f"{len(no_profile)} economies have no profile yet")
    for e in eco:
        if e["profile"]:
            w = len(e["profile"].split())
            if not 120 <= w <= 180:
                warn.append(f"{e['slug']}: profile is {w} words (target 120-180)")
    return [f"ERROR {x}" for x in errs] + [f"WARN  {x}" for x in warn]


# ---------------------------------------------------------------- spot check
def spot_check(ed: dict, k: int, seed: int | None) -> list[str]:
    rnd = random.Random(seed)
    sample = rnd.sample(ed["economies"], k)
    Y, out = ed["data_year"], []
    for e in sample:
        iso = e["iso3"]
        src = e["field_sources"].get("gdp")
        if src == "World Bank WDI":
            js = get_json(f"{WB}/country/{iso}/indicator/NY.GDP.MKTP.CD", {"format": "json", "date": Y})
            ref = js[1][0]["value"] if js and len(js) > 1 and js[1] else None
        else:
            js = get_json(f"{IMF}/NGDPD/{ {'XKX': 'UVK', 'PSE': 'WBG'}.get(iso, iso) }")
            v = js["values"]["NGDPD"].get({'XKX': 'UVK', 'PSE': 'WBG'}.get(iso, iso), {}).get(str(Y))
            ref = v * 1e9 if v is not None else None
        d = imf_d = None
        js2 = get_json(f"{IMF}/NGDPD/{ {'XKX': 'UVK', 'PSE': 'WBG'}.get(iso, iso) }")
        iv = js2.get("values", {}).get("NGDPD", {}).get({'XKX': 'UVK', 'PSE': 'WBG'}.get(iso, iso), {}).get(str(Y))
        if ref:
            d = (e["gdp"] - ref) / ref * 100
        if iv:
            imf_d = (e["gdp"] - iv * 1e9) / (iv * 1e9) * 100
        status = "OK" if d is not None and abs(d) < 0.01 else "MISMATCH"
        out.append(f"{status:8} {iso} {e['name']:<28} file={e['gdp']:.4g} source({src})={ref if ref is None else f'{ref:.4g}'} "
                   f"diff={'n/a' if d is None else f'{d:+.3f}%'} | vs IMF WEO: {'n/a' if imf_d is None else f'{imf_d:+.1f}%'}")
    return out


# ---------------------------------------------------------------- outputs
CSV_COLS = ["rank", "prior_rank", "rank_change", "iso3", "name", "region", "income_group", "currency", "capital",
            "gdp", "share_world", "growth", "gdp_pc", "gdp_pc_ppp", "gdp_pc_ppp_rank", "population", "inflation",
            "unemployment", "debt_pct_gdp", "sector_1", "sector_2", "sector_3", "size_equivalent"]


def write_csv(ed: dict, path: Path):
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        srcs = ["gdp", "growth", "gdp_pc", "gdp_pc_ppp", "population", "inflation", "unemployment", "debt"]
        w.writerow(CSV_COLS + [f"source_{s}" for s in srcs] + [f"gdp_{y}" for y in range(2000, ed["data_year"] + 1)])
        for e in ed["economies"]:
            sec = [f"{s['sector']} {s['share']}% ({s['year']})" for s in e["sectors"]] + ["", "", ""]
            row = [e.get(c) for c in CSV_COLS[:19]] + sec[:3] + [(e["size_equivalent"] or {}).get("label")]
            row += [e["field_sources"].get(s if s != "debt" else "debt") for s in srcs]
            row += [e["gdp_history"].get(y) for y in range(2000, ed["data_year"] + 1)]
            w.writerow(row)


def to_cms(ed: dict) -> list[dict]:
    """Rows keyed by Webflow 'Economies' field slugs."""
    out = []
    for e in ed["economies"]:
        out.append({
            "name": e["name"], "slug": e["slug"], "iso3": e["iso3"], "flag": e["flag"], "region": e["region"],
            "income-group": e["income_group"], "currency": e["currency"], "capital": e["capital"],
            "rank": e["rank"], "prior-rank": e["prior_rank"], "rank-change": e["rank_change"],
            "rank-history": json.dumps(e["rank_history"]), "gdp-usd": e["gdp"], "share-of-world-gdp": e["share_world"],
            "gdp-growth": e["growth"], "gdp-per-capita": e["gdp_pc"], "gdp-per-capita-ppp": e["gdp_pc_ppp"],
            "ppp-rank": e["gdp_pc_ppp_rank"], "population": e["population"], "inflation": e["inflation"],
            "unemployment": e["unemployment"], "debt-pct-gdp": e["debt_pct_gdp"],
            "top-sectors": "; ".join(f"{s['sector']} {s['share']}%" for s in e["sectors"]),
            "size-equivalent": (e["size_equivalent"] or {}).get("label"),
            "gdp-history": json.dumps(e["gdp_history"]), "imf-forecast": json.dumps(e["imf_forecast"]),
            "missing-notes": json.dumps(e["missing"]), "source-notes": json.dumps(e["field_sources"]),
            "profile": e["profile"], "data-year": ed["data_year"], "edition": ed["edition"],
            "seo-title": f"{e['name']} Economy {ed['data_year']}: GDP, Rank #{e['rank']} | Colaeb",
            "seo-description": f"{e['name']} ranks #{e['rank']} of {ed['world']['count']} economies by GDP in the "
                               f"World Ranking of Economies {ed['edition']}. See GDP, growth, per-capita income and rank history.",
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--edition", type=int, required=True)
    ap.add_argument("--dry-run", action="store_true", help="write into build/ only")
    ap.add_argument("--spot-check", type=int, default=0)
    ap.add_argument("--seed", type=int)
    ap.add_argument("--from-build", action="store_true", help="re-validate / re-merge profiles from an existing build file")
    args = ap.parse_args()

    cfg = json.loads((ROOT / "pipeline" / "config.json").read_text())
    if cfg["edition_year"] != args.edition:
        raise SystemExit(f"config.json edition_year is {cfg['edition_year']}; update it to {args.edition} first")
    released = json.loads(RELEASED.read_text()) if RELEASED.exists() else []
    if args.edition in released and not args.dry_run:
        raise SystemExit(f"Edition {args.edition} is released and frozen. Past editions are never rebuilt.")

    BUILD.mkdir(exist_ok=True); DATA.mkdir(exist_ok=True)
    draft = BUILD / f"economies-{args.edition}.json"
    if args.from_build:
        ed = json.loads(draft.read_text())
        for x in ed["economies"]:
            f = PROFILES / str(args.edition) / f"{x['slug']}.md"
            x["profile"] = f.read_text().strip() if f.exists() else None
    else:
        ed = build(cfg, args)
        ed["sources"] = SOURCES
    draft.write_text(json.dumps(ed, ensure_ascii=False, separators=(",", ":")))

    report = validate(ed, cfg)
    if args.spot_check:
        report += ["", f"SPOT CHECK ({args.spot_check} random economies)"] + spot_check(ed, args.spot_check, args.seed)
    (BUILD / f"validation-{args.edition}.txt").write_text("\n".join(report) + "\n")
    print("\n".join(report))
    raw = draft.read_bytes()
    print(f"\n{len(ed['economies'])} economies · {len(raw)/1024:.0f} KB raw · {len(gzip.compress(raw))/1024:.0f} KB gzipped")

    (BUILD / f"cms-economies-{args.edition}.json").write_text(json.dumps(to_cms(ed), ensure_ascii=False, indent=1))
    write_csv(ed, BUILD / f"economies-{args.edition}.csv")
    (BUILD / f"sources-{args.edition}.json").write_text(json.dumps(ed.get("sources", []), indent=1))

    if any(x.startswith("ERROR") for x in report):
        raise SystemExit("Validation failed: nothing promoted to data/.")
    if not args.dry_run:
        for name in (f"economies-{args.edition}.json", f"economies-{args.edition}.csv", f"sources-{args.edition}.json"):
            (DATA / name).write_bytes((BUILD / name).read_bytes())
        print(f"Promoted edition {args.edition} to data/. Add {args.edition} to data/released.json on release day.")


if __name__ == "__main__":
    main()
