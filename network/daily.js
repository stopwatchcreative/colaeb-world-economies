/* Colaeb Network: "Today on the map" banner.
   Shows three network members, changing every day at midnight Eastern time.
   Members are drawn from the live Network CMS list (window.CN from cn.js): only members with a
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
    b.addEventListener("click", function () { track("network_daily_map", r.slug); if (window.CN && CN.pick) CN.pick(r.slug); });
    acts.appendChild(b);
    li.appendChild(acts);
    return li;
  }

  function build() {
    if (!window.CN || document.querySelector(".cnd")) return;
    var spot = (window.CN_CONFIG && CN_CONFIG.spotlight) || [];
    var pool = (CN.items() || []).filter(function (r) {
      return r.website && r.points && r.points.length && !r.featured && spot.indexOf(r.slug) < 0;
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

  if (window.CN) build();
  document.addEventListener("cn:ready", function () { setTimeout(build, 0); });
})();
