# Data gaps — 2026 Edition (2025 data)

Generated from `data/economies-2026.json`. 196 economies ranked.

## Universe

**Not ranked: no 2025 GDP in World Bank WDI or IMF WEO (22):** American Samoa, Bermuda, Channel Islands, Cuba, Curacao, Cayman Islands, Eritrea, Faroe Islands, Gibraltar, Greenland, Guam, Isle of Man, St. Martin (French part), Monaco, Northern Mariana Islands, New Caledonia, Korea, Dem. People's Rep., French Polynesia, Syrian Arab Republic, Turks and Caicos Islands, British Virgin Islands, Virgin Islands (U.S.).

**2025 GDP filled from IMF WEO (10):**

- Aruba: GDP 2025 not in WDI, filled from IMF WEO
- Afghanistan: GDP 2025 not in WDI, filled from IMF WEO
- United Arab Emirates: GDP 2025 not in WDI, filled from IMF WEO
- Bahamas, The: GDP 2025 not in WDI, filled from IMF WEO
- Lebanon: GDP 2025 not in WDI, filled from IMF WEO
- Liechtenstein: GDP 2025 not in WDI, filled from IMF WEO
- San Marino: GDP 2025 not in WDI, filled from IMF WEO
- South Sudan: GDP 2025 not in WDI, filled from IMF WEO
- Yemen, Rep.: GDP 2025 not in WDI, filled from IMF WEO
- Taiwan: not in WDI, added from IMF WEO

## Missing fields (shown as “—” with the reason on the site)

**Unemployment (15):** Lebanon, West Bank and Gaza, Kosovo, South Sudan, Antigua and Barbuda, Sint Maarten, Grenada, St. Kitts and Nevis, Dominica, Micronesia, Kiribati, Palau, Marshall Islands, Nauru, Tuvalu.

**Sector shares (5):** Taiwan, Venezuela, Lebanon, Somalia, Nauru.
  - Venezuela: WDI reports 0.0% for every sector (2011), a placeholder rather than a measurement; withheld.
  - Lebanon: WDI sector shares for 2024 sum to only 39.3% of GDP; withheld pending source revision.

**Government debt (% of GDP) (4):** Venezuela, Somalia, Yemen, Sint Maarten.

**Inflation (1):** Sint Maarten.

**No IMF forecast to 2030 (8):** Pakistan, Venezuela, Bolivia, Senegal, Lebanon, Afghanistan, West Bank and Gaza, Sint Maarten.

## Stale figures

**Sector shares older than 2024 (10):** South Sudan (2015), Tuvalu (2015), Yemen (2018), United States (2021), Sint Maarten (2021), Canada (2022), New Zealand (2023), Liechtenstein (2023), Aruba (2023), San Marino (2023).

**Sector shares summing above 100% (10), published as reported** (value added at basic prices over GDP at market prices): Iraq 101.1%, Qatar 104.3%, Kuwait 114.2%, Oman 102.7%, Libya 101.6%, Brunei 101.4%, Togo 103.0%, Timor-Leste 103.6%, Kiribati 105.3%, Marshall Islands 101.5%.

## Size equivalents

- BEA no longer serves metro GDP through its API. Metro GDP is rebuilt from BEA county GDP (latest year 2024, one year behind the data year) across the OMB July 2023 metropolitan delineation; county sums match all 51 state totals.
- Puerto Rico's municipios are not in BEA's county table, so Puerto Rico metros are not available as comparisons.
- Economies smaller than the smallest U.S. metro read “Smaller than any U.S. metro area”: Timor-Leste, Sint Maarten, Comoros, Solomon Islands, Grenada, Vanuatu, Samoa, St. Vincent and the Grenadines, St. Kitts and Nevis, São Tomé and Príncipe, Dominica, Tonga, Micronesia, Kiribati, Palau, Marshall Islands, Nauru, Tuvalu.

## Other notes

- Sum of all ranked economies is 0.23% below the World Bank world aggregate (within the 1% tolerance).
- Capitals: Kyiv set by override (World Bank metadata spells it otherwise); none shown for Hong Kong SAR and Macao SAR.
- Malta appears in the World Bank's “Middle East, North Africa, Afghanistan & Pakistan” region, following World Bank classification.
