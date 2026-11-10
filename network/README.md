# The Colaeb Network: Webflow setup

**Status:** live at colaeb.com/network (Beta) since Nov 9, 2026. The Network collection, the /network page and the Network Template are built in Webflow as described below. To add a business: add a Network item, turn on *Permission on file*, publish.

Page: **colaeb.com/network**. Profiles: **colaeb.com/network/<slug>**.
The globe and directory are drawn by `cn.js` from a hidden CMS list on the page. To add a business, add a CMS item and publish. No code changes are needed.

---

## 1. CMS collection: "Network"

Collection name **Network**, slug **network**, so the template pages land at `/network/<slug>`.

| Field | Type | Required | Notes |
|---|---|---|---|
| Name | Plain text | Yes | Built-in |
| Slug | Slug | Yes | Built-in. Used for share links: `/network?member=<slug>` |
| Type | Option: Client, Partner, Affiliate, Investor | Yes | Drives the filter chips |
| Industry | Plain text | Yes | Keep labels consistent (see list below). Drives the industry dropdown |
| City | Plain text | Yes | e.g. "Columbus, Ohio" or "London" |
| Country | Plain text | Yes | Full name: "United States", "United Kingdom" |
| Latitude | Plain text | Yes | Decimal degrees, e.g. 39.9612 (plain text avoids Webflow number formatting) |
| Longitude | Plain text | Yes | West of Greenwich is negative |
| Second city | Plain text | No | For businesses with two offices |
| Second latitude | Plain text | No | |
| Second longitude | Plain text | No | |
| Summary | Plain text, 280 char max | Yes | One or two sentences on what they do and who they serve |
| Website | Link | Yes | |
| Logo | Image | No | Square or wide PNG/SVG on a transparent or white background. Without one, a colored monogram shows |
| Quote | Plain text | No | Short testimonial, used only with written approval |
| Quote attribution | Plain text | No | "Name, Title" |
| Featured | Switch | No | Featured items sort first and get an orange top edge |
| Permission on file | Switch | Yes | Internal only. Publish an item only when this is on |

**Industry labels in use:** Software & IT · Sales & Marketing · Healthcare · Media. Add new ones as needed, but reuse an existing label when it fits, or the dropdown splinters.

**Finding coordinates:** search the city in Google Maps, right-click the pin, and click the numbers at the top of the menu to copy "lat, lng".

### Starter entries

| Name | Type | Industry | City | Country | Lat | Lng | Website |
|---|---|---|---|---|---|---|---|
| HireDeveloper | Client | Software & IT | London | United Kingdom | 51.5074 | -0.1278 | https://hiredeveloper.dev |
| nuGrowth | Client | Sales & Marketing | Columbus, Ohio | United States | 39.9612 | -82.9988 | https://nugrowth.com/ |
| Think Healthy Doctor | Client | Healthcare | Ann Arbor, Michigan | United States | 42.2808 | -83.7430 | https://thinkhealthy.doctor/ |
| YourInfoDaily | Partner | Media | New York (2nd: Los Angeles, 34.0522, -118.2437) | United States | 40.7128 | -74.0060 | https://www.yourinfodaily.com |
| Comfort Keepers of Richmond | Client | Healthcare | Richmond, Virginia | United States | 37.5407 | -77.4360 | https://www.comfortkeepers.com/offices/virginia/richmond/ |
| Contact Honey | Client | Software & IT | Erie, Colorado | United States | 40.0503 | -105.0500 | https://contacthoney.com/ |

The summaries are in `dev/items.json`, ready to paste.

---

## 2. The /network page

Build it in this order. The masthead and the join section use ordinary Webflow elements, so the copy can be edited in the Designer.

1. **Page settings → Custom code → Inside `<head>`:**
   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,600&family=JetBrains+Mono:wght@400;600&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">
   <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/stopwatchcreative/colaeb-world-economies@<COMMIT>/network/cn.min.css">
   ```
   **Before `</body>`:**
   ```html
   <script src="https://cdn.jsdelivr.net/gh/stopwatchcreative/colaeb-world-economies@<COMMIT>/network/cn.min.js" defer></script>
   ```
   Replace `<COMMIT>` with the full commit hash after `cn.js` and `cn.css` are pushed. Pin the hash, as the economies report does.

2. **Wrapper:** a Div Block with class `cn-page` around everything between the nav and the footer.

3. **Masthead:** copy the structure from `dev/template.html`: `cn-masthead` › `cn-wrap` › kicker, H1 `cn-title` (with a Text Span `cn-beta` reading "Beta" after the title; delete it when the page leaves beta), paragraph `cn-dek`, and the four-stat strip `cn-stats`. The first three stat values need a custom attribute so the script fills them automatically:
   - `data-cn-stat` = `businesses`
   - `data-cn-stat` = `cities`
   - `data-cn-stat` = `countries`
   The fourth stat ("20,000+ professionals") is plain text.

4. **Globe:** a Div Block (section) with custom attribute `data-cn` = `globe`. Leave it empty.

5. **Directory heading:** `cn-wrap` › `cn-section-head` › H2 `cn-section-title`, "Directory".

6. **Directory:** a Div Block with custom attribute `data-cn` = `directory`. Leave it empty.

7. **Join section:** `cn-wrap` › `cn-join`, with two buttons (`cn-btn cn-btn-accent` and `cn-btn`). Point them wherever new members and partners should go: pricing, an intake form, or a Colaeb contact page.

8. **Hidden data list** (the source for the globe and directory):
   - Add a **Collection List** bound to **Network**. Filter: *Permission on file is On*. Sort: *Featured* first, then *Name*.
   - On the Collection List Wrapper: custom attribute `data-cn-source` (no value needed) and **display: none**.
   - Inside each Collection Item, add one element per field, bind it to that field, and give it a custom attribute `data-cn-field`:

   | Element | Bound to | `data-cn-field` |
   |---|---|---|
   | Text Block | Name | `name` |
   | Text Block | Slug | `slug` |
   | Text Block | Type | `type` |
   | Text Block | Industry | `industry` |
   | Text Block | City | `city` |
   | Text Block | Country | `country` |
   | Text Block | Latitude | `lat` |
   | Text Block | Longitude | `lng` |
   | Text Block | Second city | `city2` |
   | Text Block | Second latitude | `lat2` |
   | Text Block | Second longitude | `lng2` |
   | Text Block | Summary | `summary` |
   | Link Block | Website | `website` |
   | Image | Logo | `logo` |
   | Text Block | Quote | `quote` |
   | Text Block | Quote attribution | `quoteBy` |
   | Link Block | Current Network page | `url` (turns on the "View profile" button) |

   Number fields must display without thousands separators or rounding. Empty bindings are skipped automatically.

   A Collection List shows 100 items at most. Past 100, add a second identical list with *Skip 100*. The script reads every `data-cn-source` on the page.

9. **SEO:** Title "The Colaeb Network: Our Clients and Partners Around the World | Colaeb". Description "Meet the businesses that grow with Colaeb: clients and partners across industries and cities, mapped on an interactive globe." The hidden list keeps every name and summary in the page HTML, so search engines can read them.

---

## 3. Profile pages: Network Template

No custom code. Build with native elements bound to the collection:

- Kicker (Type · Industry), H1 Name, City + Country, Logo
- Summary, plus Quote and attribution (conditional visibility: Quote is set)
- "Visit website" button → Website
- "See them on the globe" button → `/network?member=` + Slug. Use a custom link with the Slug field inserted. This opens the globe with their card already showing.
- Join CTA (reuse the `cn-join` section as a Symbol)
- SEO title: "{Name} | The Colaeb Network". Description: Summary.

---

## 4. Share links

`colaeb.com/network?member=<slug>` opens the page with that business's card showing. Use these links when announcing new members on LinkedIn, X and Threads, and send each client theirs so they can share it.

## 5. Behavior notes

- Desktop gets the 3D globe. Phones, older machines and browsers without WebGL get a flat map with the same pins.
- Arcs connect every location to Colaeb HQ in Columbus. To change HQ, add before the script: `<script>window.CN_CONFIG={hq:{name:"Colaeb HQ",city:"Columbus, Ohio",lat:39.9612,lng:-82.9988}}</script>`
- Countries with at least one business are shaded orange.
- Map files (globe library, country shapes) load from the world-economies repo, so both pages share one cached copy.
