# World Ranking of Economies — Colaeb Annual Report

The pipeline, data files and front-end code behind colaeb.com/world-economies.

- `pipeline/build_edition.py` fetches, validates and writes one edition.
- `data/` holds immutable edition files: `economies-2026.json`, `economies-2027.json` and so on. Past files are never edited.
- `profiles/<edition>/<slug>.md` holds one 120–180-word profile per economy. Each edition keeps its own folder.
- `findings/<edition>/` holds the Key Findings and the Climbers & Fallers copy for that edition.
- `web/` is the front-end bundle loaded by the Webflow pages through jsDelivr.

## Requirements

- Python 3.11 or later, plus `pip install requests`
- Network access to `api.worldbank.org`, `www.imf.org`, `apps.bea.gov` and (optionally) `population.un.org`
- `BEA_API_KEY` (free: https://apps.bea.gov/API/signup) for U.S. state and metro size equivalents
- `UN_WPP_TOKEN` (optional) for UN population fill. Without it, IMF population is used.

## Produce an edition

```bash
# 1. set edition_year, data_year, imf_weo_label, prior_edition_file in pipeline/config.json
# 2. dry run: writes build/ only
python pipeline/build_edition.py --edition 2027 --dry-run --spot-check 10 --seed 2027
# 3. write profiles/2027/*.md and findings/2027/*, then re-merge without refetching
python pipeline/build_edition.py --edition 2027 --dry-run --from-build
# 4. promote to data/ (fails if validation has any ERROR)
python pipeline/build_edition.py --edition 2027 --from-build
# 5. on release day, add 2027 to data/released.json. The edition is now frozen.
```

## What the validator checks

- Ranks run 1..N with no duplicates, and ISO3 codes and slugs are unique.
- Every record has the required fields with the right types.
- The sum of all economies is within 1% of the World Bank's world GDP aggregate. A larger gap is an error.
- Outliers (growth or inflation beyond ±400%), missing profiles and profile word counts are reported as warnings.
- `--spot-check N` re-fetches N random economies from the source API and compares them with the file. The IMF figure is shown alongside for context.

## Data rules

- **Universe:** every World Bank economy with a GDP value for the data year. Gaps are filled from IMF WEO and labeled. Taiwan is added from IMF WEO. The count comes from the data, not a constant.
- **Field priority:** World Bank WDI first, then IMF WEO. Debt and forecasts come from IMF WEO only. Each value's source is stored in `field_sources`.
- **Sectors:** WDI value added as % of GDP for agriculture, industry and services. This uses the latest year at or before the data year, and that year is recorded. Manufacturing is a subset of industry. The shares don't sum to 100 because net taxes on products are excluded.
- **Movement:** the first edition compares data-year GDP ranks with the prior year's. Later editions compare against `prior_edition_file`.
- **Missing values:** stored as `null`, with a plain-English reason in `missing`. The site shows "—" with that reason as a tooltip.
- **Never overwrite:** a released edition (listed in `data/released.json`) can't be rebuilt.

## Sources

World Bank World Development Indicators · IMF World Economic Outlook (DataMapper API) · U.S. Bureau of Economic Analysis Regional Accounts · UN World Population Prospects · Natural Earth via `world-atlas` (TopoJSON) · `mledoze/countries` (flags, currencies, common names; ODbL). Retrieval timestamps are written to `data/sources-<edition>.json`.

The annual release steps live in `docs/RUNBOOK.md`.
