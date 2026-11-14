"""Build investors/grants/grants.json from a GCG grants workbook (Master tab).
Usage: python3 -I build_grants.py path/to/GCG_Grants.xlsx [YYYY-MM]
"""
import sys, json, re, datetime, openpyxl, os

TYPES = {
    "Federal Grants": "Federal",
    "AI and Technology Funding Opportunities": "AI & tech",
    "Workforce Development Funding": "Workforce",
    "Small Business Opportunities": "Small business",
    "Nonprofit Funding Opportunities": "Nonprofit",
    "State Grants": "State",
    "Other Business Opportunities": "Other",
}

def region(cont):
    c = (cont or "").split("/")[0].strip()
    return {"North America": "North America", "Europe": "Europe", "Africa": "Africa"}.get(c, "Global")

def amount(v, cont):
    if isinstance(v, (int, float)):
        cur = "EUR" if (cont or "").startswith("Europe") else ("USD" if (cont or "").startswith("North America") else "")
        return float(v), cur
    s = str(v or "").strip()
    cur = "GBP" if s.startswith("£") else ("EUR" if s.startswith("€") else ("USD" if s.startswith("$") else ""))
    n = re.sub(r"[^\d.]", "", s)
    return (float(n) if n else None), cur

def clean(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()

def main(path, edition):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb["Master"]
    hdr = [clean(c.value).upper() for c in ws[1]]
    ix = {h: i for i, h in enumerate(hdr) if h}
    out, seen = [], set()
    for r in ws.iter_rows(min_row=2, values_only=True):
        name = clean(r[ix["GRANT NAME"]])
        if not name: continue
        link = clean(r[ix["LINK"]])
        key = (name.lower(), link)
        if key in seen: continue
        seen.add(key)
        cont = clean(r[ix["CONTINENT"]])
        amt, cur = amount(r[ix["AMOUNT"]], cont)
        dl = r[ix["DEADLINE"]]
        posted = r[ix["POSTED DATE"]]
        out.append({
            "n": name,
            "a": clean(r[ix["FUNDING AGENCY"]]),
            "r": clean(r[ix["REGION"]]),
            "g": region(cont),
            "f": clean(r[ix["FOCUS AREA"]]),
            "t": TYPES.get(clean(r[ix["TYPE"]]), "Other"),
            "amt": amt, "cur": cur,
            "p": posted.strftime("%Y-%m-%d") if isinstance(posted, datetime.datetime) else None,
            "d": dl.strftime("%Y-%m-%d") if isinstance(dl, datetime.datetime) else None,
            "e": clean(r[ix["ELIGIBILITY"]]),
            "u": link,
        })
    out.sort(key=lambda x: (x["d"] or "9999"))
    doc = {"edition": edition, "source": "GCG Grants", "updated": datetime.date.today().isoformat(), "grants": out}
    dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "grants.json")
    with open(dst, "w") as f: json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    print(len(out), "grants ->", dst)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else datetime.date.today().strftime("%Y-%m"))
