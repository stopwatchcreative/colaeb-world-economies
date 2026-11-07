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

## Next
1. Run `python pipeline/build_edition.py --edition 2026 --dry-run --spot-check 10 --seed 2026`. This needs network access to api.worldbank.org, www.imf.org and apps.bea.gov, and a `BEA_API_KEY`.
2. Report the data-gap list and the spot-check results to Manny.
3. Write the profiles (`profiles/2026/*.md`), the Key Findings and the Climbers & Fallers from the real data.
4. Build the front-end in `web/`: globe, table, compare, race, neighbors, quiz, archive, country page, edition page.
5. Create the Webflow objects as drafts, then the release assets, then the handoff.
