# Handoff — World Ranking of Economies, 2026 Edition

Status: **built as drafts on colaeb.com. Nothing is published, and no existing page, collection, component, class, variable, font, interaction or site-wide setting was changed.** The report is not linked from any existing page.

Code version loaded by the drafts: commit `8e66c1f2cf2802039679970d064b8df599d7e899` via jsDelivr
(`https://cdn.jsdelivr.net/gh/stopwatchcreative/colaeb-world-economies@8e66c1f…/web/wer.js`).

## 1. Everything created in Webflow (site `628bae24e4615c00673d2d8d`)

### Pages
| Page | ID | Path | State |
|---|---|---|---|
| World Ranking of Economies (static) | `6aeea790921233f570e25e66` | `/world-economies` | Draft |
| Report Editions Template (auto-created with the collection) | `6aeea6debe50d870237bb9a8` | `/world-economies-report/[year]` | Template* |
| Economies Template (auto-created with the collection) | `6aeea6e17c27c9854d1bfc4c` | `/economies/[slug]` | Template* |

\*Webflow does not allow collection template pages to be drafts. Nothing renders through them while every item in both collections is a draft.

### CMS collections
| Collection | ID | Slug | Fields |
|---|---|---|---|
| Report Editions | `6aeea6debe50d870237bb985` | `world-economies-report` | 19 custom: edition-year, data-year, release-date, status (current/archived), headline, executive-summary, key-findings, climbers, fallers, data-file, pdf, csv, og-image, cover-image, methodology-changes, suggested-citation, data-file-version, seo-title, seo-description |
| Economies | `6aeea6df7c27c9854d1bfb53` | `economies` | 30 custom (plan maximum): iso3, flag, region, income-group, currency, capital, rank, prior-rank, rank-change, rank-history, gdp-usd, gdp-formatted, share-of-world-gdp, gdp-growth, gdp-per-capita, gdp-per-capita-ppp, ppp-rank, population, inflation, unemployment, debt-pct-gdp, top-sectors, size-equivalent, gdp-history, imf-forecast, missing-notes, source-notes, profile, seo-title, seo-description |

Notes on the schema: Number fields created through the API are integer-only, so decimal values (share, growth, inflation, unemployment, debt) are stored as display strings such as "+6.0%". History and forecast are compact JSON in US$ billions. The site's charts read the full-precision data file, not these fields.

### CMS items (all drafts)
- Report Editions: `2026` (ID `6aeea788223a7f469d6bca64`), status = current.
- Economies: one item per economy, slug = economy slug. Item IDs are listed in `docs/webflow-items-2026.tsv`.

### Elements added (new pages only)
- Each new page: one existing **Colaeb Nav** instance and one existing **Colaeb Footer** instance, placed unchanged.
- Flagship: `<main class="wer-page">` with 11 mount blocks (`data-wer` = masthead, globe, findings, movers, table, compare, neighbors, regions, archive, methods, footer) and crawlable fallback text (H1 + summary).
- Economies template: mount block with H1 bound to Name, paragraphs bound to GDP Formatted and Size Equivalent, a Rich Text element bound to Profile.
- Report Editions template: mount blocks (masthead, findings, movers, table, methods, footer); H1 bound to Headline, paragraphs bound to Executive Summary and Suggested Citation, a Rich Text element bound to Key Findings.

### Classes (all new, `wer-` prefix, created by the HTML insert with no Webflow styles; all styling comes from `web/wer.css`)
`wer-page`, `wer-mount`, `wer-wrap`, `wer-kicker`, `wer-title`, `wer-dek`, `wer-note`, `wer-profile`, `wer-ssr-gdp`, `wer-ssr-size`, `wer-ssr-findings`.

### Page-level custom code (new pages only)
- Head: Google Fonts (Newsreader, JetBrains Mono), `wer.css`, the config line `window.WER_EDITION="2026"`, and on the flagship a canonical tag.
- Footer: the `wer.js` loader.
- Flagship JSON-LD (page schema): Report + Dataset. Edition and country pages add their own JSON-LD and self-canonical from the loader.

### Not created
- No site-wide code, no new components, no changes to nav/footer, no assets uploaded (see "To finish" below).

## 2. To finish before release (needs you or the Designer)
1. **Template SEO:** in each template's Page Settings, bind SEO Title / Meta Description to the item's `SEO Title` / `SEO Description` fields (the API cannot bind these).
2. **OG image:** upload `release/2026/wer-2026-og.png` to Webflow Assets (this workspace can't reach Webflow's upload storage), then set it as the flagship's Open Graph image and the 2026 item's OG Image.
3. **Tag the release:** push tag `v2026.0` on the release commit (pushing tags is blocked from this session). Optional: swap the commit hash in the three pages' code for `@v2026.0`; the commit hash is already immutable.
4. **Release date:** set `release_date` in `pipeline/config.json` and the 2026 item's Release Date, then add `2026` to `data/released.json`.
5. **Publish** the new page and the CMS items on release day, then link the report from the nav/home yourself.

## 3. Deferred to v1.1 (agreed scope cut)
Rank Race animation, Guess the Rank quiz, Compare radar chart and "Download PNG", the 8–12 page PDF, and per-finding share images.

## 4. Other deliverables
- Data gaps: `docs/DATA-GAPS-2026.md`
- Spot-check (10 random economies, all match source): `build/validation-2026.txt` (also in the handoff message)
- Screenshots: `docs/screenshots/`
- CSV: `data/economies-2026.csv`
- Press kit and YourInfoDaily draft: `release/2026/`
- Pipeline, README, runbook: `pipeline/`, `README.md`, `docs/RUNBOOK.md`

## 5. Changes to existing site objects (requested after release, Nov 6, 2026)
- **Home page:** a call-to-action strip under the nav (`wer-home-cta`, element `f3f7a0c5-08fc-7090-e38e-3367059a0ce4`), linking to `/world-economies`. New classes: `wer-home-cta`, `wer-home-cta-inner`, `wer-home-cta-text`, `wer-home-cta-tag`, `wer-home-cta-btn`.
- **Colaeb Footer component:** "World Ranking of Economies" link added to the Company column after "About Colaeb" (element `99da12d8-bcbe-e32e-fbcb-2ac0380ed3fe`, existing `hp-footer-link` class). Shows on every page using the footer.
- **Data download forms:** native Webflow form "WER Data Download" on `/world-economies` and the Report Editions template.
