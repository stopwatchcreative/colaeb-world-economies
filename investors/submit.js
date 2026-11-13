/* Colaeb /investors: "Add your firm to the map" form.
   Before Webflow sends the form, this script:
   - requires a website or LinkedIn (the page's contact rule),
   - looks up the city on Open-Meteo's free geocoder to get latitude/longitude,
   - fills hidden fields (latitude, longitude, slug, listing_url, geo_place) that Zapier maps
     straight into a live item in the Investors CMS collection, so the pin shows up on the globe. */
(function () {
  "use strict";
  var GEO = "https://geocoding-api.open-meteo.com/v1/search";
  var ALIAS = {
    "us": "united states", "usa": "united states", "u.s.": "united states", "u.s.a.": "united states",
    "united states of america": "united states", "america": "united states",
    "uk": "united kingdom", "u.k.": "united kingdom", "england": "united kingdom", "scotland": "united kingdom",
    "wales": "united kingdom", "great britain": "united kingdom", "uae": "united arab emirates",
    "korea": "south korea", "republic of korea": "south korea", "holland": "netherlands", "the netherlands": "netherlands"
  };

  function norm(s) { s = String(s || "").trim().toLowerCase().replace(/\s+/g, " "); return ALIAS[s] || s; }
  function slugify(s) {
    return String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "investor";
  }
  function url(s) {
    s = String(s || "").trim();
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
    try { var u = new URL(s); return /\.[a-z]{2,}$/i.test(u.hostname) ? u.href.replace(/\/$/, "") : ""; } catch (e) { return ""; }
  }
  function hidden(form, name) {
    var el = form.querySelector('input[type="hidden"][name="' + name + '"]');
    if (!el) { el = document.createElement("input"); el.type = "hidden"; el.name = name; el.setAttribute("data-name", name); form.appendChild(el); }
    return el;
  }
  function val(form, name) { var el = form.querySelector('[name="' + name + '"]'); return el ? el.value.trim() : ""; }

  function css() {
    if (document.getElementById("cnl-css")) return;
    var s = document.createElement("style"); s.id = "cnl-css";
    s.textContent = ".cnl-wide{grid-column:1/-1}.cnl-textarea{min-height:96px;resize:vertical;font:inherit}" +
      ".cnl-msg{margin:10px 0 0;font-size:14px;color:#b42318}";
    document.head.appendChild(s);
  }
  function say(form, text) {
    var p = form.querySelector(".cnl-msg");
    if (!p) { p = document.createElement("p"); p.className = "cnl-msg"; p.setAttribute("role", "alert"); var b = form.querySelector('[type="submit"]'); b.parentNode.insertBefore(p, b.nextSibling); }
    p.textContent = text || ""; p.style.display = text ? "" : "none";
  }

  function host(u) { try { return new URL(url(u)).hostname.replace(/^www\./, "").toLowerCase(); } catch (e) { return ""; } }
  function liKey(u) { return String(u || "").toLowerCase().replace(/^https?:\/\/(www\.|[a-z]{2}\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, ""); }
  // Find this firm among everything on the page: the CMS list plus the bulk feed (window.CN).
  function findExisting(firm, website, linkedin) {
    var s = slugify(firm), h = website ? host(website) : "", li = linkedin ? liKey(linkedin) : "";
    var items = (window.CN && window.CN.items && window.CN.items()) || [];
    for (var i = 0; i < items.length; i++) {
      var r = items[i], w = r.website || "";
      if (slugify(r.name) === s) return r;
      if (h && /linkedin\.com$/.test(h) === false && host(w) === h) return r;
      if (li && liKey(w) === li) return r;
    }
    var hit = null;
    document.querySelectorAll('[data-cn-source] [data-cn-field="name"]').forEach(function (n) { if (!hit && slugify(n.textContent) === s) hit = { name: n.textContent.trim(), website: "" }; });
    return hit;
  }

  var cache = {};
  function geocode(cityRaw, countryRaw) {
    var parts = String(cityRaw || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
    var city = parts[0] || "", region = norm(parts[1] || ""), country = norm(countryRaw);
    var key = city.toLowerCase() + "|" + region + "|" + country;
    if (cache[key]) return cache[key];
    var p = fetch(GEO + "?count=20&language=en&format=json&name=" + encodeURIComponent(city))
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (d) {
        var list = (d && d.results) || [];
        var inCountry = list.filter(function (r) {
          return !country || norm(r.country) === country || String(r.country_code || "").toLowerCase() === country;
        });
        if (region) {
          var inRegion = inCountry.filter(function (r) {
            var a = String(r.admin1 || "").toLowerCase();
            return a === region || a.indexOf(region) === 0 || (US[region] && a === US[region]);
          });
          if (inRegion.length) inCountry = inRegion;
        }
        var hit = inCountry[0];
        if (!hit) return null;
        return { lat: hit.latitude.toFixed(4), lng: hit.longitude.toFixed(4), place: [hit.name, hit.admin1, hit.country].filter(Boolean).join(", "), country: hit.country };
      })
      .catch(function () { return null; });
    cache[key] = p;
    return p;
  }
  var US = { al: "alabama", ak: "alaska", az: "arizona", ar: "arkansas", ca: "california", co: "colorado", ct: "connecticut", de: "delaware", dc: "district of columbia", fl: "florida", ga: "georgia", hi: "hawaii", id: "idaho", il: "illinois", "in": "indiana", ia: "iowa", ks: "kansas", ky: "kentucky", la: "louisiana", me: "maine", md: "maryland", ma: "massachusetts", mi: "michigan", mn: "minnesota", ms: "mississippi", mo: "missouri", mt: "montana", ne: "nebraska", nv: "nevada", nh: "new hampshire", nj: "new jersey", nm: "new mexico", ny: "new york", nc: "north carolina", nd: "north dakota", oh: "ohio", ok: "oklahoma", or: "oregon", pa: "pennsylvania", ri: "rhode island", sc: "south carolina", sd: "south dakota", tn: "tennessee", tx: "texas", ut: "utah", vt: "vermont", va: "virginia", wa: "washington", wv: "west virginia", wi: "wisconsin", wy: "wyoming" };

  function mode(form) { return /update/i.test(val(form, "listing_status")) ? "update" : "add"; }

  function prepare(form) {
    var m = mode(form);
    var website = url(val(form, "website")), linkedin = url(val(form, "linkedin"));
    if (linkedin && !/linkedin\.com$/i.test(new URL(linkedin).hostname.replace(/^www\./, ""))) linkedin = "";
    if (!website && !linkedin) return Promise.resolve("Please add your website or LinkedIn page so founders can reach you.");
    var firm = val(form, "firm");
    var match = findExisting(firm, website, linkedin);
    if (m === "add" && match) return Promise.resolve((match.name || firm) + " is already on the list. Choose \u201cYes, update my listing\u201d above to send us your changes.");
    hidden(form, "request_type").value = m;
    hidden(form, "existing_match").value = match ? [match.name, match.website].filter(Boolean).join(" | ") : (m === "update" ? "Not found on the page" : "");
    hidden(form, "website_clean").value = website;
    hidden(form, "linkedin_clean").value = linkedin;
    hidden(form, "listing_url").value = website || linkedin;
    hidden(form, "slug").value = slugify(firm) + "-" + Math.random().toString(36).slice(2, 6);
    return geocode(val(form, "city"), val(form, "country")).then(function (g) {
      if (!g && m === "add") return "We couldn't find that city on the map. Check the spelling of the city and country.";
      hidden(form, "latitude").value = g ? g.lat : "";
      hidden(form, "longitude").value = g ? g.lng : "";
      hidden(form, "geo_place").value = g ? g.place : "";
      hidden(form, "country_clean").value = g ? g.country : val(form, "country");
      var done = form.parentNode && form.parentNode.querySelector(".w-form-done");
      if (done) done.innerHTML = "<div>" + (m === "update"
        ? "Thanks! We received your update for " + firm.replace(/[<>&]/g, "") + ". The Colaeb team will apply it to your listing shortly, without creating a duplicate."
        : "Thanks! " + firm.replace(/[<>&]/g, "") + " is being added to the map. It usually appears within a minute or two.") + "</div>";
      return "";
    });
  }

  function bind() {
    css();
    document.querySelectorAll("form[data-cn-submit]").forEach(function (form) {
      if (form.__cnl) return; form.__cnl = 1;
      // Same importer repair as the match form: option values must equal their labels.
      [].forEach.call(form.querySelectorAll("select option"), function (o) {
        if (!o.value && o.textContent.trim()) o.value = o.textContent.trim();
      });
      // The importer renames some inputs to "field"; put the real names back.
      var fx = form.querySelector("#cnl-focus"); if (fx) { fx.name = "focus"; fx.setAttribute("data-name", "focus"); }
      // Already-on-the-list question: fixed option values, and the button label follows the choice.
      var st = form.querySelector('[name="listing_status"]'), btn0 = form.querySelector('[type="submit"]');
      if (st) {
        var opts = [["New listing", "No, add my firm"], ["Update existing listing", "Yes, update my listing"]];
        st.innerHTML = opts.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + "</option>"; }).join("");
        if (/[?&]update=1/.test(location.search)) st.value = "Update existing listing";
        var lab = function () { if (btn0) btn0.value = mode(form) === "update" ? "Update my listing" : "Add my firm"; say(form, ""); };
        st.addEventListener("change", lab); lab();
      }
      var ready = false;
      // Warm the geocoder while they type.
      var t; function warm() { clearTimeout(t); t = setTimeout(function () { if (val(form, "city") && val(form, "country")) geocode(val(form, "city"), val(form, "country")); }, 400); }
      ["city", "country"].forEach(function (n) { var el = form.querySelector('[name="' + n + '"]'); el && el.addEventListener("change", warm); });
      // Capture phase on window runs before Webflow's own submit handler.
      window.addEventListener("submit", function (e) {
        if (e.target !== form) return;
        if (ready) { ready = false; return; }       // second pass: let Webflow send it
        e.preventDefault(); e.stopImmediatePropagation();
        var btn = form.querySelector('[type="submit"]'), label = btn && btn.value;
        if (btn) { btn.disabled = true; btn.value = btn.getAttribute("data-wait") || "Please wait..."; }
        say(form, "");
        prepare(form).then(function (err) {
          if (btn) { btn.disabled = false; btn.value = label; }
          if (err) { say(form, err); return; }
          ready = true;
          if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        });
      }, true);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
})();
