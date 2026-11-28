/* Colaeb /investors: ESPN-scoreboard-style strip fed by YourInfoDaily's Business section.
   Reads https://www.yourinfodaily.com/p/t/business in the browser, takes the newest headlines and shows
   them as a row of cards above the masthead: a section tab on the left, cards that page with arrows
   (and auto-advance), and any amount raised ("$12M") pulled out big like a score.
   If the fetch fails, nothing is shown. */
(function () {
  "use strict";
  var SRC = "https://www.yourinfodaily.com/p/t/business";
  var BASE = "https://www.yourinfodaily.com";
  var MAX = 12;

  function esc(t) { return String(t || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function css() {
    var s = document.createElement("style");
    s.textContent =
      ".cnt{position:relative;z-index:2;display:flex;align-items:stretch;background:#0B1220;color:#fff;border-bottom:3px solid #F37A23;font-family:\"Source Sans 3\",Arial,Helvetica,sans-serif}" +
      ".cnt-tab{flex:0 0 auto;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:0 18px;min-width:132px;background:#151E2E;border-right:1px solid #233046;color:#fff;text-decoration:none}" +
      ".cnt-tab b{display:flex;align-items:center;gap:7px;font:800 14px/1 Sora,Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase}" +
      ".cnt-tab b:after{content:\"\";width:7px;height:7px;border-right:2px solid #F37A23;border-bottom:2px solid #F37A23;transform:rotate(45deg) translateY(-3px)}" +
      ".cnt-tab span{display:flex;align-items:center;gap:6px;font:700 11px/1 Arial,sans-serif;color:#9FB0C6;letter-spacing:.06em;text-transform:uppercase}" +
      ".cnt-live{width:7px;height:7px;border-radius:50%;background:#E5484D;box-shadow:0 0 0 0 rgba(229,72,77,.6);animation:cntLive 1.6s infinite}" +
      ".cnt-rail{flex:1 1 auto;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:none}" +
      ".cnt-rail::-webkit-scrollbar{display:none}" +
      ".cnt-card{flex:0 0 236px;scroll-snap-align:start;display:flex;flex-direction:column;gap:6px;padding:10px 14px 11px;border-right:1px solid #1E293B;color:#fff;text-decoration:none;transition:background .15s}" +
      ".cnt-card:hover{background:#131D2E}" +
      ".cnt-top{display:flex;align-items:center;justify-content:space-between;gap:8px;font:700 10.5px/1 Arial,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#8A9BB4}" +
      ".cnt-top em{font-style:normal;padding:3px 6px;border-radius:3px;background:#E5484D;color:#fff}" +
      ".cnt-top em.cnt-k{background:#1F3A2B;color:#7EE2A8}" +
      ".cnt-row{display:flex;align-items:center;gap:10px}" +
      ".cnt-score{flex:0 0 auto;min-width:54px;padding:5px 6px;border-radius:6px;background:#F37A23;color:#0B1220;text-align:center;font:800 17px/1 Sora,Arial,sans-serif;letter-spacing:-.3px}" +
      ".cnt-score small{display:block;margin-top:2px;font:800 8.5px/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;opacity:.75}" +
      ".cnt-title{font:700 13.5px/1.3 Arial,Helvetica,sans-serif;color:#E8EDF5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
      ".cnt-card:hover .cnt-title{color:#fff;text-decoration:underline;text-underline-offset:2px}" +
      ".cnt-nav{flex:0 0 auto;display:flex;border-left:1px solid #233046}" +
      ".cnt-nav button{width:36px;border:0;background:#151E2E;color:#fff;font-size:18px;cursor:pointer;padding:0}" +
      ".cnt-nav button+button{border-left:1px solid #233046}" +
      ".cnt-nav button:hover{background:#F37A23;color:#0B1220}" +
      ".cnt-nav button:disabled{opacity:.35;cursor:default;background:#151E2E;color:#fff}" +
      ".cnt-all{flex:0 0 auto;display:flex;align-items:center;padding:0 14px;background:#151E2E;border-left:1px solid #233046;color:#F37A23;font:800 12px/1 Sora,Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase;text-decoration:none;white-space:nowrap}" +
      ".cnt-all:hover{color:#fff}" +
      "@keyframes cntLive{0%{box-shadow:0 0 0 0 rgba(229,72,77,.6)}70%{box-shadow:0 0 0 6px rgba(229,72,77,0)}100%{box-shadow:0 0 0 0 rgba(229,72,77,0)}}" +
      "@media (max-width:767px){.cnt-tab{min-width:0;padding:0 11px}.cnt-tab b{font-size:12px}.cnt-tab b:after{display:none}.cnt-tab span{font-size:9.5px}.cnt-card{flex-basis:78vw;max-width:280px}.cnt-nav,.cnt-all{display:none}}" +
      "@media (prefers-reduced-motion:reduce){.cnt-rail{scroll-behavior:auto}.cnt-live{animation:none}}";
    document.head.appendChild(s);
  }

  // "$12M", "$1.5 million", "$300K", "$2B" in a headline becomes the card's "score".
  function amount(t) {
    var m = t.match(/\$\s?(\d+(?:[.,]\d+)?)\s?(billion|million|thousand|[bmk])\b/i);
    if (!m) return "";
    var u = m[2].toLowerCase().charAt(0);
    return "$" + m[1].replace(",", ".") + (u === "b" ? "B" : u === "m" ? "M" : "K");
  }
  function kind(t) {
    t = t.toLowerCase();
    if (/acqui|merge|buys\b/.test(t)) return "M&A";
    if (/rais|funding|seed|series [a-e]|round|invest/.test(t)) return "Funding";
    if (/launch|debut|unveil/.test(t)) return "Launch";
    return "Business";
  }

  function parse(html) {
    var d = new DOMParser().parseFromString(html, "text/html"), seen = {}, out = [];
    d.querySelectorAll('a[href*="/p/"]').forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (/\/p\/t\//.test(href) || /cover-image-link/.test(a.className)) return;
      var title = a.textContent.replace(/\s+/g, " ").trim();
      if (title.length < 12) return;
      var url = /^https?:/.test(href) ? href : BASE + (href.charAt(0) === "/" ? "" : "/") + href;
      if (seen[url]) return; seen[url] = 1;
      out.push({ title: title, url: url });
    });
    return out.slice(0, MAX);
  }

  function render(items) {
    if (!items.length) return;
    var mount = document.querySelector(".cn-masthead");
    if (!mount) return;
    css();
    var cards = items.map(function (it, i) {
      var amt = amount(it.title), k = kind(it.title);
      return '<a class="cnt-card" href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
        '<span class="cnt-top"><span>' + esc(k) + '</span>' + (i === 0 ? "<em>Latest</em>" : "") + "</span>" +
        '<span class="cnt-row">' + (amt ? '<span class="cnt-score">' + esc(amt) + "<small>" + (k === "Funding" ? "Raised" : k === "M&A" ? "Deal" : "Value") + "</small></span>" : "") +
        '<span class="cnt-title">' + esc(it.title) + "</span></span></a>";
    }).join("");
    var bar = document.createElement("div");
    bar.className = "cnt";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Latest business news from YourInfoDaily");
    bar.innerHTML =
      '<a class="cnt-tab" href="' + SRC + '" target="_blank" rel="noopener"><b>Business</b><span><i class="cnt-live"></i>YourInfoDaily</span></a>' +
      '<div class="cnt-rail" tabindex="0">' + cards + "</div>" +
      '<div class="cnt-nav"><button type="button" aria-label="Previous stories">‹</button><button type="button" aria-label="Next stories">›</button></div>' +
      '<a class="cnt-all" href="' + SRC + '" target="_blank" rel="noopener">All news</a>';
    mount.parentNode.insertBefore(bar, mount);

    var rail = bar.querySelector(".cnt-rail"), btns = bar.querySelectorAll(".cnt-nav button");
    function step() { var c = rail.querySelector(".cnt-card"); return c ? c.offsetWidth * Math.max(1, Math.floor(rail.clientWidth / c.offsetWidth)) : 240; }
    function sync() {
      btns[0].disabled = rail.scrollLeft < 4;
      btns[1].disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4;
    }
    btns[0].onclick = function () { rail.scrollBy({ left: -step() }); };
    btns[1].onclick = function () { rail.scrollBy({ left: step() }); };
    rail.addEventListener("scroll", sync, { passive: true }); addEventListener("resize", sync); sync();

    // Auto-advance every 6s like a live scoreboard; pause while the visitor is on it; loop back at the end.
    var hold = false;
    bar.addEventListener("mouseenter", function () { hold = true; });
    bar.addEventListener("mouseleave", function () { hold = false; });
    bar.addEventListener("focusin", function () { hold = true; });
    bar.addEventListener("touchstart", function () { hold = true; }, { passive: true });
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInterval(function () {
        if (hold || document.hidden) return;
        if (rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4) rail.scrollTo({ left: 0 }); else rail.scrollBy({ left: step() });
      }, 6000);
    }
    bar.addEventListener("click", function (e) {
      var a = e.target.closest("a"); if (!a) return;
      try { window.gtag && gtag("event", "ticker_click", { target: a.classList.contains("cnt-card") ? "story" : "section" }); } catch (er) {}
    });
  }

  function go() {
    fetch(SRC, { credentials: "omit" })
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (h) { if (h) render(parse(h)); })
      .catch(function () {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
