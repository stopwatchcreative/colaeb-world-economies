/*! World Ranking of Economies — Colaeb Annual Report. Front-end loader.
 * Mounts by attribute: <div data-wer="masthead|globe|findings|movers|table|compare|neighbors|regions|archive|methods|footer|country"></div>
 * Config (page-level head code):  window.WER_CONFIG = { edition: "2026", page: "flagship" | "edition" | "country" }
 * Edition and country pages read the year / slug from the URL (/world-economies-report/2026, /economies/ghana).
 * Data is loaded from the same versioned jsDelivr tag as this script, so every edition is immutable.
 */
(function () {
  "use strict";
  var CFG = window.WER_CONFIG || {};
  var SCRIPT = document.currentScript || [].slice.call(document.scripts).filter(function (s) { return /wer(\.min)?\.js/.test(s.src); })[0];
  var BASE = CFG.base || (SCRIPT ? SCRIPT.src.replace(/\/web\/wer(\.min)?\.js.*$/, "") : "..");
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var PATH = location.pathname.replace(/\/+$/, "");
  var PAGE = CFG.page || (/\/economies\//.test(PATH) ? "country" : /\/world-economies-report\//.test(PATH) ? "edition" : "flagship");
  var EDITION = String(CFG.edition || (PAGE === "edition" ? PATH.split("/").pop() : "2026"));
  if (PAGE === "edition" && CFG.archiveYear) EDITION = String(CFG.archiveYear);
  var SITE = CFG.siteBase || "";
  var state = { metric: "gdp", compare: [], E: [], by: {}, bySlug: {} };

  // ------------------------------------------------------------ helpers
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "text") el.textContent = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  function svg(tag, attrs, kids) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs || {}) el.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function money(v, prefix) {
    if (v == null) return null; var p = prefix == null ? "$" : prefix;
    if (Math.abs(v) >= 1e12) return p + (v / 1e12).toFixed(2) + "T";
    if (Math.abs(v) >= 1e9) return p + (v / 1e9).toFixed(1) + "B";
    return p + (v / 1e6).toFixed(0) + "M";
  }
  function moneyLong(v) {
    if (v == null) return null;
    if (v >= 1e12) return "US$" + (v / 1e12).toFixed(2) + " trillion";
    if (v >= 1e9) return "US$" + (v / 1e9).toFixed(1) + " billion";
    return "US$" + (v / 1e6).toFixed(0) + " million";
  }
  function int(v) { return v == null ? null : Math.round(v).toLocaleString("en-US"); }
  function pct(v, nd, sign) { if (v == null) return null; var s = (+v).toFixed(nd == null ? 1 : nd) + "%"; return sign && v > 0 ? "+" + s : s; }
  function shareOf(v) { return v == null ? null : v < 0.01 ? "<0.01%" : v.toFixed(2) + "%"; }
  function people(v) { if (v == null) return null; return v >= 1e9 ? (v / 1e9).toFixed(2) + "B" : v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : int(v); }
  function ord(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function ratio(x) { return x < 10 ? x.toFixed(1) : Math.round(x).toLocaleString("en-US"); }
  function delta(ch) {
    if (ch == null) return h("span", { class: "wer-flat", text: "new" });
    if (ch === 0) return h("span", { class: "wer-flat wer-num", text: "–", "aria-label": "no change" });
    return h("span", { class: "wer-num " + (ch > 0 ? "wer-up" : "wer-down"), "aria-label": (ch > 0 ? "up " : "down ") + Math.abs(ch), text: (ch > 0 ? "▲" : "▼") + Math.abs(ch) });
  }
  function cell(e, key, text) {
    if (text != null) return text;
    var why = (e.missing || {})[key] || "Not reported for this economy.";
    return h("span", { class: "wer-missing", tabindex: "0", title: why, "aria-label": "Not available: " + why, text: "—" });
  }
  function asset(p) { return !p ? null : /^https?:/.test(p) ? p : BASE + "/" + p.replace(/^\//, ""); }
  function ldjson(obj) { var s = document.createElement("script"); s.type = "application/ld+json"; s.text = JSON.stringify(obj); document.head.appendChild(s); }
  function canonical(url) { if (document.querySelector('link[rel="canonical"]')) return; var l = document.createElement("link"); l.rel = "canonical"; l.href = url; document.head.appendChild(l); }
  function seo() {
    var ed = state.ed, org = { "@type": "Organization", name: "Colaeb", url: "https://colaeb.com" };
    var dataset = { "@context": "https://schema.org", "@type": "Dataset", name: "World Ranking of Economies " + EDITION + " Edition (" + ed.data_year + " data)",
      description: "GDP and related indicators for " + state.E.length + " economies, " + ed.data_year + ", compiled from the World Bank WDI and IMF World Economic Outlook.",
      creator: org, publisher: org, version: EDITION, temporalCoverage: "2000/" + state.FY,
      isAccessibleForFree: true, url: "https://colaeb.com/world-economies-report/" + EDITION };
    if (PAGE === "edition") {
      canonical("https://colaeb.com/world-economies-report/" + EDITION);
      ldjson({ "@context": "https://schema.org", "@type": "Report", name: "World Ranking of Economies — " + EDITION + " Edition", author: org, publisher: org,
        datePublished: ed.release_date || undefined, version: EDITION, temporalCoverage: String(ed.data_year), url: "https://colaeb.com/world-economies-report/" + EDITION });
      ldjson(dataset);
    } else if (PAGE === "country") {
      var e = state.bySlug[CFG.slug || PATH.split("/").pop()]; if (!e) return;
      canonical("https://colaeb.com/economies/" + e.slug);
      ldjson({ "@context": "https://schema.org", "@type": "Article", headline: e.name + " economy: GDP, rank and profile (" + EDITION + " Edition)", author: org, publisher: org,
        about: { "@type": "Country", name: e.name }, isPartOf: { "@type": "Report", name: "World Ranking of Economies — " + EDITION + " Edition", url: "https://colaeb.com/world-economies-report/" + EDITION },
        temporalCoverage: String(ed.data_year), url: "https://colaeb.com/economies/" + e.slug });
    }
  }
  function load(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); }); }
  var scriptP = {};
  function script(src, ordered) {
    // ordered: download in parallel with other ordered scripts but execute in insertion order
    if (scriptP[src]) return scriptP[src];
    return (scriptP[src] = new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.async = !ordered; s.onload = res; s.onerror = rej; document.head.appendChild(s); }));
  }
  function mounts(name) { return [].slice.call(document.querySelectorAll('[data-wer="' + name + '"]')); }
  function countryUrl(e) { return SITE + "/economies/" + e.slug; }
  function q(name) { return new URLSearchParams(location.search).get(name); }
  function setQ(name, val) {
    var u = new URL(location.href);
    if (val) u.searchParams.set(name, val); else u.searchParams.delete(name);
    history.replaceState(null, "", u.toString());
  }
  function onVisible(el, fn) {
    if (!("IntersectionObserver" in window)) return fn();
    var io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); fn(); } }, { rootMargin: "300px" });
    io.observe(el);
  }

  // ------------------------------------------------------------ metrics + colour
  var METRICS = {
    gdp: { label: "GDP", get: function (e) { return e.gdp; }, fmt: function (v) { return money(v); }, log: true },
    gdp_pc: { label: "GDP per capita", get: function (e) { return e.gdp_pc; }, fmt: function (v) { return "$" + int(v); }, log: true },
    gdp_pc_ppp: { label: "PPP per capita", get: function (e) { return e.gdp_pc_ppp; }, fmt: function (v) { return "$" + int(v); }, log: true },
    growth: { label: "Growth", get: function (e) { return e.growth; }, fmt: function (v) { return pct(v, 1, true); } },
    debt_pct_gdp: { label: "Debt % of GDP", get: function (e) { return e.debt_pct_gdp; }, fmt: function (v) { return pct(v, 0); } },
    population: { label: "Population", get: function (e) { return e.population; }, fmt: people, log: true },
    rank_change: { label: "Rank change", get: function (e) { return e.rank_change; }, fmt: function (v) { return (v > 0 ? "+" : "") + v; }, diverging: true }
  };
  // one colourblind-safe sequential ramp (single hue, light to dark) used for every map shading
  var RAMP = ["#FCEFE2", "#F9D9B8", "#F5BC86", "#EE9955", "#DD7330", "#B85419", "#87390C"];
  var DIV = ["#2E5B82", "#7E9FBE", "#C9D6E2", "#EDEAE3", "#F5BC86", "#DD7330", "#87390C"];
  var NODATA = "#DDD9CF";
  function scaleFor(key) {
    var m = METRICS[key], vals = state.E.map(m.get).filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; });
    if (m.diverging) {
      return { color: function (v) { if (v == null) return NODATA; var i = v <= -6 ? 0 : v <= -3 ? 1 : v < 0 ? 2 : v === 0 ? 3 : v < 3 ? 4 : v < 6 ? 5 : 6; return DIV[i]; },
        stops: DIV, lo: "▼6+", hi: "▲6+" };
    }
    var br = []; for (var i = 1; i < RAMP.length; i++) br.push(vals[Math.floor(vals.length * i / RAMP.length)]);
    return { color: function (v) { if (v == null) return NODATA; var k = 0; while (k < br.length && v >= br[k]) k++; return RAMP[k]; },
      stops: RAMP, lo: m.fmt(vals[0]), hi: m.fmt(vals[vals.length - 1]) };
  }

  // ------------------------------------------------------------ small charts (SVG)
  function sparkline(e, w, ht) {
    w = w || 96; ht = ht || 24;
    var yrs = Object.keys(e.gdp_history || {}).map(Number).sort().slice(-11), pts = yrs.map(function (y) { return e.gdp_history[y]; }).filter(function (v) { return v != null; });
    if (pts.length < 2) return h("span", { class: "wer-flat", text: "" });
    var mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), d = pts.map(function (v, i) {
      return (i ? "L" : "M") + (i * (w - 2) / (pts.length - 1) + 1).toFixed(1) + " " + (ht - 2 - (mx === mn ? .5 : (v - mn) / (mx - mn)) * (ht - 4)).toFixed(1);
    }).join("");
    var up = pts[pts.length - 1] >= pts[0];
    return svg("svg", { class: "wer-spark", width: w, height: ht, viewBox: "0 0 " + w + " " + ht, role: "img", "aria-label": "GDP " + yrs[0] + "–" + yrs[yrs.length - 1] + ": " + money(pts[0]) + " to " + money(pts[pts.length - 1]) },
      [svg("path", { d: d, fill: "none", stroke: up ? "#B85419" : "#2E5B82", "stroke-width": "1.5" })]);
  }
  var PALETTE = ["#DD7330", "#101828", "#2E5B82", "#7A8794"];
  function lineChart(series, opt) {
    opt = opt || {}; var W = 860, H = opt.height || 320, L = 64, R = 16, T = 16, B = 32;
    var all = []; series.forEach(function (s) { s.points.forEach(function (p) { if (p[1] > 0) all.push(p); }); });
    if (!all.length) return h("p", { class: "wer-note", text: "No series available." });
    var x0 = Math.min.apply(null, all.map(function (p) { return p[0]; })), x1 = Math.max.apply(null, all.map(function (p) { return p[0]; }));
    var lg = opt.log !== false, ys = all.map(function (p) { return lg ? Math.log10(p[1]) : p[1]; });
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys); if (y0 === y1) { y0 -= .5; y1 += .5; }
    if (lg) { y0 = Math.floor(y0); y1 = Math.ceil(y1); } else { y0 = Math.min(0, y0); y1 = y1 * 1.05; }
    var X = function (v) { return L + (v - x0) / (x1 - x0 || 1) * (W - L - R); }, Y = function (v) { var t = lg ? Math.log10(v) : v; return T + (1 - (t - y0) / (y1 - y0)) * (H - T - B); };
    var kids = [svg("title", {}, [opt.title || "GDP over time"]), svg("desc", {}, [opt.desc || ""])];
    var ticks = []; if (lg) for (var t = y0; t <= y1; t++) ticks.push(Math.pow(10, t)); else for (var j = 0; j <= 4; j++) ticks.push(y0 + (y1 - y0) * j / 4);
    ticks.forEach(function (v) { kids.push(svg("line", { class: "wer-grid", x1: L, x2: W - R, y1: Y(v), y2: Y(v) })); kids.push(svg("text", { x: L - 8, y: Y(v) + 4, "text-anchor": "end" }, [opt.fmt ? opt.fmt(v) : money(v)])); });
    for (var yr = Math.ceil(x0 / 5) * 5; yr <= x1; yr += 5) kids.push(svg("text", { x: X(yr), y: H - 10, "text-anchor": "middle" }, [String(yr)]));
    if (opt.split) kids.push(svg("line", { x1: X(opt.split), x2: X(opt.split), y1: T, y2: H - B, stroke: "#C9CED6", "stroke-dasharray": "3 3" }), svg("text", { x: X(opt.split) + 6, y: H - B - 8 }, ["IMF forecast →"]));
    series.forEach(function (s, i) {
      var c = s.color || PALETTE[i % PALETTE.length];
      var pts = s.points.filter(function (p) { return p[1] > 0; });
      var hist = pts.filter(function (p) { return !opt.split || p[0] <= opt.split; }), fc = pts.filter(function (p) { return opt.split && p[0] >= opt.split; });
      var path = function (ps) { return ps.map(function (p, k) { return (k ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); }).join(""); };
      if (hist.length > 1) kids.push(svg("path", { d: path(hist), fill: "none", stroke: c, "stroke-width": "2.2" }));
      if (fc.length > 1) kids.push(svg("path", { d: path(fc), fill: "none", stroke: c, "stroke-width": "2.2", "stroke-dasharray": "5 4" }));
      var last = pts[pts.length - 1]; if (last && series.length === 1) kids.push(svg("text", { x: Math.min(X(last[0]) + 4, W - R - 4), y: Y(last[1]) - 6, "text-anchor": "end", style: "fill:" + c + ";font-weight:600" }, [s.name]));
    });
    return svg("svg", { class: "wer-chart", viewBox: "0 0 " + W + " " + H, role: "img" }, kids);
  }
  function srTable(caption, cols, rows) {
    var t = h("table", { class: "wer-sr" }, [h("caption", { text: caption }), h("tr", {}, cols.map(function (c) { return h("th", { text: c }); }))]);
    rows.forEach(function (r) { t.appendChild(h("tr", {}, r.map(function (c) { return h("td", { text: c == null ? "—" : String(c) }); }))); });
    return t;
  }
  function historyPoints(e, withForecast) {
    var p = Object.keys(e.gdp_history || {}).map(function (y) { return [+y, e.gdp_history[y]]; });
    if (withForecast && e.imf_forecast) { p.push([state.Y, e.gdp]); Object.keys(e.imf_forecast).forEach(function (y) { p.push([+y, e.imf_forecast[y]]); }); }
    p.sort(function (a, b) { return a[0] - b[0]; });
    return p.filter(function (x, i) { return !i || x[0] !== p[i - 1][0]; });
  }

  // ------------------------------------------------------------ tooltip + side panel
  var tip;
  function showTip(html, ev) {
    if (!tip) { tip = h("div", { class: "wer-tip", role: "tooltip" }); document.body.appendChild(tip); }
    tip.innerHTML = html; tip.style.display = "block";
    var x = ev.clientX + 14, y = ev.clientY + 14; if (x + 270 > innerWidth) x = ev.clientX - 274;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function hideTip() { if (tip) tip.style.display = "none"; }
  function unTip(u) { return "<div style='font-size:15px;font-weight:600'>" + esc(u.name) + "</div><div>Not ranked in the " + EDITION + " Edition: no " + state.Y + " GDP from the World Bank or IMF.</div>"; }
  function tipHtml(e) {
    var m = METRICS[state.metric], v = m.get(e);
    var ch = e.rank_change; var mv = ch == null ? "" : ch === 0 ? " · no change" : ch > 0 ? " · ▲" + ch : " · ▼" + (-ch);
    return "<div style='font-size:15px;font-weight:600'>" + (e.flag || "") + " " + esc(e.name) + "</div><div>Rank <span class='wer-num'>" + e.rank + "</span>" + mv +
      "</div><div>" + m.label + ": <span class='wer-num'>" + (v == null ? "—" : m.fmt(v)) + "</span></div>";
  }
  var panel, scrim, lastFocus;
  function openPanel(e) {
    if (!panel) {
      scrim = h("div", { class: "wer-scrim", onclick: closePanel });
      panel = h("aside", { class: "wer-panel wer-page", role: "dialog", "aria-modal": "true", "aria-label": "Economy details", tabindex: "-1" });
      document.body.appendChild(scrim); document.body.appendChild(panel);
      document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") closePanel(); });
    }
    lastFocus = document.activeElement;
    var words = (e.profile || "").split(/\s+/), excerpt = words.slice(0, 48).join(" ") + (words.length > 48 ? "…" : "");
    var stats = [["GDP", money(e.gdp), "gdp"], ["Share of world", shareOf(e.share_world), null], ["Growth", pct(e.growth, 1, true), "growth"], ["Per capita", e.gdp_pc != null ? "$" + int(e.gdp_pc) : null, "gdp_pc"],
      ["PPP per capita", e.gdp_pc_ppp != null ? "$" + int(e.gdp_pc_ppp) : null, "gdp_pc_ppp"], ["Population", people(e.population), "population"], ["Inflation", pct(e.inflation), "inflation"], ["Debt % GDP", pct(e.debt_pct_gdp, 0), "debt_pct_gdp"]];
    panel.innerHTML = "";
    panel.appendChild(h("button", { class: "wer-btn wer-btn-sm wer-panel-close", onclick: closePanel, "aria-label": "Close" }, ["✕"]));
    panel.appendChild(h("div", { class: "wer-country-flag", "aria-hidden": "true", text: e.flag || "" }));
    panel.appendChild(h("h3", { text: e.name }));
    panel.appendChild(h("div", { class: "wer-panel-rank" }, ["#" + e.rank + " of " + state.E.length + " · ", delta(e.rank_change), " since " + (state.Y - 1)]));
    panel.appendChild(h("div", { class: "wer-panel-stats" }, stats.map(function (s) { return h("div", {}, [h("span", { text: s[0] }), h("b", {}, [cell(e, s[2], s[1])])]); })));
    panel.appendChild(sparkline(e, 360, 60));
    panel.appendChild(h("p", { class: "wer-note", text: "GDP, last 11 years (current US$)" }));
    if (e.size_equivalent) panel.appendChild(h("p", { text: e.size_equivalent.label }));
    if (excerpt) panel.appendChild(h("p", { text: excerpt }));
    panel.appendChild(h("div", { class: "wer-panel-actions" }, [
      h("a", { class: "wer-btn wer-btn-accent", href: countryUrl(e) }, ["Full profile"]),
      h("button", { class: "wer-btn", onclick: function () { addCompare(e.slug); closePanel(); scrollToMount("compare"); } }, ["Compare"]),
      h("button", { class: "wer-btn", onclick: function () { setNeighbors(e.slug); closePanel(); scrollToMount("neighbors"); } }, ["Show rank neighbors"])
    ]));
    scrim.classList.add("is-open"); panel.classList.add("is-open"); panel.focus();
    if (state.globe && !state.globe.mini) state.globe.flyTo(e);
  }
  function closePanel() { if (!panel || !panel.classList.contains("is-open")) return; panel.classList.remove("is-open"); scrim.classList.remove("is-open"); if (lastFocus) lastFocus.focus(); }
  function scrollToMount(n) { var m = mounts(n)[0]; if (m) m.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }); }

  // ------------------------------------------------------------ masthead
  function renderMasthead(el) {
    var ed = state.ed, eds = state.editions, isArchive = PAGE === "edition" && state.current !== +EDITION;
    var gen = new Date(ed.generated), compiled = gen.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    var rel = ed.release_date ? new Date(ed.release_date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
    var meta = state.editionMeta || {};
    var sw = h("select", { class: "wer-select", "aria-label": "Choose edition", onchange: function (ev) { location.href = ev.target.value; } },
      eds.map(function (x) { return h("option", { value: x.status === "current" ? SITE + "/world-economies" : SITE + "/world-economies-report/" + x.year, selected: String(x.year) === EDITION ? true : null, text: x.year + " Edition" + (x.status === "current" ? " (latest)" : "") }); }));
    var cite = h("div", { class: "wer-cite", id: "wer-cite", role: "region", "aria-label": "Suggested citation" }, [
      h("div", { text: citation() }), h("button", { class: "wer-btn wer-btn-sm", style: "margin-top:10px", onclick: function (ev) { copy(citation(), ev.target); } }, ["Copy citation"])]);
    var kids = [];
    if (isArchive) kids.push(h("div", { class: "wer-banner", html: "You're viewing the " + EDITION + " Edition — <a href='" + SITE + "/world-economies'>see the latest edition</a>." }));
    kids.push(h("div", { class: "wer-wrap" }, [h("div", { class: "wer-masthead-grid" }, [
      h("div", {}, [
        h("p", { class: "wer-kicker", text: "A Colaeb Annual Report" + (eds.length === 1 ? " · Inaugural Edition" : "") }),
        h("h1", { class: "wer-title", text: "World Ranking of Economies" }),
        h("p", { class: "wer-lede", html: "Colaeb's annual ranking of the world's economies by size: all " + state.E.length + " ranked by " + ed.data_year + " GDP in current U.S. dollars. "
          + "Every figure comes from the World Bank's World Development Indicators and the " + esc(ed.imf_weo.replace(/^IMF World Economic Outlook, (.+)$/, "IMF's $1 World Economic Outlook")) + ", and each value is traced to its source in the <a href='#methodology'>methodology</a>." }),
        unrankedNote(),
        h("div", { class: "wer-meta" }, [h("span", { html: "<b>" + EDITION + " Edition</b>" }), h("span", { html: "Data year <b>" + ed.data_year + "</b>" }),
          h("span", { html: rel ? "Released <b>" + rel + "</b>" : "Data compiled <b>" + compiled + "</b>" }), h("span", { html: "<b>" + state.E.length + "</b> economies" })]),
        h("div", { class: "wer-actions" }, [sw,
          meta.pdf ? h("a", { class: "wer-btn", href: asset(meta.pdf) }, ["Download report (PDF)"]) : null,
          h("button", { class: "wer-btn wer-btn-accent", "aria-haspopup": "dialog", onclick: function () { openGate(asset(meta.csv) || BASE + "/data/economies-" + EDITION + ".csv"); } }, ["Download data (CSV)"]),
          h("button", { class: "wer-btn", "aria-controls": "wer-cite", "aria-expanded": "false", onclick: function (ev) { var o = cite.classList.toggle("is-open"); ev.currentTarget.setAttribute("aria-expanded", o); } }, ["Cite this report"])]),
        cite]),
      h("p", { class: "wer-edition-mark", "aria-hidden": "true", text: EDITION })])]));
    el.classList.add("wer-masthead"); el.innerHTML = ""; kids.forEach(function (k) { el.appendChild(k); });
  }
  function citation() {
    return "Colaeb. (" + EDITION + "). World Ranking of Economies — " + EDITION + " Edition (" + state.ed.data_year + " data). Colaeb Annual Report. https://colaeb.com/world-economies-report/" + EDITION;
  }
  function copy(text, btn) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { var t = btn.textContent; btn.textContent = "Copied"; setTimeout(function () { btn.textContent = t; }, 1600); }, function () { prompt("Copy:", text); });
  }



  // ------------------------------------------------------------ unranked economies
  var UNRANKED_NAMES = { PRK: "North Korea", SYR: "Syria", CUW: "Curaçao", VIR: "U.S. Virgin Islands", MAF: "Saint Martin (French part)" };
  var UNRANKED_ALIASES = { PRK: ["dprk", "korea, north", "democratic people's republic of korea"], SYR: ["syrian arab republic"], VIR: ["virgin islands (u.s.)", "usvi"] };
  function unranked() {
    return ((state.ed.universe_notes || {}).excluded_no_gdp || []).map(function (x) {
      var iso = x.slice(0, 3), raw = x.slice(4);
      return { iso3: iso, name: UNRANKED_NAMES[iso] || raw, raw: raw };
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }
  function unrankedMatch(q) {
    q = q.trim().toLowerCase(); if (q.length < 3) return null;
    return unranked().filter(function (u) {
      return [u.name, u.raw].concat(UNRANKED_ALIASES[u.iso3] || []).some(function (n) { return n.toLowerCase().indexOf(q) >= 0; }) || u.iso3.toLowerCase() === q;
    })[0] || null;
  }
  function unrankedReason() { return "Neither the World Bank nor the IMF publishes a " + state.Y + " GDP figure for it, so it can't be ranked without estimating."; }
  function unrankedNote() {
    var U = unranked(); if (!U.length) return null;
    var famous = ["PRK", "CUB", "SYR", "ERI"].map(function (i) { return U.filter(function (u) { return u.iso3 === i; })[0]; }).filter(Boolean).map(function (u) { return u.name; });
    return h("details", { class: "wer-unranked" }, [
      h("summary", {}, [h("b", { text: "Not ranked: " }), U.length + " economies, including " + (famous.length > 1 ? famous.slice(0, -1).join(", ") + " and " + famous[famous.length - 1] : famous.join("")) + ", have no " + state.Y + " GDP figure from either the World Bank or the IMF, so they aren't in this edition's ranking. ", h("span", { class: "wer-unranked-more", text: "See all " + U.length })]),
      h("p", { text: U.map(function (u) { return u.name; }).join(" · ") }),
      h("p", { class: "wer-note", text: "We don't estimate missing figures. An economy joins the ranking in the first edition after either source publishes its GDP." })]);
  }

  // ------------------------------------------------------------ email gate for the data download
  // A native Webflow form ([data-wer-gate], named "WER Data Download") collects the email; once Webflow
  // confirms the submission the CSV downloads. A visitor who has already submitted (this browser) skips the form.
  var GATE_KEY = "wer-data-gate";
  function gatePassed() { try { return localStorage.getItem(GATE_KEY) === "1"; } catch (e) { return false; } }
  function gateRemember() { try { localStorage.setItem(GATE_KEY, "1"); } catch (e) {} }
  function downloadFile(url) {
    var name = "wer-" + EDITION + "-data.csv";
    fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(function (b) {
      var u = URL.createObjectURL(b), a = h("a", { href: u, download: name, style: "display:none" });
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 4000);
    }).catch(function () { window.open(url, "_blank", "noopener"); });
  }
  var gateBox, gateWf, gateHome;
  // The Webflow form block: the custom attribute may sit on the wrapper or on the <form> itself, so always
  // take the .w-form wrapper. Webflow's submit handler (and its Turnstile spam check) only works while the form
  // stays inside that wrapper, and the success message lives in it too.
  function gateForm() {
    if (gateWf) return gateWf;
    var el = document.querySelector("[data-wer-gate]");
    if (!el) return null;
    gateWf = (el.closest && el.closest(".w-form")) || el;
    gateHome = gateWf.parentNode;
    return gateWf;
  }
  function openGate(url) {
    if (gatePassed()) return downloadFile(url);
    var last = document.activeElement;
    function park() { if (gateWf && gateHome && gateBox && gateBox.contains(gateWf)) gateHome.appendChild(gateWf); }
    function close() { if (!gateBox) return; gateBox.classList.remove("is-open"); document.removeEventListener("keydown", onKey); if (!gatePassed()) park(); if (last) last.focus(); }
    function onKey(ev) { if (ev.key === "Escape") close(); }
    function done() {
      gateRemember();
      park();
      body.innerHTML = "";
      body.appendChild(h("p", { class: "wer-gate-ok", text: "Thanks! Your download has started." }));
      body.appendChild(h("p", { class: "wer-note" }, ["If it didn't, ", h("a", { href: url, target: "_blank", rel: "noopener", text: "download the CSV here" }), "."]));
      downloadFile(url);
    }
    if (!gateBox) {
      gateBox = h("div", { class: "wer-gate wer-page", role: "dialog", "aria-modal": "true", "aria-labelledby": "wer-gate-title" });
      document.body.appendChild(gateBox);
    }
    var wf = gateForm();
    park();
    gateBox.innerHTML = "";
    var body = h("div", { class: "wer-gate-body" });
    var card = h("div", { class: "wer-gate-card" }, [
      h("button", { class: "wer-btn wer-btn-sm wer-panel-close", "aria-label": "Close", onclick: close }, ["✕"]),
      h("p", { class: "wer-kicker", text: "World Ranking of Economies · " + EDITION + " Edition" }),
      h("h3", { id: "wer-gate-title", class: "wer-gate-title", text: "Download the full dataset" }),
      h("p", { class: "wer-dek", text: "Enter your email and the CSV downloads right away: all " + state.E.length + " economies, every field with its source." }),
      body]);
    gateBox.appendChild(h("div", { class: "wer-gate-scrim", onclick: close }));
    gateBox.appendChild(card);
    if (wf) {
      var form = wf.tagName === "FORM" ? wf : wf.querySelector("form");
      if (form && !form.querySelector('input[name="Edition"]')) {
        form.appendChild(h("input", { type: "hidden", name: "Edition", value: EDITION }));
        form.appendChild(h("input", { type: "hidden", name: "Page", value: location.pathname }));
      }
      var ok = wf.querySelector(".w-form-done");
      if (ok && getComputedStyle(ok).display !== "none") { done(); }
      else {
        body.appendChild(wf);
        var mo = new MutationObserver(function () { if (ok && getComputedStyle(ok).display !== "none") { mo.disconnect(); done(); } });
        if (wf._werMo) wf._werMo.disconnect();
        wf._werMo = mo;
        mo.observe(wf, { attributes: true, subtree: true, attributeFilter: ["style", "class"] });
        if (!window.Webflow && form) form.onsubmit = function (ev) { ev.preventDefault(); if (form.checkValidity()) { mo.disconnect(); done(); } };
      }
    } else {
      // No Webflow form on this page (e.g. local preview): same UI, nothing is collected.
      console.warn("[wer] data-download form not found; download is not gated on this page");
      var f = h("form", { class: "wer-gate-form", onsubmit: function (ev) { ev.preventDefault(); done(); } }, [
        h("label", { for: "wer-gate-email", text: "Email" }), h("input", { id: "wer-gate-email", type: "email", required: true, class: "wer-input" }),
        h("button", { class: "wer-btn wer-btn-accent", type: "submit", text: "Get the data" })]);
      body.appendChild(f);
    }
    gateBox.classList.add("is-open");
    document.addEventListener("keydown", onKey);
    var first = gateBox.querySelector('input[type="email"]') || card.querySelector("button"); if (first) first.focus();
  }

  // ------------------------------------------------------------ hero: globe / 2D map + stat strip
  function renderGlobe(el) {
    el.classList.add("wer-hero");
    var bar = h("div", { class: "wer-metrics", role: "group", "aria-label": "Shade map by" });
    Object.keys(METRICS).forEach(function (k) {
      bar.appendChild(h("button", { class: "wer-metric", "aria-pressed": String(k === state.metric), "data-k": k, onclick: function () { setMetric(k); } }, [METRICS[k].label]));
    });
    var stage = h("div", { class: "wer-globe", role: "application", "aria-label": "Interactive map of world economies shaded by the selected metric. Use the rankings table below for a keyboard-accessible list." }, [h("div", { class: "wer-globe-loading", text: "Loading map…" })]);
    var legend = h("div", { class: "wer-legend", "aria-hidden": "true" });
    stage.appendChild(legend);
    el.innerHTML = "";
    el.appendChild(h("div", { class: "wer-wrap" }, [h("div", { class: "wer-hero-head" }, [h("h2", { class: "wer-sr", text: "Explore the map" }), bar]), stage, statStrip()]));
    state.legend = legend; state.stage = stage;
    var force = q("globe"), small = force === "2d" || CFG.force2d || (force !== "3d" && (innerWidth < 760 || !webgl() || (navigator.hardwareConcurrency || 8) < 4));
    loadGeo().then(function (geo) {
      map2d(stage, geo);  // fast flat map first, so the hero is never empty
      if (small) return;
      var idle = window.requestIdleCallback || function (f) { setTimeout(f, 300); };
      idle(function () {
        script(BASE + "/web/vendor/globe.gl.min.js").then(function () { globe3d(stage, geo); }).catch(function (err) { console.warn("[wer] 3D globe unavailable, keeping flat map", err); });
      });
    }).catch(function (err) { stage.querySelector(".wer-globe-loading").textContent = "Map unavailable."; console.warn(err); });
    paintLegend();
  }
  function webgl() { try { var c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); } catch (e) { return false; } }
  var geoRaw, geoP;
  function fetchGeo() {
    // starts as early as possible (boot), in parallel with the edition data
    if (!geoRaw) geoRaw = Promise.all([script(BASE + "/web/vendor/topojson-client.min.js", true), script(BASE + "/web/vendor/d3-array.min.js", true), script(BASE + "/web/vendor/d3-geo.min.js", true),
      load(BASE + "/web/vendor/countries-110m.json"), load(BASE + "/web/vendor/n3-iso3.json"), load(BASE + "/web/vendor/latlng.json")]);
    return geoRaw;
  }
  function loadGeo() {
    if (geoP) return geoP;
    geoP = fetchGeo().then(function (r) {
      var topo = r[3], n3 = r[4], ll = r[5];
      var fc = topojson.feature(topo, topo.objects.countries);
      var un = {}; unranked().forEach(function (u) { un[u.iso3] = u; });
      var feats = fc.features.map(function (f) { f.iso3 = n3[f.id] || null; f.e = f.iso3 ? state.by[f.iso3] : null; f.un = !f.e && f.iso3 ? un[f.iso3] : null; return f; });
      var onMap = {}; feats.forEach(function (f) { if (f.e) onMap[f.iso3] = 1; });
      var dots = state.E.filter(function (e) { return !onMap[e.iso3] && ll[e.iso3]; }).map(function (e) { return { e: e, lat: ll[e.iso3][0], lng: ll[e.iso3][1] }; });
      feats.forEach(function (f) { if (f.e) { var c = d3.geoCentroid(f); state.centroid[f.iso3] = { lat: c[1], lng: c[0] }; } });
      dots.forEach(function (d) { state.centroid[d.e.iso3] = { lat: d.lat, lng: d.lng }; });
      return { feats: feats, dots: dots, land: topojson.feature(topo, topo.objects.land) };
    });
    return geoP;
  }
  function globe3d(stage, geo) {
    var flat = stage.querySelector(".wer-map2d");
    stage.style.height = ""; stage.style.minHeight = "";
    var holder = h("div", { class: "wer-globe-3d" }); stage.insertBefore(holder, stage.firstChild);
    var swap = function () { if (flat) flat.remove(); holder.classList.add("is-in"); };
    stage = holder;
    var color = function (f) { var s = state.scale; return f.e ? s.color(METRICS[state.metric].get(f.e)) : NODATA; };
    var g = Globe({ animateIn: !REDUCED })(stage)
      .width(stage.clientWidth).height(stage.clientHeight).backgroundColor("rgba(0,0,0,0)")
      .showAtmosphere(true).atmosphereColor("#F5BC86").atmosphereAltitude(0.14)
      .hexPolygonsData(geo.feats).hexPolygonResolution(3).hexPolygonMargin(0.42).hexPolygonUseDots(true).hexPolygonAltitude(0.006)
      .hexPolygonColor(color).hexPolygonLabel(function (f) { return f.e ? tipHtml(f.e) : f.un ? unTip(f.un) : ""; })
      .onHexPolygonClick(function (f) { if (f.e) onPick(f.e); })
      .onHexPolygonHover(function (f) { stage.style.cursor = f && f.e ? "pointer" : "grab"; })
      .pointsData(geo.dots).pointLat("lat").pointLng("lng").pointAltitude(0.012).pointRadius(0.55)
      .pointColor(function (d) { return state.scale.color(METRICS[state.metric].get(d.e)); }).pointLabel(function (d) { return tipHtml(d.e); })
      .onPointClick(function (d) { onPick(d.e); })
      .arcColor(function () { return ["#DD7330", "#101828"]; }).arcStroke(0.6).arcDashLength(0.5).arcDashGap(0.15).arcDashAnimateTime(REDUCED ? 0 : 2400).arcAltitudeAutoScale(0.4);
    swap();
    var mat = g.globeMaterial(); mat.color.set("#F2EEE6"); if (mat.emissive) mat.emissive.set("#E9E3D7");
    var c = g.controls(); c.autoRotate = !REDUCED; c.autoRotateSpeed = 0.35; c.enableZoom = true;
    stage.addEventListener("pointerdown", function () { c.autoRotate = false; });
    g.pointOfView({ lat: 22, lng: 10, altitude: 1.85 });
    new ResizeObserver(function () { g.width(stage.clientWidth).height(stage.clientHeight); }).observe(stage);
    var ld = stage.querySelector(".wer-globe-loading"); if (ld) ld.remove();
    state.globe = {
      repaint: function () { g.hexPolygonColor(color).pointColor(g.pointColor()); },
      flyTo: function (e) { var p = state.centroid[e.iso3]; if (p) { c.autoRotate = false; g.pointOfView({ lat: p.lat, lng: p.lng, altitude: 1.6 }, REDUCED ? 0 : 1200); } },
      arcs: function (slugs) {
        var pts = slugs.map(function (s) { var e = state.bySlug[s]; return e && state.centroid[e.iso3]; }).filter(Boolean), arcs = [];
        for (var i = 1; i < pts.length; i++) arcs.push({ startLat: pts[0].lat, startLng: pts[0].lng, endLat: pts[i].lat, endLng: pts[i].lng });
        g.arcsData(arcs);
      }
    };
    state.globe.arcs(state.compare);
  }
  function map2d(stage, geo) {
    var W = 960, H = 500, proj = d3.geoEqualEarth().fitSize([W, H], { type: "Sphere" }), path = d3.geoPath(proj);
    var root = svg("svg", { class: "wer-map2d", viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "World map shaded by the selected metric" });
    root.appendChild(svg("path", { d: path({ type: "Sphere" }), fill: "#F2EEE6" }));
    var shapes = [];
    geo.feats.forEach(function (f) {
      if (f.id === "010") return; // Antarctica
      var p = svg("path", { d: path(f) || "" });
      if (f.un) {
        p.setAttribute("aria-label", f.un.name + ", not ranked");
        p.addEventListener("mousemove", function (ev) { showTip(unTip(f.un), ev); }); p.addEventListener("mouseleave", hideTip);
      }
      if (f.e) {
        p.setAttribute("tabindex", "0"); p.setAttribute("aria-label", f.e.name + ", rank " + f.e.rank);
        p.addEventListener("mousemove", function (ev) { showTip(tipHtml(f.e), ev); }); p.addEventListener("mouseleave", hideTip);
        p.addEventListener("click", function () { hideTip(); onPick(f.e); });
        p.addEventListener("keydown", function (ev) { if (ev.key === "Enter") onPick(f.e); });
      }
      shapes.push([p, f.e]); root.appendChild(p);
    });
    geo.dots.forEach(function (d) {
      var xy = proj([d.lng, d.lat]); if (!xy) return;
      var c = svg("circle", { cx: xy[0], cy: xy[1], r: 3.2, stroke: "#fff", "stroke-width": ".6", tabindex: "0", "aria-label": d.e.name + ", rank " + d.e.rank });
      c.addEventListener("mousemove", function (ev) { showTip(tipHtml(d.e), ev); }); c.addEventListener("mouseleave", hideTip); c.addEventListener("click", function () { onPick(d.e); });
      shapes.push([c, d.e]); root.appendChild(c);
    });
    var ld = stage.querySelector(".wer-globe-loading"); if (ld) ld.remove();
    stage.insertBefore(root, stage.firstChild); if (innerWidth < 760) { stage.style.height = "auto"; stage.style.minHeight = "0"; }
    state.globe = { repaint: function () { shapes.forEach(function (s) { s[0].setAttribute("fill", s[1] ? state.scale.color(METRICS[state.metric].get(s[1])) : NODATA); }); }, flyTo: function () {}, arcs: function () {} };
    state.globe.repaint();
  }
  function onPick(e) { if (state.picking) { addCompare(e.slug); return; } openPanel(e); }
  function setMetric(k) {
    state.metric = k; state.scale = scaleFor(k); setQ("metric", k === "gdp" ? null : k);
    [].forEach.call(document.querySelectorAll(".wer-metric"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-k") === k)); });
    paintLegend(); if (state.globe) state.globe.repaint();
  }
  function paintLegend() {
    if (!state.legend) return; var s = state.scale;
    state.legend.innerHTML = "<div>" + METRICS[state.metric].label + "</div><div class='wer-legend-bar' style='background:linear-gradient(90deg," + s.stops.join(",") + ")'></div><div class='wer-legend-row'><span>" + esc(s.lo) + "</span><span>" + esc(s.hi) + "</span></div>";
  }
  function statStrip() {
    var E = state.E, w = state.ed.world, fast = E.filter(function (e) { return e.growth != null; }).sort(function (a, b) { return b.growth - a.growth; })[0];
    var items = [["World GDP", money(w.gdp), "World Bank aggregate, " + state.Y], ["Largest economy", E[0].name, money(E[0].gdp) + " · " + pct(E[0].share_world, 1) + " of world"],
      ["Fastest growing", fast.name, pct(fast.growth, 1, true) + " real growth"], ["Top 10 share", pct(w.top10_share, 1), "of world output"]];
    return h("div", { class: "wer-stat-strip" }, items.map(function (s) {
      return h("div", { class: "wer-stat" }, [h("div", { class: "wer-stat-label", text: s[0] }), h("div", { class: "wer-stat-value", text: s[1] }), h("div", { class: "wer-stat-sub", text: s[2] })]);
    }));
  }

  // ------------------------------------------------------------ section scaffolding
  function section(el, id, title, dek, body) {
    el.classList.add("wer-section"); el.id = el.id || id; el.innerHTML = "";
    el.appendChild(h("div", { class: "wer-wrap" }, [h("div", { class: "wer-section-head" }, [h("h2", { class: "wer-h2", text: title }), dek ? h("p", { class: "wer-dek", text: dek }) : h("span")])].concat(body)));
  }
  function deepLink(link) {
    if (!link) return "#";
    if (PAGE !== "flagship") return SITE + "/world-economies" + link;
    return link;
  }

  // ------------------------------------------------------------ key findings + movers
  function renderFindings(el) {
    var F = state.findings; if (!F) return;
    section(el, "findings", "Key Findings", "The " + EDITION + " Edition in ten numbers. Each links into the data.", [
      h("div", { class: "wer-findings" }, F.findings.map(function (f, i) {
        return h("a", { class: "wer-finding-card", href: deepLink(f.link), onclick: function (ev) { if (PAGE === "flagship") { ev.preventDefault(); followLink(f.link); } } }, [
          h("span", { class: "wer-finding-n", text: String(i + 1).padStart(2, "0") }), h("span", { class: "wer-finding-num", text: f.number }),
          h("span", { class: "wer-finding-title", text: f.title }), h("span", { class: "wer-finding-body", text: f.body })]);
      }))]);
  }
  function followLink(link) {
    var u = new URL(link, location.href);
    if (u.hash) { var n = +u.hash.replace("#rank-", ""); if (n) return jumpTo(n); var t = document.querySelector(u.hash); if (t) t.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" }); return; }
    var m = u.searchParams.get("metric"); if (m && METRICS[m]) { setMetric(m); scrollToMount("globe"); }
    var c = u.searchParams.get("compare"); if (c) { state.compare = []; c.split(",").forEach(addCompare); scrollToMount("compare"); }
  }
  function renderMovers(el) {
    var F = state.findings; if (!F) return;
    var col = function (title, list) {
      return h("div", {}, [h("h3", { text: title })].concat(list.map(function (m) {
        var e = state.bySlug[m.slug];
        return h("div", { class: "wer-mover" }, [h("div", { class: "wer-mover-delta " + (m.rank_change > 0 ? "wer-up" : "wer-down"), text: (m.rank_change > 0 ? "▲" : "▼") + Math.abs(m.rank_change) }),
          h("div", {}, [h("a", { class: "wer-mover-name", href: countryUrl(e), onclick: function (ev) { if (PAGE !== "country") { ev.preventDefault(); openPanel(e); } } }, [(e.flag || "") + " " + m.name]),
            h("span", { class: "wer-num", style: "margin-left:8px;font-size:13px;color:#7A8794", text: ord(m.prior_rank) + " → " + ord(m.rank) + " · " + m.gdp }),
            h("div", { class: "wer-mover-why", text: m.reason })])]);
      })));
    };
    section(el, "movers", "Climbers & Fallers", "The biggest moves in rank, with what drove them: real growth, or the dollar value of output.", [
      h("div", { class: "wer-movers" }, [col("Climbers", F.climbers), col("Fallers", F.fallers)]), h("p", { class: "wer-note", text: F.movement_note })]);
  }

  // ------------------------------------------------------------ full rankings table
  var COLS = [
    { k: "rank", label: "Rank", get: function (e) { return e.rank; }, td: function (e) { return String(e.rank); }, asc: true },
    { k: "rank_change", label: "Move", get: function (e) { return e.rank_change; }, td: function (e) { return delta(e.rank_change); } },
    { k: "name", label: "Economy", get: function (e) { return e.name; }, td: function (e) { return h("span", {}, [h("span", { class: "wer-flag", "aria-hidden": "true", text: e.flag || "" }), e.name]); }, left: true, asc: true },
    { k: "gdp", label: "GDP", get: function (e) { return e.gdp; }, td: function (e) { return money(e.gdp); } },
    { k: "share_world", label: "Share", get: function (e) { return e.share_world; }, td: function (e) { return shareOf(e.share_world); } },
    { k: "growth", label: "Growth", get: function (e) { return e.growth; }, td: function (e) { return cell(e, "growth", pct(e.growth, 1, true)); } },
    { k: "gdp_pc", label: "Per capita", get: function (e) { return e.gdp_pc; }, td: function (e) { return cell(e, "gdp_pc", e.gdp_pc != null ? "$" + int(e.gdp_pc) : null); } },
    { k: "gdp_pc_ppp", label: "PPP p.c.", get: function (e) { return e.gdp_pc_ppp; }, td: function (e) { return cell(e, "gdp_pc_ppp", e.gdp_pc_ppp != null ? "$" + int(e.gdp_pc_ppp) : null); } },
    { k: "population", label: "Population", get: function (e) { return e.population; }, td: function (e) { return cell(e, "population", people(e.population)); } },
    { k: "spark", label: "GDP, 10 yrs", get: null, td: function (e) { return sparkline(e); } }
  ];
  function renderTable(el) {
    var regions = uniq(state.E.map(function (e) { return e.region; })), incomes = ["High income", "Upper middle income", "Lower middle income", "Low income"];
    var search = h("input", { class: "wer-input", type: "search", placeholder: "Search economies", "aria-label": "Search economies" });
    var reg = h("select", { class: "wer-select", "aria-label": "Filter by region" }, [h("option", { value: "", text: "All regions" })].concat(regions.map(function (r) { return h("option", { value: r, text: r }); })));
    var inc = h("select", { class: "wer-select", "aria-label": "Filter by income group" }, [h("option", { value: "", text: "All income groups" })].concat(incomes.map(function (r) { return h("option", { value: r, text: r }); })));
    var jump = h("input", { class: "wer-input", type: "number", min: "1", max: String(state.E.length), placeholder: "Jump to rank #", "aria-label": "Jump to rank", style: "min-width:150px;width:150px" });
    var count = h("span", { class: "wer-table-count", "aria-live": "polite" });
    var tbody = h("tbody");
    var more = h("button", { class: "wer-btn", style: "margin-top:12px;display:none", onclick: function () { state.showAll = true; draw(); } });
    var sort = { k: "rank", dir: 1 };
    var ths = COLS.map(function (c) {
      var th = h("th", { scope: "col", class: c.left ? "wer-l" : null, "aria-sort": c.get ? (c.k === "rank" ? "ascending" : "none") : null });
      if (c.get) th.appendChild(h("button", { onclick: function () { sort.dir = sort.k === c.k ? -sort.dir : (c.asc ? 1 : -1); sort.k = c.k; draw(); } }, [c.label])); else th.appendChild(h("span", { style: "display:block;padding:11px 12px", text: c.label }));
      return th;
    });
    var table = h("table", { class: "wer-table" }, [h("caption", { class: "wer-sr", text: "All " + state.E.length + " economies ranked by " + state.Y + " GDP (current US$). Select a row for details." }), h("thead", {}, [h("tr", {}, ths)]), tbody]);
    function draw() {
      var s = search.value.trim().toLowerCase(), r = reg.value, ic = inc.value, col = COLS.filter(function (c) { return c.k === sort.k; })[0];
      var rows = state.E.filter(function (e) { return (!s || e.name.toLowerCase().indexOf(s) >= 0 || e.iso3.toLowerCase() === s) && (!r || e.region === r) && (!ic || e.income_group === ic); });
      rows.sort(function (a, b) { var x = col.get(a), y = col.get(b); if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
      ths.forEach(function (th, i) { if (COLS[i].get) th.setAttribute("aria-sort", COLS[i].k === sort.k ? (sort.dir > 0 ? "ascending" : "descending") : "none"); });
      tbody.innerHTML = "";
      var frag = document.createDocumentFragment(), cap = innerWidth < 640 && !state.showAll && !s && !r && !ic ? 25 : rows.length;
      more.style.display = cap < rows.length ? "" : "none"; more.textContent = "Show all " + rows.length + " economies";
      rows.slice(0, cap).forEach(function (e) {
        var tr = h("tr", { tabindex: "0", id: "rank-" + e.rank, "aria-label": e.name + ", rank " + e.rank, onclick: function () { openPanel(e); }, onkeydown: function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openPanel(e); } } });
        COLS.forEach(function (c) { var v = c.td(e); tr.appendChild(h("td", { class: (c.left ? "wer-l " : "") + (c.k !== "name" ? "wer-n" : ""), "data-k": c.k, "data-label": c.label }, [v])); });
        frag.appendChild(tr);
      });
      tbody.appendChild(frag);
      count.textContent = rows.length + " of " + state.E.length + " economies";
      if (!rows.length) {
        var u = s ? unrankedMatch(s) : null;
        tbody.appendChild(h("tr", { class: "wer-empty" }, [h("td", { colspan: String(COLS.length), class: "wer-l", style: "white-space:normal;padding:18px 14px",
          text: u ? u.name + " isn't ranked in the " + EDITION + " Edition. " + unrankedReason() : "No economies match." })]));
      }
    }
    [search, reg, inc].forEach(function (x) { x.addEventListener("input", draw); });
    jump.addEventListener("keydown", function (ev) { if (ev.key === "Enter") jumpTo(+jump.value); });
    state.jumpReset = function () { search.value = ""; reg.value = ""; inc.value = ""; sort = { k: "rank", dir: 1 }; draw(); };
    section(el, "rankings", "The Full Rankings", "All " + state.E.length + " economies by " + state.Y + " GDP in current U.S. dollars. Sort any column, filter by region or income group, or jump to a rank.", [
      h("div", { class: "wer-table-tools" }, [search, reg, inc, jump, count]), h("div", { class: "wer-table-wrap" }, [table]), more]);
    draw();
  }
  function jumpTo(n) {
    if (!n || n < 1 || n > state.E.length) return;
    state.showAll = true; if (state.jumpReset) state.jumpReset();
    var tr = document.getElementById("rank-" + n); if (!tr) return;
    [].forEach.call(document.querySelectorAll(".wer-table tr.is-hit"), function (x) { x.classList.remove("is-hit"); });
    tr.classList.add("is-hit"); tr.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" }); tr.focus({ preventScroll: true });
  }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }).sort(); }

  // ------------------------------------------------------------ compare
  function addCompare(slug) {
    if (!state.bySlug[slug] || state.compare.indexOf(slug) >= 0) return;
    if (state.compare.length >= 4) state.compare.shift();
    state.compare.push(slug); syncCompare();
  }
  function removeCompare(slug) { state.compare = state.compare.filter(function (s) { return s !== slug; }); syncCompare(); }
  function syncCompare() { setQ("compare", state.compare.join(",") || null); if (state.globe) state.globe.arcs(state.compare); if (state.drawCompare) state.drawCompare(); }
  function renderCompare(el) {
    var list = h("datalist", { id: "wer-econ-list" }, state.E.map(function (e) { return h("option", { value: e.name }); }));
    var input = h("input", { class: "wer-input", list: "wer-econ-list", placeholder: "Add an economy…", "aria-label": "Add an economy to compare" });
    input.addEventListener("change", function () { var e = state.E.filter(function (x) { return x.name.toLowerCase() === input.value.trim().toLowerCase(); })[0]; if (e) { addCompare(e.slug); input.value = ""; } });
    var pickBtn = h("button", { class: "wer-btn", "aria-pressed": "false", onclick: function () { state.picking = !state.picking; pickBtn.setAttribute("aria-pressed", state.picking); pickBtn.textContent = state.picking ? "Picking on the map… (click to stop)" : "Pick on the map"; if (state.picking) scrollToMount("globe"); } }, ["Pick on the map"]);
    var chips = h("div", { class: "wer-compare-pick" }), body = h("div");
    var share = h("button", { class: "wer-btn wer-btn-sm", onclick: function (ev) { copy(location.href, ev.target); } }, ["Copy link"]);
    section(el, "compare", "Compare Economies", "Choose up to four. Every comparison has its own link.", [h("div", { class: "wer-compare-pick" }, [input, list, pickBtn, share]), chips, body]);
    state.drawCompare = function () {
      chips.innerHTML = ""; body.innerHTML = "";
      var S = state.compare.map(function (s) { return state.bySlug[s]; });
      S.forEach(function (e, i) { chips.appendChild(h("span", { class: "wer-chip" }, [h("i", { style: "background:" + PALETTE[i] }), e.name, h("button", { "aria-label": "Remove " + e.name, onclick: function () { removeCompare(e.slug); } }, ["✕"])])); });
      if (S.length < 2) { body.appendChild(h("p", { class: "wer-note", text: S.length ? "Add one more economy to compare." : "Search above, or click any economy in the map or table, then choose Compare." })); return; }
      body.appendChild(h("ul", { class: "wer-compare-lines" }, compareLines(S).map(function (t) { return h("li", { text: t }); })));
      body.appendChild(h("div", { class: "wer-compare-cards" }, S.map(function (e, i) {
        var rows = [["Rank", "#" + e.rank], ["GDP", money(e.gdp)], ["Share of world", shareOf(e.share_world)], ["Growth", pct(e.growth, 1, true)], ["Per capita", e.gdp_pc != null ? "$" + int(e.gdp_pc) : null],
          ["PPP per capita", e.gdp_pc_ppp != null ? "$" + int(e.gdp_pc_ppp) : null], ["Population", people(e.population)], ["Inflation", pct(e.inflation)], ["Debt % GDP", pct(e.debt_pct_gdp, 0)],
          ["Rank by edition", Object.keys(e.rank_history || {}).map(function (y) { return y + ": #" + e.rank_history[y]; }).join(" · ")]];
        return h("div", { class: "wer-compare-card", style: "border-top:3px solid " + PALETTE[i] }, [h("h4", {}, [h("a", { href: countryUrl(e) }, [(e.flag || "") + " " + e.name])]),
          h("dl", {}, [].concat.apply([], rows.map(function (r) { return [h("dt", { text: r[0] }), h("dd", { text: r[1] == null ? "—" : r[1] })]; })))]);
      })));
      body.appendChild(h("p", { class: "wer-chart-title", text: "GDP, 2000 to " + state.FY + " (current US$, log scale; dashed = IMF forecast)" }));
      var series = S.map(function (e, i) { return { name: e.name, color: PALETTE[i], points: historyPoints(e, true) }; });
      body.appendChild(lineChart(series, { split: state.Y, title: "GDP history and IMF forecast", desc: S.map(function (e) { return e.name + " " + money(e.gdp); }).join(", ") }));
      var yrs = [2000, 2010, state.Y, state.FY];
      body.appendChild(srTable("GDP by year (current US$)", ["Economy"].concat(yrs.map(String)), S.map(function (e) { var p = {}; historyPoints(e, true).forEach(function (x) { p[x[0]] = x[1]; }); return [e.name].concat(yrs.map(function (y) { return money(p[y]); })); })));
    };
    var pre = (q("compare") || "").split(",").filter(Boolean); pre.forEach(addCompare);
    state.drawCompare();
  }
  function compareLines(S) {
    var out = [], a = S[0];
    S.slice(1).forEach(function (b) {
      var big = a.gdp >= b.gdp ? a : b, sm = big === a ? b : a, r = big.gdp / sm.gdp;
      var s = r < 1.05 ? big.name + " and " + sm.name + " are almost the same size: " + money(big.gdp) + " vs " + money(sm.gdp) + "."
        : big.name + "'s economy is " + ratio(r) + "× larger than " + sm.name + "'s.";
      if (big.gdp_pc && sm.gdp_pc) {
        var hi = big.gdp_pc >= sm.gdp_pc ? big : sm, lo = hi === big ? sm : big, pr = hi.gdp_pc / lo.gdp_pc;
        if (pr < 1.05) s += " Per person, output is about equal.";
        else if (hi === big) s += " Per person, the gap is " + ratio(pr) + "×.";
        else s += " But per person, " + hi.name + " produces " + ratio(pr) + "× more.";
      }
      out.push(s);
    });
    return out;
  }

  // ------------------------------------------------------------ neighbors, regions, archive
  function setNeighbors(slug) { state.neighbor = slug; if (state.drawNeighbors) state.drawNeighbors(); }
  function renderNeighbors(el) {
    var sel = h("select", { class: "wer-select", "aria-label": "Choose an economy" }, state.E.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (e) { return h("option", { value: e.slug, text: e.name }); }));
    sel.addEventListener("change", function () { setNeighbors(sel.value); });
    var rnd = h("button", { class: "wer-btn", onclick: function () { setNeighbors(state.E[Math.floor(Math.random() * state.E.length)].slug); } }, ["Random economy"]);
    var list = h("ol", { class: "wer-neighbors-list", "aria-live": "polite" });
    state.drawNeighbors = function () {
      var e = state.bySlug[state.neighbor] || state.E[0]; sel.value = e.slug; list.innerHTML = "";
      state.E.slice(Math.max(0, e.rank - 6), Math.min(state.E.length, e.rank + 5)).forEach(function (x) {
        list.appendChild(h("li", { class: x === e ? "is-self" : null, tabindex: "0", onclick: function () { if (x !== e) setNeighbors(x.slug); else openPanel(x); }, onkeydown: function (ev) { if (ev.key === "Enter") (x !== e ? setNeighbors(x.slug) : openPanel(x)); } },
          [h("span", { class: "wer-num", text: "#" + x.rank }), h("span", { text: (x.flag || "") + " " + x.name }), h("span", { class: "wer-num", text: money(x.gdp) })]));
      });
    };
    state.neighbor = state.neighbor || (state.bySlug["ghana"] ? "ghana" : state.E[70].slug);
    section(el, "neighbors", "Rank Neighbors", "Any economy, with the five just above and below it.", [h("div", { class: "wer-compare-pick" }, [sel, rnd]), list]);
    state.drawNeighbors();
  }
  function renderRegions(el) {
    var W = state.ed.world.gdp, regions = uniq(state.E.map(function (e) { return e.region; }));
    regions.sort(function (a, b) { return sum(b) - sum(a); });
    function sum(r) { return state.E.filter(function (e) { return e.region === r; }).reduce(function (s, e) { return s + e.gdp; }, 0); }
    section(el, "regions", "Region Leaderboards", "The five largest economies in each World Bank region.", [h("div", { class: "wer-regions" }, regions.map(function (r) {
      var es = state.E.filter(function (e) { return e.region === r; });
      return h("div", { class: "wer-region" }, [h("h4", { text: r }), h("div", { class: "wer-region-share", text: es.length + " economies · " + pct(sum(r) / W * 100, 1) + " of world GDP" }),
        h("ol", {}, es.slice(0, 5).map(function (e) { return h("li", { tabindex: "0", onclick: function () { openPanel(e); }, onkeydown: function (ev) { if (ev.key === "Enter") openPanel(e); } }, [h("span", { text: (e.flag || "") + " " + e.name }), h("span", { class: "wer-num", text: "#" + e.rank + " · " + money(e.gdp) })]); }))]);
    }))]);
  }
  function renderArchive(el) {
    section(el, "editions", "Past Editions", "Every edition is frozen as published, with its own data file.", [h("div", { class: "wer-archive" }, state.editions.map(function (x, i) {
      return h("a", { class: "wer-archive-item", href: SITE + "/world-economies-report/" + x.year }, [h("div", { class: "wer-archive-year", text: String(x.year) }),
        h("div", { class: "wer-archive-tag", text: (i === state.editions.length - 1 ? "Inaugural Edition" : "Edition") + " · " + x.data_year + " data" }), h("div", { text: x.headline || "" })]);
    }))]);
  }

  // ------------------------------------------------------------ methodology, sources, footer
  function renderMethods(el) {
    var src = (state.sources || []), dates = src.map(function (s) { return s.retrieved; }).filter(Boolean).sort();
    var first = dates[0] ? new Date(dates[0]).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";
    var un = state.ed.universe_notes || {}, imf = (un.filled_from_imf || []).length, ex = un.excluded_no_gdp || [];
    var blocks = [
      ["What is ranked", "Every economy in the World Bank's World Development Indicators with a " + state.Y + " GDP value, plus economies whose " + state.Y + " GDP is missing in WDI but published in the " + state.ed.imf_weo + " (" + imf + " this edition, including Taiwan, which WDI does not cover). " + state.E.length + " economies in total. " + ex.length + " economies with no " + state.Y + " GDP in either source are not ranked: " + ex.map(function (x) { return x.replace(/^[A-Z]{3} /, ""); }).join(", ") + "."],
      ["Nominal vs. PPP", "Rankings use GDP in current U.S. dollars at market exchange rates (nominal GDP), the standard measure of an economy's size in the world economy. Purchasing-power-parity (PPP) figures adjust for price differences between countries and are shown per person. Rankings differ between sources because of exchange-rate conventions, revision timing and estimates for the latest year."],
      ["Movement", state.findings ? state.findings.movement_note : ""],
      ["Data year and retrieval", "Figures are for calendar year " + state.Y + ". Sources were retrieved on " + first + ". Each value's source is recorded in the data file. Missing values show “—” with the reason."],
      ["Sectors", "Agriculture, industry and services are World Bank value added as a share of GDP, for the latest year at or before " + state.Y + " (year shown). Manufacturing is a subset of industry. Shares need not sum to 100%: value added is measured at basic prices and GDP at market prices, so taxes and subsidies on products sit outside the three sectors. Shares that are placeholders or sum below 60% are withheld."],
      ["U.S. size equivalents", "The U.S. state (BEA, " + state.Y + ") or metropolitan area with the closest GDP. BEA no longer publishes metro GDP through its API, so metro GDP is the sum of BEA county GDP (latest year available, shown) across each OMB metropolitan statistical area (July 2023 delineation)."],
      ["Methodology changes", state.editions.length === 1 ? "None: this is the inaugural edition." : (state.editionMeta && state.editionMeta.methodology_changes) || "None."],
      ["Revisions", "Sources revise past figures. Each edition is frozen as published: archived editions show the data as it stood at release, so figures for the same year can differ between editions."],
      ["Territories and names", "Economy names follow World Bank usage, with common short forms. Boundaries on the map come from Natural Earth and do not imply any judgment on the legal status of a territory. Taiwan is listed separately as in IMF data; West Bank and Gaza and Kosovo follow World Bank coverage."]
    ];
    var list = [["World Bank, World Development Indicators", "https://data.worldbank.org/"], ["IMF, " + state.ed.imf_weo + " (DataMapper)", "https://www.imf.org/external/datamapper/"],
      ["U.S. Bureau of Economic Analysis, Regional Accounts (state and county GDP)", "https://apps.bea.gov/regional/"], ["U.S. Census Bureau / OMB, Metropolitan delineation files (July 2023)", "https://www.census.gov/geographies/reference-files/time-series/demo/metro-micro/delineation-files.html"],
      ["UN, World Population Prospects", "https://population.un.org/wpp/"], ["Natural Earth via world-atlas (TopoJSON boundaries)", "https://github.com/topojson/world-atlas"], ["mledoze/countries (flags, currencies; ODbL)", "https://github.com/mledoze/countries"]];
    section(el, "methodology", "Methodology & Sources", null, [h("div", { class: "wer-methods" }, blocks.map(function (b) { return h("div", {}, [h("h4", { text: b[0] }), h("p", { text: b[1] })]); })),
      h("h4", { class: "wer-chart-title", text: "Sources" }), h("ol", { class: "wer-sources" }, list.map(function (s) { return h("li", {}, [h("a", { href: s[1], rel: "noopener", target: "_blank", text: s[0] })]); }))]);
  }
  function renderFooter(el) {
    var d = new Date(state.ed.generated).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    el.innerHTML = ""; el.appendChild(h("div", { class: "wer-wrap" }, [h("div", { class: "wer-footer-line" }, [
      h("div", {}, [h("div", { text: "A Colaeb Annual Report · " + EDITION + " Edition · Data compiled " + d }), h("div", { text: "Next edition expected " + (state.ed.next_edition_expected || "") })]),
      h("div", { class: "wer-actions", style: "margin:0" }, [h("a", { class: "wer-btn", href: SITE + "/", text: "Join the Colaeb network" }), h("a", { class: "wer-btn wer-btn-accent", href: SITE + "/capital", text: "Explore Colaeb Capital" })])])]));
  }

  // ------------------------------------------------------------ country page
  function renderCountry(el) {
    var slug = CFG.slug || PATH.split("/").pop(), e = state.bySlug[slug];
    if (!e) { el.innerHTML = "<div class='wer-wrap'><p>Economy not found in the " + EDITION + " Edition.</p></div>"; return; }
    document.title = document.title || e.name + " economy " + EDITION;
    var mini = h("div", { class: "wer-mini-globe" });
    var hero = h("div", { class: "wer-country-hero" }, [h("div", {}, [h("p", { class: "wer-kicker", text: "World Ranking of Economies · " + EDITION + " Edition" }),
      h("div", { class: "wer-country-flag", "aria-hidden": "true", text: e.flag || "" }), h("h1", { class: "wer-title", text: e.name }),
      h("div", { class: "wer-country-rank" }, ["#" + e.rank + " of " + state.E.length + " by GDP · ", delta(e.rank_change), " since " + (state.Y - 1) + " · " + e.region + " · " + (e.income_group || "")])]), mini]);
    var stats = [["GDP (" + state.Y + ")", moneyLong(e.gdp), "gdp"], ["Share of world GDP", shareOf(e.share_world)], ["Real GDP growth", pct(e.growth, 1, true), "growth"],
      ["GDP per capita", e.gdp_pc != null ? "US$" + int(e.gdp_pc) : null, "gdp_pc"], ["PPP per capita", e.gdp_pc_ppp != null ? "$" + int(e.gdp_pc_ppp) + (e.gdp_pc_ppp_rank ? " (#" + e.gdp_pc_ppp_rank + ")" : "") : null, "gdp_pc_ppp"],
      ["Population", people(e.population), "population"], ["Inflation", pct(e.inflation), "inflation"], ["Unemployment", pct(e.unemployment), "unemployment"], ["Gov. debt % of GDP", pct(e.debt_pct_gdp, 1), "debt_pct_gdp"],
      ["Capital", e.capital], ["Currency", e.currency]].concat((e.sectors || []).map(function (s) { return [s.sector + " (" + s.year + ")", pct(s.share)]; }))
      .concat(e.manufacturing_pct != null ? [["Manufacturing (" + e.manufacturing_year + ")", pct(e.manufacturing_pct)]] : []);
    if (!(e.sectors || []).length) stats.push(["Sectors", null, "sectors"]);
    var grid = h("div", { class: "wer-stat-grid" }, stats.map(function (s) { return h("div", {}, [h("div", { class: "wer-stat-label", text: s[0] }), h("div", { class: "wer-stat-value", style: "font-size:19px" }, [cell(e, s[2], s[1])])]); }));
    var pts = historyPoints(e, true);
    var chart = [h("p", { class: "wer-chart-title", text: "GDP, 2000 to " + state.FY + " (current US$; dashed = IMF forecast)" }), lineChart([{ name: e.name, color: PALETTE[0], points: pts }], { split: state.Y, log: false, title: e.name + " GDP history and forecast" }),
      srTable(e.name + " GDP by year", ["Year", "GDP (US$)"], pts.map(function (p) { return [p[0], money(p[1])]; }))];
    var timeline = h("ol", { class: "wer-neighbors-list" }, Object.keys(e.rank_history || {}).map(function (y) { return h("li", {}, [h("span", { class: "wer-num", text: y }), h("span", { text: y + " Edition" }), h("span", { class: "wer-num", text: "#" + e.rank_history[y] })]); }));
    var near = state.E.slice(Math.max(0, e.rank - 6), Math.min(state.E.length, e.rank + 5));
    var nlist = h("ol", { class: "wer-neighbors-list" }, near.map(function (x) { return h("li", { class: x === e ? "is-self" : null }, [h("span", { class: "wer-num", text: "#" + x.rank }), x === e ? h("span", { text: x.name }) : h("a", { href: countryUrl(x), text: (x.flag || "") + " " + x.name }), h("span", { class: "wer-num", text: money(x.gdp) })]); }));
    var regTop = state.E.filter(function (x) { return x.region === e.region && x !== e; })[0], nearest = state.E[e.rank] && state.E[e.rank - 2] ? (Math.abs(state.E[e.rank].gdp - e.gdp) < Math.abs(state.E[e.rank - 2].gdp - e.gdp) ? state.E[e.rank] : state.E[e.rank - 2]) : (state.E[e.rank] || state.E[e.rank - 2]);
    var presets = [regTop && ["Largest in " + e.region + ": " + regTop.name, regTop], e.iso3 !== "USA" && ["United States", state.by.USA], nearest && ["Nearest-ranked: " + nearest.name, nearest]].filter(Boolean)
      .map(function (p) { return h("a", { class: "wer-btn", href: SITE + "/world-economies?compare=" + e.slug + "," + p[1].slug + "#compare", text: "Compare with " + p[0] }); });
    var srcs = {}; Object.keys(e.field_sources || {}).forEach(function (k) { srcs[e.field_sources[k]] = 1; });
    el.classList.add("wer-wrap"); el.innerHTML = "";
    [hero, grid,
      h("section", { class: "wer-section" }, [h("h2", { class: "wer-h2", text: "Profile" }), h("p", { class: "wer-profile", text: e.profile || "" }), e.size_equivalent ? h("p", { class: "wer-dek", text: e.size_equivalent.label + "." }) : null]),
      h("section", { class: "wer-section" }, [h("h2", { class: "wer-h2", text: "GDP history and outlook" })].concat(chart)),
      h("section", { class: "wer-section" }, [h("h2", { class: "wer-h2", text: "Rank by edition" }), timeline]),
      h("section", { class: "wer-section" }, [h("h2", { class: "wer-h2", text: "Rank neighbors" }), nlist]),
      h("section", { class: "wer-section" }, [h("h2", { class: "wer-h2", text: "Compare " + e.name + " with…" }), h("div", { class: "wer-presets" }, presets)]),
      h("section", { class: "wer-section" }, [h("h2", { class: "wer-h2", text: "Sources" }), h("p", { class: "wer-note", text: Object.keys(srcs).join(" · ") + ". " + (e.note || "") }),
        h("p", { class: "wer-note" }, [h("a", { href: SITE + "/world-economies#methodology", text: "Methodology" }), " · ", h("a", { href: SITE + "/world-economies", text: "Back to the " + EDITION + " rankings" })])])
    ].forEach(function (k) { el.appendChild(k); });
    onVisible(mini, function () { loadGeo().then(function (geo) { miniGlobe(mini, geo, e); }); });
  }
  function miniGlobe(box, geo, e) {
    var c = state.centroid[e.iso3] || { lat: 0, lng: 0 }, S = 320, proj = d3.geoOrthographic().scale(S / 2 - 4).translate([S / 2, S / 2]).rotate([-c.lng, -c.lat]), path = d3.geoPath(proj);
    var root = svg("svg", { viewBox: "0 0 " + S + " " + S, role: "img", "aria-label": "Globe centred on " + e.name });
    root.appendChild(svg("path", { d: path({ type: "Sphere" }), fill: "#F2EEE6", stroke: "#C9CED6" }));
    root.appendChild(svg("path", { d: path(d3.geoGraticule10()), fill: "none", stroke: "#E3DED3", "stroke-width": ".5" }));
    root.appendChild(svg("path", { d: path(geo.land), fill: "#D7D1C4" }));
    var f = geo.feats.filter(function (x) { return x.iso3 === e.iso3; })[0];
    if (f) root.appendChild(svg("path", { d: path(f), fill: "#DD7330", stroke: "#87390C", "stroke-width": ".6" }));
    else { var xy = proj([c.lng, c.lat]); if (xy) root.appendChild(svg("circle", { cx: xy[0], cy: xy[1], r: 6, fill: "#DD7330", stroke: "#fff", "stroke-width": "2" })); }
    box.appendChild(root);
  }

  // ------------------------------------------------------------ boot
  function boot() {
    if (document.querySelector('[data-wer="globe"],[data-wer="country"]')) fetchGeo().catch(function () {});
    var dataUrl = CFG.dataUrl || BASE + "/data/economies-" + EDITION + ".json";
    Promise.all([load(dataUrl), load(BASE + "/data/editions.json").catch(function () { return []; }), load(BASE + "/findings/" + EDITION + "/findings.json").catch(function () { return null; }),
      load(BASE + "/data/sources-" + EDITION + ".json").catch(function () { return null; })]).then(function (r) {
      var ed = r[0]; state.ed = ed; state.E = ed.economies.slice().sort(function (a, b) { return a.rank - b.rank; }); state.Y = ed.data_year;
      state.FY = state.E.reduce(function (m, e) { return Math.max(m, Math.max.apply(null, Object.keys(e.imf_forecast || {}).map(Number).concat([0]))); }, 0) || state.Y;
      state.E.forEach(function (e) { state.by[e.iso3] = e; state.bySlug[e.slug] = e; }); state.centroid = {};
      state.editions = (r[1].length ? r[1] : [{ year: +EDITION, data_year: ed.data_year, status: "current" }]).sort(function (a, b) { return b.year - a.year; });
      state.current = (state.editions.filter(function (x) { return x.status === "current"; })[0] || state.editions[0]).year;
      state.editionMeta = state.editions.filter(function (x) { return String(x.year) === EDITION; })[0] || {};
      state.findings = r[2]; state.sources = r[3] ? (r[3].sources || r[3]) : null;
      var m = q("metric"); state.metric = METRICS[m] ? m : "gdp"; state.scale = scaleFor(state.metric);
      var R = { masthead: renderMasthead, globe: renderGlobe, findings: renderFindings, movers: renderMovers, table: renderTable, compare: renderCompare, neighbors: renderNeighbors,
        regions: renderRegions, archive: renderArchive, methods: renderMethods, footer: renderFooter, country: renderCountry };
      [].forEach.call(document.querySelectorAll("[data-wer]"), function (el) { var f = R[el.getAttribute("data-wer")]; if (f) { el.classList.add("wer-page"); try { f(el); } catch (err) { console.error("[wer]", el.getAttribute("data-wer"), err); } } });
      try { seo(); } catch (err) { console.warn("[wer] seo", err); }
      if (/^#rank-\d+$/.test(location.hash)) jumpTo(+location.hash.slice(6));
      else if (location.hash === "#compare") scrollToMount("compare");
      document.documentElement.setAttribute("data-wer-ready", "1");
      document.documentElement.classList.remove("wer-loading");
    }).catch(function (err) { console.error("[wer] data load failed", err); [].forEach.call(document.querySelectorAll("[data-wer]"), function (el) { el.innerHTML = "<p style='padding:24px'>The report data could not be loaded. Please refresh.</p>"; }); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
