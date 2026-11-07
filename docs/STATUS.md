# Build status: 2026 Edition (inaugural)

## Approved by Manny (Nov 6, 2026)
- Object list (pages, collections, wer- classes, embeds, page-level code, assets): approved as proposed. The rules are in the brief: additive only, drafts only, never publish, no links from existing pages.
- Sectors: use WDI agriculture / industry / services, with manufacturing shown as a subset of industry.
- Webflow plan: confirmed CMS tier or higher.
- Code hosting: this repo, served through jsDelivr with one tag per edition (`v2026.0`).

## Webflow (read-only findings)
- Site ID: `628bae24e4615c00673d2d8d` (Colaeb). The Home page ID, used for style and variable queries, is `6ad3d738e47154900023fc53`.
- Only one existing collection (FAQs). The slugs `world-economies`, `world-economies-report` and `economies` are free, and no `wer-` classes exist yet.
- Brand values: orange `#F37A23` (variable "Pimary-color"), ink `#101828`, body slate `#465A69`, gray `#EAECF0`. Site fonts are Source Sans 3, Montserrat and Open Sans. The serif and mono fonts are loaded in the new pages' own code only.
- Capital CTA target: `/capital`.

## Done
- [x] Pipeline, config, validator and spot-check (`pipeline/build_edition.py`). Tested end to end against mocked API responses.
- [x] README and annual runbook (`docs/RUNBOOK.md`)
- [x] Vendored `world-atlas` TopoJSON (110m and 50m) and `mledoze/countries` reference data

- [x] 2026 dry run (Nov 6): 196 economies, 0 errors, 10/10 spot-checks match source. Sum of economies is 0.23% below the WB world aggregate.
  - Fixed: IMF firewall 403s a bare User-Agent, so the UA now carries a contact URL. BEA values are now scaled by each row's UNIT_MULT.
  - BEA no longer serves metro (MSA) GDP through the API. Metros are rebuilt from BEA county GDP (2024) over the OMB 2023 delineation: 387 metros, county sums match all 51 state totals.
  - IMF-filled GDP: ABW, AFG, ARE, BHS, LBN, LIE, SMR, SSD, YEM, plus TWN added. 22 economies excluded for no 2025 GDP (incl. CUB, PRK, SYR, ERI, MCO, BMU, CYM).

- [x] 196 profiles (`profiles/2026/`), all pass `check_profiles.py`
- [x] Key Findings, Climbers & Fallers (`findings/2026/findings.json`)
- [x] Front-end (`web/wer.js`, `web/wer.css`), previews in `web/dev/`
- [x] Webflow drafts created; see `docs/HANDOFF-2026.md` for every object and ID
- [x] CSV, press kit, YourInfoDaily draft, OG image (`release/2026/`), data gaps (`docs/DATA-GAPS-2026.md`)

- [x] **Released Nov 6, 2026** (site publish 2026-11-07 06:32 UTC): /world-economies, 196 economy pages, /world-economies-report/2026. Template SEO bindings and share image set.

## Next
Optional: tag `v2026.0` on the release commit. Link the report from the nav/home. See also "To finish before release" in `docs/HANDOFF-2026.md`. Deferred to v1.1: Rank Race, quiz, radar chart, PNG export, PDF, per-finding share images.
