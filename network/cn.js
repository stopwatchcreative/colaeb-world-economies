/*! Colaeb Network: globe + directory of Colaeb members (companies, businesses and university partners). Built on the World Ranking of Economies globe.
 *
 * Mounts:  <div data-cn="globe"></div>   <div data-cn="directory"></div>
 * Stats:   <span data-cn-stat="businesses|countries|cities|industries"></span>
 * Data:    a Webflow Collection List inside [data-cn-source]. Each item (.w-dyn-item or [data-cn-item]) holds
 *          elements tagged data-cn-field="name|slug|type|industry|sector|city|country|lat|lng|city2|lat2|lng2|summary|website|logo|quote|quoteBy|featured|url"
 *          Members without a website appear on the map only (no directory card, no profile link).
 *          Text elements are read by their text, Link blocks by href, Images by src. Empty Webflow bindings are ignored.
 * Config:  window.CN_CONFIG = { vendor: "<url to /web/vendor>", hq: {name, lat, lng}, profileBase: "/network/" }
 */
(function () {
  "use strict";
  var CFG = window.CN_CONFIG || {};
  var VENDOR = (CFG.vendor || "https://cdn.jsdelivr.net/gh/stopwatchcreative/colaeb-world-economies@2c78576b41876866583230279c136dbed820865b/web/vendor").replace(/\/$/, "");
  var HQ = CFG.hq || { name: "Colaeb HQ", city: "Columbus, Ohio", lat: 39.9612, lng: -82.9988 };
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MAX_CHIPS = CFG.maxChips || 6; // more groups than this: top ones as chips, the rest in a "More" menu
  var TONES = ["#101828", "#465A69", "#B4520C", "#1F7A5A", "#3E4C8A", "#7A3E6B"];
  var LAND = "#CFC8BA", LAND_HIT = "#F2A46A";

  var state = { items: [], filter: { group: "all" }, active: null, globe: null };

  // ------------------------------------------------------------ helpers
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    for (var k in attrs || {}) {
      var v = attrs[k]; if (v == null || v === false) continue;
      if (k === "text") el.textContent = v; else if (k === "html") el.innerHTML = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? "" : v);
    }
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  function svg(tag, attrs) { var el = document.createElementNS("http://www.w3.org/2000/svg", tag); for (var k in attrs || {}) el.setAttribute(k, attrs[k]); return el; }
  function load(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); }); }
  var scripts = {};
  function script(src) {
    if (!scripts[src]) scripts[src] = new Promise(function (ok, bad) { var s = document.createElement("script"); s.src = src; s.async = false; s.onload = ok; s.onerror = function () { bad(new Error(src)); }; document.head.appendChild(s); });
    return scripts[src];
  }
  function slugify(s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function initials(name) { var w = String(name).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(function (x) { return !/^(of|the|and|&)$/i.test(x); }); return ((w[0] || "")[0] + ((w[1] || "")[0] || (w[0] || "")[1] || "")).toUpperCase(); }
  function tone(name) { var n = 0; for (var i = 0; i < name.length; i++) n = (n * 31 + name.charCodeAt(i)) >>> 0; return TONES[n % TONES.length]; }
  function host(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return url; } }
  function kicker(r) { var uni = /universit/i.test(r.type) || (/universit|college/i.test(r.name) && /education/i.test(r.industry)); return uni ? "University partner" : (r.industry || ""); }
  function plural(t) { return /y$/.test(t) ? t.slice(0, -1) + "ies" : t + "s"; }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function q(k) { try { return new URL(location.href).searchParams.get(k); } catch (e) { return null; } }
  function setQ(k, v) { try { var u = new URL(location.href); if (v) u.searchParams.set(k, v); else u.searchParams.delete(k); history.replaceState(null, "", u); } catch (e) {} }

  // ------------------------------------------------------------ data: read the Webflow Collection List
  function field(item, name) {
    var el = item.querySelector('[data-cn-field="' + name + '"]');
    if (!el || el.classList.contains("w-dyn-bind-empty") || el.classList.contains("w-condition-invisible")) return "";
    if (el.tagName === "IMG") { var src = el.getAttribute("src") || ""; return /placeholder|^data:/.test(src) ? "" : src; }
    if (el.tagName === "A") { var href = el.getAttribute("href") || ""; return href === "#" ? "" : href; }
    return (el.textContent || "").trim();
  }
  function readItems(root) {
    var seen = [], out = [];
    (root || document).querySelectorAll("[data-cn-source]").forEach(function (src) {
      src.querySelectorAll("[data-cn-item], .w-dyn-item").forEach(function (it) {
        if (seen.indexOf(it) > -1 || !it.querySelector('[data-cn-field="name"]')) return; seen.push(it);
        var f = function (n) { return field(it, n); };
        var name = f("name"); if (!name) return;
        var r = {
          name: name, slug: f("slug") || slugify(name), type: f("type") || "Client", industry: f("industry"),
          city: f("city"), country: f("country"), summary: f("summary"), website: f("website"), logo: f("logo"),
          quote: f("quote"), quoteBy: f("quoteBy"), featured: /^(true|yes|1)$/i.test(f("featured")), url: f("url"), points: []
        };
        var G = CFG.groups || {};
        r.group = f("sector") || G[r.industry] || (CFG.groups ? CFG.groupFallback || "Other" : r.industry) || "Other";
        if (!r.url && r.website && CFG.profileBase) r.url = CFG.profileBase.replace(/\/?$/, "/") + r.slug;
        var lat = num(f("lat")), lng = num(f("lng"));
        if (lat != null && lng != null) r.points.push({ r: r, lat: lat, lng: lng, city: r.city });
        var lat2 = num(f("lat2")), lng2 = num(f("lng2"));
        if (lat2 != null && lng2 != null) r.points.push({ r: r, lat: lat2, lng: lng2, city: f("city2") });
        r.place = [r.points.map(function (p) { return p.city; }).filter(Boolean).join(" · ") || r.city, r.country].filter(Boolean).join(", ");
        out.push(r);
      });
    });
    out.sort(function (a, b) { return (b.featured - a.featured) || a.name.localeCompare(b.name); });
    return out;
  }
  function visible() {
    var F = state.filter;
    return state.items.filter(function (r) { return F.group === "all" || r.group === F.group; });
  }
  function points(list) { var p = []; (list || visible()).forEach(function (r) { p = p.concat(r.points); }); return p; }

  // ------------------------------------------------------------ stats
  function paintStats() {
    var list = state.items, cities = {}, countries = {}, inds = {};
    list.forEach(function (r) {
      r.points.forEach(function (p) { if (p.city) cities[p.city.toLowerCase()] = 1; });
      if (r.country) countries[r.country.toLowerCase()] = 1; if (r.industry) inds[r.industry.toLowerCase()] = 1;
    });
    var v = { businesses: list.length, cities: Object.keys(cities).length, countries: Object.keys(countries).length, industries: Object.keys(inds).length };
    document.querySelectorAll("[data-cn-stat]").forEach(function (el) { var k = el.getAttribute("data-cn-stat"); if (k in v) el.textContent = v[k]; });
  }

  // ------------------------------------------------------------ logo / monogram
  function mark(r, size) {
    var box = h("span", { class: "cn-mark" + (size ? " cn-mark-" + size : ""), "aria-hidden": "true" });
    if (r.logo) { box.classList.add("has-logo"); box.appendChild(h("img", { src: r.logo, alt: "", loading: "lazy" })); }
    else { box.style.background = tone(r.name); box.textContent = initials(r.name); }
    return box;
  }

  // ------------------------------------------------------------ globe mount
  function renderGlobe(el) {
    state.teaser = el.getAttribute("data-cn-mode") === "teaser";
    el.classList.add("cn-hero"); if (state.teaser) el.classList.add("cn-teaser"); el.innerHTML = "";
    var controls = h("div", { class: "cn-controls" });
    var stage = h("div", { class: "cn-globe", role: "application", "aria-label": "Interactive globe of Colaeb members. Featured businesses with websites are also listed below." }, [h("div", { class: "cn-globe-loading", text: "Loading map…" })]);
    var panel = h("aside", { class: "cn-panel", "aria-live": "polite", hidden: true });
    stage.appendChild(panel);
    stage.appendChild(h("div", { class: "cn-key", "aria-hidden": "true" }, [h("span", { class: "cn-key-hq" }), "Colaeb HQ, Columbus", h("span", { class: "cn-key-pin" }), "Colaeb member"]));
    el.appendChild(state.teaser ? stage : h("div", { class: "cn-wrap" }, [controls, stage]));
    state.controls = state.teaser ? null : controls; state.stage = stage; state.panel = panel;
    paintControls();
    var small = q("globe") === "2d" || (q("globe") !== "3d" && (innerWidth < 760 || !webgl()));
    loadGeo().then(function (geo) {
      map2d(stage, geo);
      if (small) return;
      (window.requestIdleCallback || function (f) { setTimeout(f, 250); })(function () {
        script(VENDOR + "/globe.gl.min.js").then(function () { globe3d(stage, geo); }).catch(function (e) { console.warn("[cn] 3D globe unavailable, keeping flat map", e); });
      });
    }).catch(function (e) { var l = stage.querySelector(".cn-globe-loading"); if (l) l.textContent = "Map unavailable."; console.warn(e); });
  }
  function webgl() { try { var c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); } catch (e) { return false; } }
  var geoP;
  function loadGeo() {
    if (geoP) return geoP;
    geoP = Promise.all([script(VENDOR + "/topojson-client.min.js"), script(VENDOR + "/d3-array.min.js"), script(VENDOR + "/d3-geo.min.js"), load(VENDOR + "/countries-110m.json")]).then(function (r) {
      var topo = r[3], feats = topojson.feature(topo, topo.objects.countries).features.filter(function (f) { return f.id !== "010"; });
      return { feats: feats, land: topojson.feature(topo, topo.objects.land) };
    });
    return geoP;
  }
  function markHits(geo) {
    var pts = points();
    geo.feats.forEach(function (f) { f.hit = pts.some(function (p) { return d3.geoContains(f, [p.lng, p.lat]); }); });
  }
  var MAX_ARCS = 24; // past this, draw arcs only to the farthest distinct cities so the globe stays readable
  function arcsFor(pts) {
    var seen = {}, list = pts.filter(function (p) {
      var k = p.lat.toFixed(1) + "," + p.lng.toFixed(1);
      if (seen[k] || Math.abs(p.lat - HQ.lat) + Math.abs(p.lng - HQ.lng) < 0.6) return false;
      return (seen[k] = true);
    });
    if (list.length > MAX_ARCS) list = list.sort(function (a, b) { return d3.geoDistance([b.lng, b.lat], [HQ.lng, HQ.lat]) - d3.geoDistance([a.lng, a.lat], [HQ.lng, HQ.lat]); }).slice(0, MAX_ARCS);
    return list.map(function (p) { return { startLat: HQ.lat, startLng: HQ.lng, endLat: p.lat, endLng: p.lng, p: p }; });
  }

  function pinEl(d) {
    if (d.hq) {
      return h("div", { class: "cn-pin cn-pin-hq", title: HQ.name + " · " + HQ.city }, [h("span", { class: "cn-pin-dot" }), h("span", { class: "cn-pin-label", text: "Colaeb HQ" })]);
    }
    var b = h("button", { class: "cn-pin", type: "button", "data-slug": d.r.slug, "aria-label": d.r.name + (d.city ? ", " + d.city : "") }, [h("span", { class: "cn-pin-dot" }), h("span", { class: "cn-pin-label", text: d.r.name })]);
    b.style.pointerEvents = "auto";
    b.addEventListener("click", function (ev) { ev.stopPropagation(); pick(d.r, d); });
    b.addEventListener("pointerdown", function (ev) { ev.stopPropagation(); });
    return b;
  }

  function globe3d(stage, geo) {
    var flat = stage.querySelector(".cn-map2d");
    var holder = h("div", { class: "cn-globe-3d" }); stage.insertBefore(holder, stage.firstChild);
    markHits(geo);
    var hq = { hq: true, lat: HQ.lat, lng: HQ.lng };
    var g = Globe({ animateIn: !REDUCED })(holder)
      .width(holder.clientWidth).height(holder.clientHeight).backgroundColor("rgba(0,0,0,0)")
      .showAtmosphere(true).atmosphereColor("#F5BC86").atmosphereAltitude(0.14)
      .hexPolygonsData(geo.feats).hexPolygonResolution(3).hexPolygonMargin(0.42).hexPolygonUseDots(true).hexPolygonAltitude(0.006)
      .hexPolygonColor(function (f) { return f.hit ? LAND_HIT : LAND; })
      .htmlElementsData(points().concat([hq])).htmlLat("lat").htmlLng("lng").htmlAltitude(0.02).htmlElement(pinEl)
      .ringsData(points()).ringLat("lat").ringLng("lng").ringColor(function () { return function (t) { return "rgba(243,122,35," + (1 - t) * 0.8 + ")"; }; })
      .ringMaxRadius(3.2).ringPropagationSpeed(1.4).ringRepeatPeriod(REDUCED ? 0 : 2200)
      .arcsData(arcsFor(points())).arcColor(function () { return ["rgba(16,24,40,.85)", "rgba(243,122,35,.95)"]; })
      .arcStroke(0.45).arcDashLength(0.45).arcDashGap(0.2).arcDashInitialGap(function () { return Math.random(); })
      .arcDashAnimateTime(REDUCED ? 0 : 3200).arcAltitudeAutoScale(0.42);
    var mat = g.globeMaterial(); mat.color.set("#F2EEE6"); if (mat.emissive) mat.emissive.set("#E9E3D7");
    var c = g.controls(); c.autoRotate = !REDUCED; c.autoRotateSpeed = 0.35; c.enableZoom = true;
    holder.addEventListener("pointerdown", function () { c.autoRotate = false; });
    g.pointOfView({ lat: 38, lng: -40, altitude: 2.1 });
    new ResizeObserver(function () { g.width(holder.clientWidth).height(holder.clientHeight); }).observe(holder);
    if (flat) flat.remove(); holder.classList.add("is-in");
    var l = stage.querySelector(".cn-globe-loading"); if (l) l.remove();
    state.globe = {
      refresh: function () {
        markHits(geo); var p = points();
        g.hexPolygonColor(function (f) { return f.hit ? LAND_HIT : LAND; }).htmlElementsData(p.concat([hq])).ringsData(p).arcsData(arcsFor(p));
        syncPins();
      },
      flyTo: function (p) { c.autoRotate = false; g.pointOfView({ lat: p.lat - 3, lng: p.lng + (holder.clientWidth > 760 ? 16 : 0), altitude: 1.45 }, REDUCED ? 0 : 1200); }
    };
    syncPins();
  }

  function map2d(stage, geo) {
    var W = 960, H = 500, proj = d3.geoEqualEarth().fitSize([W, H], { type: "Sphere" }), path = d3.geoPath(proj);
    var root = svg("svg", { class: "cn-map2d", viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "World map of Colaeb members" });
    root.appendChild(svg("path", { d: path({ type: "Sphere" }), fill: "#F2EEE6" }));
    var countries = svg("g", {}), arcs = svg("g", { class: "cn-arcs" }), pins = svg("g", {});
    root.appendChild(countries); root.appendChild(arcs); root.appendChild(pins);
    geo.feats.forEach(function (f) { var p = svg("path", { d: path(f) || "" }); f.el2d = p; countries.appendChild(p); });
    function draw() {
      markHits(geo);
      geo.feats.forEach(function (f) { f.el2d.setAttribute("fill", f.hit ? LAND_HIT : LAND); });
      arcs.innerHTML = ""; pins.innerHTML = "";
      arcsFor(points()).forEach(function (a) { arcs.appendChild(svg("path", { d: path({ type: "LineString", coordinates: [[a.startLng, a.startLat], [a.endLng, a.endLat]] }) })); });
      var hq = proj([HQ.lng, HQ.lat]);
      pins.appendChild(svg("rect", { x: hq[0] - 4.5, y: hq[1] - 4.5, width: 9, height: 9, transform: "rotate(45 " + hq[0] + " " + hq[1] + ")", class: "cn-hq2d" }));
      points().forEach(function (d) {
        var xy = proj([d.lng, d.lat]); if (!xy) return;
        var c = svg("circle", { cx: xy[0], cy: xy[1], r: 5.5, class: "cn-pin2d", tabindex: "0", role: "button", "aria-label": d.r.name + (d.city ? ", " + d.city : ""), "data-slug": d.r.slug });
        var t = svg("title", {}); t.textContent = d.r.name + (d.city ? " · " + d.city : ""); c.appendChild(t);
        c.addEventListener("click", function () { pick(d.r, d); });
        c.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(d.r, d); } });
        pins.appendChild(c);
      });
      syncPins();
    }
    var l = stage.querySelector(".cn-globe-loading"); if (l) l.remove();
    stage.insertBefore(root, stage.firstChild);
    state.globe = { refresh: draw, flyTo: function () {} };
    draw();
  }

  function syncPins() {
    var s = state.active && state.active.slug;
    document.querySelectorAll(".cn-pin[data-slug], .cn-pin2d").forEach(function (p) { p.classList.toggle("is-active", p.getAttribute("data-slug") === s); });
    document.querySelectorAll(".cn-card").forEach(function (p) { p.classList.toggle("is-active", p.getAttribute("data-slug") === s); });
  }

  // ------------------------------------------------------------ controls (shared by globe + directory)
  function paintControls() {
    var box = state.controls; if (!box) return;
    box.innerHTML = "";
    var counts = {}; state.items.forEach(function (r) { counts[r.group] = (counts[r.group] || 0) + 1; });
    var groups = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });
    var chipGroups = groups.length > MAX_CHIPS ? groups.slice(0, MAX_CHIPS - 1) : groups, more = groups.slice(chipGroups.length);
    var chips = h("div", { class: "cn-chips", role: "group", "aria-label": "Filter by industry" });
    function chip(val, label, n) {
      chips.appendChild(h("button", { class: "cn-chip", type: "button", "aria-pressed": String(state.filter.group === val), onclick: function () { setFilter("group", val); } }, [label, h("span", { class: "cn-chip-n", text: String(n) })]));
    }
    chip("all", "All", state.items.length);
    chipGroups.forEach(function (g) { chip(g, g, counts[g]); });
    box.appendChild(chips);
    if (more.length) {
      var sel = h("select", { class: "cn-select", "aria-label": "More industries", onchange: function (e) { setFilter("group", e.target.value || "all"); } }, [h("option", { value: "", text: "More industries" })]);
      more.forEach(function (g) { var o = h("option", { value: g, text: g + " (" + counts[g] + ")" }); if (state.filter.group === g) o.selected = true; sel.appendChild(o); });
      chips.appendChild(sel);
    }
    var n = visible().length, word = function (k) { return k === 1 ? " member" : " members"; };
    box.appendChild(h("p", { class: "cn-count", "aria-live": "polite", text: n === state.items.length ? n + word(n) + " on the map" : n + " of " + state.items.length + " members" }));
  }
  function setFilter(k, v) {
    state.filter[k] = v; state.showAll = false;
    if (state.active && visible().indexOf(state.active) < 0) closePanel();
    paintControls(); if (state.globe) state.globe.refresh(); paintDirectory();
  }

  // ------------------------------------------------------------ panel
  function pick(r, p) {
    if (state.teaser) { location.href = (CFG.networkUrl || "/network") + "?member=" + encodeURIComponent(r.slug); return; }
    state.active = r; setQ("member", r.slug);
    var panel = state.panel; if (!panel) return;
    panel.innerHTML = ""; panel.hidden = false;
    var actions = h("div", { class: "cn-actions" });
    if (r.website) actions.appendChild(h("a", { class: "cn-btn cn-btn-accent", href: r.website, target: "_blank", rel: "noopener" }, ["Visit " + host(r.website) + " ↗"]));
    if (r.url) actions.appendChild(h("a", { class: "cn-btn", href: r.url }, ["View profile"]));
    panel.appendChild(h("button", { class: "cn-close", type: "button", "aria-label": "Close", onclick: closePanel, html: "&times;" }));
    panel.appendChild(h("div", { class: "cn-panel-head" }, [mark(r, "lg"), h("div", {}, [
      h("p", { class: "cn-kicker", text: kicker(r) }),
      h("h3", { class: "cn-panel-name", text: r.name }),
      h("p", { class: "cn-place", text: r.place })
    ])]));
    if (r.summary) panel.appendChild(h("p", { class: "cn-summary", text: r.summary }));
    if (r.quote) panel.appendChild(h("blockquote", { class: "cn-quote" }, [h("p", { text: "“" + r.quote.replace(/^["“]|["”]$/g, "") + "”" }), r.quoteBy ? h("cite", { text: r.quoteBy }) : null]));
    panel.appendChild(actions);
    if (state.globe) state.globe.flyTo(p || r.points[0] || HQ);
    syncPins();
  }
  function closePanel() { state.active = null; setQ("member", null); if (state.panel) { state.panel.hidden = true; state.panel.innerHTML = ""; } syncPins(); }

  // ------------------------------------------------------------ directory
  function renderDirectory(el) { el.classList.add("cn-directory"); state.dir = el; paintDirectory(); }
  function paintDirectory() {
    var el = state.dir; if (!el) return;
    el.innerHTML = "";
    var grid = h("ul", { class: "cn-grid", role: "list" });
    var featured = visible().filter(function (r) { return r.website; }), PAGE = 24;
    var shown = state.showAll ? featured : featured.slice(0, PAGE);
    if (state.active && shown.indexOf(state.active) < 0 && featured.indexOf(state.active) > -1) shown = featured;
    shown.forEach(function (r) {
      var show = r.points.length ? h("button", { class: "cn-link", type: "button", onclick: function () { pick(r); var g = document.querySelector('[data-cn="globe"]'); if (g) g.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }); } }, ["Show on globe"]) : null;
      grid.appendChild(h("li", { class: "cn-card" + (r.featured ? " is-featured" : ""), "data-slug": r.slug }, [
        h("div", { class: "cn-card-head" }, [mark(r), h("div", {}, [h("p", { class: "cn-kicker", text: kicker(r) }), h("h3", { class: "cn-card-name" }, [r.url ? h("a", { href: r.url, text: r.name }) : r.name])])]),
        h("p", { class: "cn-place", text: r.place }),
        r.summary ? h("p", { class: "cn-card-summary", text: r.summary }) : null,
        h("div", { class: "cn-card-foot" }, [r.website ? h("a", { class: "cn-link", href: r.website, target: "_blank", rel: "noopener", text: host(r.website) + " ↗" }) : null, show])
      ]));
    });
    if (!grid.children.length) grid.appendChild(h("li", { class: "cn-empty", text: "No featured businesses in this industry yet. Their pins are still on the map." }));
    var more = shown.length < featured.length ? h("div", { class: "cn-more" }, [h("button", { class: "cn-btn", type: "button", onclick: function () { state.showAll = true; paintDirectory(); } }, ["Show all " + featured.length + " featured businesses"])]) : null;
    el.appendChild(h("div", { class: "cn-wrap" }, [grid, more]));
    syncPins();
  }

  // ------------------------------------------------------------ boot
  function boot() {
    if (!document.querySelector("[data-cn-source]") && CFG.sourceUrl) {
      fetch(CFG.sourceUrl, { credentials: "same-origin" }).then(function (r) { return r.text(); }).then(function (html) {
        start(readItems(new DOMParser().parseFromString(html, "text/html")));
      }).catch(function (e) { console.warn("[cn] could not load members from " + CFG.sourceUrl, e); start([]); });
    } else start(readItems());
  }
  function start(items) {
    state.items = items;
    paintStats();
    document.querySelectorAll('[data-cn="globe"]').forEach(renderGlobe);
    document.querySelectorAll('[data-cn="directory"]').forEach(renderDirectory);
    var m = q("member"); if (m) { var r = state.items.filter(function (x) { return x.slug === m; })[0]; if (r) setTimeout(function () { pick(r); }, 600); }
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && state.active) closePanel(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
