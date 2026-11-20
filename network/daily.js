/* Colaeb Network: "Today on the map" banner.
   Shows three network members, changing every day at midnight Eastern time.
   Members are read from the hidden Network CMS list on the page ([data-cn-source]): only members with a
   website and a map pin, and never the four Member Spotlight members. The order is a seeded
   shuffle, so every member appears once before anyone repeats (about 60 days for 180 members).
   Mount: inserted right after the Member Spotlight section. Styles live in daily.css. */
(function () {
  var TZ = "America/New_York", PER_DAY = 3;
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function dayIndex() {
    // Calendar day in Eastern time, counted from 1970-01-01
    var p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    var get = function (t) { return +p.filter(function (x) { return x.type === t; })[0].value; };
    return Math.floor(Date.UTC(get("year"), get("month") - 1, get("day")) / 86400000);
  }
  function rng(seed) { // mulberry32
    return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  var cache = {};
  function cycleOrder(pool, cycle) {
    if (cache[cycle]) return cache[cycle];
    var a = pool.slice(), r = rng(20261119 + cycle * 7919);
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return (cache[cycle] = a);
  }
  function picks(pool, day) {
    var out = [], n = pool.length;
    for (var k = 0; k < PER_DAY && k < n; k++) {
      var idx = day * PER_DAY + k;
      out.push(cycleOrder(pool, Math.floor(idx / n))[idx % n]);
    }
    return out;
  }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var TONES = ["#B4531A", "#1F6F5C", "#3A4F9B", "#7A3E6E", "#8A6D1C", "#2F6B8F", "#9B3B3B", "#4B6B2F"];
  function initials(s) { return s.replace(/[^\w\s&]/g, "").split(/\s+/).filter(function (w) { return w && !/^(the|of|and|&)$/i.test(w); }).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase() || s.slice(0, 2).toUpperCase(); }
  function tone(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return TONES[h % TONES.length]; }
  function mark(r) {
    var m = el("span", "cnd-mark"); m.setAttribute("aria-hidden", "true");
    if (r.logo) { m.classList.add("has-logo"); var i = el("img"); i.src = r.logo; i.alt = ""; i.loading = "lazy"; m.appendChild(i); }
    else { m.style.background = tone(r.name); m.textContent = initials(r.name); }
    return m;
  }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }
  function track(name, slug) { if (window.gtag) gtag("event", name, { promo: "network_daily", member: slug }); }

  function field(it, n) {
    var e = it.querySelector('[data-cn-field="' + n + '"]');
    if (!e || e.classList.contains("w-dyn-bind-empty") || e.classList.contains("w-condition-invisible")) return "";
    if (e.tagName === "IMG") { var s = e.getAttribute("src") || ""; return /placeholder|^data:/.test(s) ? "" : s; }
    if (e.tagName === "A") { var hr = e.getAttribute("href") || ""; return hr === "#" ? "" : hr; }
    return (e.textContent || "").trim();
  }
  function slugify(s) { return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function readItems() {
    var out = [], seen = {}, base = (window.CN_CONFIG && CN_CONFIG.profileBase) || "/network/";
    document.querySelectorAll("[data-cn-source] .w-dyn-item").forEach(function (it) {
      var f = function (n) { return field(it, n); }, name = f("name");
      if (!name) return;
      var r = { name: name, slug: f("slug") || slugify(name), industry: f("industry"), city: f("city"), country: f("country"),
        summary: f("summary"), website: f("website"), logo: f("logo"), featured: /^(true|yes|1)$/i.test(f("featured")),
        hasPin: f("lat") !== "" && f("lng") !== "" && !isNaN(parseFloat(f("lat"))) };
      if (seen[r.slug]) return; seen[r.slug] = 1;
      r.place = [r.city, r.country].filter(Boolean).join(", ");
      r.url = f("url") || base.replace(/\/?$/, "/") + r.slug;
      out.push(r);
    });
    return out;
  }
  function showOnMap(r) {
    // Use the map's own search: filter to this member, then press its "Show on globe" button.
    var input = document.querySelector('[data-cn="globe"] input, [data-cn="directory"] input, .cn-search input');
    if (!input) { location.href = r.url; return; }
    input.value = r.name; input.dispatchEvent(new Event("input", { bubbles: true }));
    var tries = 0;
    (function look() {
      var btn = [].slice.call(document.querySelectorAll('[data-cn="directory"] button')).filter(function (b) {
        var c = b.closest("li, article, .cn-card"); return /globe|map/i.test(b.textContent) && c && c.textContent.indexOf(r.name) > -1;
      })[0];
      if (btn) { btn.click(); return; }
      if (++tries < 15) setTimeout(look, 100); else location.href = r.url;
    })();
  }

  function card(r) {
    var li = el("li", "cnd-card");
    var head = el("div", "cnd-head");
    var t = el("div");
    t.appendChild(el("p", "cnd-kicker", r.industry || "Colaeb member"));
    var h = el("h3", "cnd-name");
    if (r.url) { var a = el("a", null, r.name); a.href = r.url; h.appendChild(a); } else h.textContent = r.name;
    t.appendChild(h);
    head.appendChild(mark(r)); head.appendChild(t); li.appendChild(head);
    if (r.place) li.appendChild(el("p", "cnd-place", r.place));
    if (r.summary) li.appendChild(el("p", "cnd-summary", r.summary));
    var acts = el("div", "cnd-actions");
    var v = el("a", "cnd-btn cnd-btn-accent", "Visit website ↗"); v.href = r.website; v.target = "_blank"; v.rel = "noopener";
    v.title = host(r.website);
    v.addEventListener("click", function () { track("network_daily_visit", r.slug); });
    acts.appendChild(v);
    var b = el("button", "cnd-btn", "See on the map"); b.type = "button";
    b.addEventListener("click", function () { track("network_daily_map", r.slug); showOnMap(r); });
    acts.appendChild(b);
    li.appendChild(acts);
    return li;
  }

  function build() {
    if (document.querySelector(".cnd")) return;
    var spot = (window.CN_CONFIG && CN_CONFIG.spotlight) || [];
    var pool = readItems().filter(function (r) {
      return r.website && r.hasPin && !r.featured && spot.indexOf(r.slug) < 0;
    }).sort(function (a, b) { return a.slug < b.slug ? -1 : 1; });
    if (pool.length < PER_DAY) return;
    var list = picks(pool, dayIndex());

    var sec = el("section", "cnd"); sec.setAttribute("aria-label", "Today on the map: three Colaeb members");
    var wrap = el("div", "cnd-wrap");
    var top = el("div", "cnd-top");
    var copy = el("div");
    var date = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" }).format(new Date());
    copy.appendChild(el("p", "cnd-eyebrow", "Today on the map · " + date));
    copy.appendChild(el("h2", "cnd-title", "Meet three Colaeb members."));
    top.appendChild(copy);
    top.appendChild(el("p", "cnd-note", "Three new businesses from the network every day."));
    wrap.appendChild(top);
    var ul = el("ul", "cnd-grid"); ul.setAttribute("role", "list");
    list.forEach(function (r) { ul.appendChild(card(r)); });
    wrap.appendChild(ul);
    sec.appendChild(wrap);

    var after = document.querySelector('[data-cn="spotlight"]');
    if (after && after.parentNode) after.parentNode.insertBefore(sec, after.nextSibling);
    else return;
    if (!REDUCED && "IntersectionObserver" in window) {
      sec.classList.add("cnd-anim");
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { sec.classList.add("is-in"); io.disconnect(); } }, { threshold: 0.2 });
      io.observe(sec);
    }
  }

  // Wait for cn.js to draw the Member Spotlight, so the banner lands right below it.
  var n = 0;
  (function wait() {
    var sp = document.querySelector('[data-cn="spotlight"]');
    if (sp && (sp.children.length || sp.hidden || n > 40)) return build();
    n++; setTimeout(wait, 150);
  })();
})();
