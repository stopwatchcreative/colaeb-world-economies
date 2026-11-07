# Annual Update Runbook — World Ranking of Economies

One edition a year, released November–December. Each edition is named for its release year and covers the previous calendar year. Example: the 2027 Edition uses 2026 data.

**Total: about 4–5 working days**, most of it writing and review.

| # | Step | Owner | Est. time |
|---|------|-------|-----------|
| 1 | Confirm the sources are out | Data | 15 min |
| 2 | Run and validate the pipeline | Data | 1–2 hrs |
| 3 | Upload the new versioned data file | Web | 20 min |
| 4 | Create the new Report Editions item, then archive the prior one | Web | 30 min |
| 5 | Update the Economies items | Web + Editorial | 1.5–2 days |
| 6 | Write Key Findings and Climbers & Fallers | Editorial | 4–6 hrs |
| 7 | Produce the release assets | Design + Editorial | 1 day |
| 8 | Point the flagship to the new edition | Web | 10 min |
| 9 | Spot-check, stage, publish | All | 2–3 hrs |

---

### 1. Confirm the sources are out (15 min)
- Allowed network: api.worldbank.org, www.imf.org, apps.bea.gov, www2.census.gov (+ population.un.org).
- World Bank WDI: check that `https://api.worldbank.org/v2/country/WLD/indicator/NY.GDP.MKTP.CD?date=<data year>&format=json` returns a value. The annual GDP update usually lands in early July.
- IMF WEO: check that the October WEO is live (imf.org/en/Publications/WEO) and that the DataMapper `NGDPD` series runs to data year + 5.
- Write the WEO label (for example "IMF World Economic Outlook, October 2027") into `pipeline/config.json`.

### 2. Run and validate the pipeline (1–2 hrs)
1. In `pipeline/config.json`, set `edition_year`, `data_year`, `release_date`, `next_edition_expected` and `prior_edition_file` (for example `data/economies-2026.json`).
2. Run `python pipeline/build_edition.py --edition <year> --dry-run --spot-check 10`.
3. Fix every `ERROR`. Read every `WARN` and note anything a reader would notice, such as a new economy, a dropped economy or a large revision.
4. Note any methodology changes since the last edition (a new source, a changed universe, revised definitions). These go in the Report Editions item.

### 3. Upload the new versioned data file (20 min)
1. Run `python pipeline/build_edition.py --edition <year> --from-build` to promote the files to `data/`.
2. Commit, then tag `v<year>.0` (for example `v2027.0`). jsDelivr serves a tag or a full commit hash immutably, e.g. `https://cdn.jsdelivr.net/gh/stopwatchcreative/colaeb-world-economies@v2027.0/data/economies-2027.json`. The 2026 drafts pin the commit hash.
3. Never edit or retag a past edition's tag or file. A correction goes out as `v<year>.1`, with a note in the edition's methodology field.

### 4. Create the new Report Editions item, then archive the prior one (30 min)
- In Webflow CMS → Report Editions, create item `<year>`: set the edition year, data year, release date, status = current, the data file link (the jsDelivr URL from step 3), the PDF, CSV, OG image, methodology changes and suggested citation.
- Set the prior edition's status to **archived**. This switches on its "You're viewing the [Year] Edition" banner. Change nothing else on the prior item.

### 5. Update the Economies items (1.5–2 days)
- Import `build/cms-economies-<year>.json`. Each item is matched by slug, and current figures are overwritten.
- `rank-history` is already appended by the pipeline (the prior editions plus the new one). Check a few items.
- Profiles: run `python pipeline/profile_facts.py --edition <year>` to write one fact sheet per economy to `build/facts-<year>/`, write `profiles/<year>/<slug>.md` from those sheets only (120–180 words), then run `python pipeline/check_profiles.py --edition <year>`: it fails any profile containing a number not in its sheet. Re-run the pipeline with `--from-build` so they merge in, then re-import `build/cms-economies-<year>.json`. The archived edition keeps its own profile folder in the repo.
- New economies get new items. Economies that drop out stay in the CMS with a note. Don't delete them, because past editions still link to them.

### 6. Write Key Findings and Climbers & Fallers (4–6 hrs)
- Ten findings, each with one supporting number taken from the edition file and a deep link into the page (`?metric=`, `#rank-…`, or `?compare=`).
- Climbers & Fallers: the top 5 each way by rank change. Give the reason using the data, splitting real growth from currency moves (compare the US$ GDP change with real growth) and from revisions.
- Copy `pipeline/findings_2026.py` to `findings_<year>.py`, rewrite the copy, and run it: every number is formatted from the edition file, never typed. It writes `findings/<year>/findings.json`; paste the findings into the Report Editions item.

### 7. Produce the release assets (1 day)
- PDF executive summary (8–12 pp): cover, Key Findings, top 50 table, regional snapshots, methodology, sources.
- CSV: `data/economies-<year>.csv`, uploaded to Webflow assets as `wer-<year>-data.csv`.
- OG images: one for the edition and one per Key Finding.
- Press kit: one-paragraph summary, the 10 findings as quotable lines, suggested citation, media contact.
- YourInfoDaily article draft, for review before posting.
- Refresh the masthead edition mark ("2027") and, optionally, the edition accent tone.

### 8. Point the flagship to the new edition (10 min)
- In the custom code of `/world-economies` and both template pages, change `WER_EDITION` and the version (tag or commit hash) in the two CDN URLs. That's the only change. Keep the archived edition's data file reachable: the edition template loads `data/economies-<year>.json` for whichever year is in its URL.
- Update the page SEO title year: "World Ranking of Economies <year>: All Countries by GDP | Colaeb Annual Report".

### 9. Spot-check, stage, publish (2–3 hrs)
- Compare 10 random countries with the World Bank and IMF source values (`--spot-check 10`) and record any mismatches.
- Check both templates: the archived edition shows its banner and its own data file, and the new edition has no banner.
- Test on mobile (the 2D map fallback, swipeable cards, stacked Compare), test keyboard navigation, and run Lighthouse (target 85+ on desktop).
- Publish on release day, then add `<year>` to `data/released.json` and commit.
