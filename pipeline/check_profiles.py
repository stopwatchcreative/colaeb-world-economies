#!/usr/bin/env python3
"""
Check profiles against their fact sheets.

    python pipeline/check_profiles.py --edition 2026 [slug ...]

For each profiles/<edition>/<slug>.md: word count 120-180, and every number in the text
(digits, decimals, percentages, multiples, ordinals, years) must appear in
build/facts-<edition>/<slug>.txt. Exits 1 on any failure.
"""
from __future__ import annotations

import argparse, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NUM = re.compile(r"\d[\d,]*(?:\.\d+)?")


def tokens(text: str) -> set[str]:
    return {t.replace(",", "") for t in NUM.findall(text)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--edition", type=int, required=True)
    ap.add_argument("slugs", nargs="*")
    a = ap.parse_args()
    pdir, fdir = ROOT / "profiles" / str(a.edition), ROOT / "build" / f"facts-{a.edition}"
    slugs = a.slugs or sorted(p.stem for p in pdir.glob("*.md"))
    bad = 0
    for s in slugs:
        p, f = pdir / f"{s}.md", fdir / f"{s}.txt"
        if not p.exists():
            print(f"MISSING  {s}"); bad += 1; continue
        text = p.read_text()
        allowed = tokens(f.read_text()) | {str(a.edition)}
        w = len(text.split())
        extra = sorted(tokens(text) - allowed)
        probs = []
        if not 120 <= w <= 180:
            probs.append(f"{w} words")
        if extra:
            probs.append("numbers not in fact sheet: " + ", ".join(extra))
        if probs:
            bad += 1
            print(f"FAIL     {s}: " + "; ".join(probs))
    print(f"{len(slugs) - bad}/{len(slugs)} profiles pass")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
