/* Colaeb /investors: ESPN-style headline ticker fed by YourInfoDaily's Business section.
   Reads https://www.yourinfodaily.com/p/t/business in the browser (the site allows it),
   takes the newest headlines and scrolls them in a bar above the masthead.
   If the fetch fails, nothing is shown. */
(function () {
  "use strict";
  var SRC = "https://www.yourinfodaily.com/p/t/business";
  var BASE = "https://www.yourinfodaily.com";
  var MAX = 8;

  function esc(t) { return String(t || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function css() {
    var s = document.createElement("style");
    s.textContent =
      ".cnt{display:flex;align-items:stretch;background:#101828;color:#fff;font:600 14px/1.2 Arial,Helvetica,sans-serif;overflow:hidden;position:relative;z-index:2}" +
      ".cnt-label{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:10px 16px;background:#F37A23;color:#fff;text-transform:uppercase;letter-spacing:.06em;font-size:12px;font-weight:800;white-space:nowrap;text-decoration:none}" +
      ".cnt-dot{width:8px;height:8px;border-radius:50%;background:#fff;animation:cntPulse 1.4s ease-in-out infinite}" +
      ".cnt-viewport{flex:1 1 auto;overflow:hidden;position:relative;mask-image:linear-gradient(90deg,transparent,#000 24px,#000 calc(100% - 24px),transparent);-webkit-mask-image:linear-gradient(90deg,transparent,#000 24px,#000 calc(100% - 24px),transparent)}" +
      ".cnt-track{display:inline-flex;white-space:nowrap;will-change:transform;animation:cntScroll var(--cnt-dur,60s) linear infinite}" +
      ".cnt:hover .cnt-track,.cnt:focus-within .cnt-track{animation-play-state:paused}" +
      ".cnt-item{display:inline-flex;align-items:center;gap:10px;padding:10px 28px 10px 0;color:#fff;text-decoration:none}" +
      ".cnt-item:hover .cnt-title{text-decoration:underline}" +
      ".cnt-new{background:#16A34A;color:#fff;font-size:10px;font-weight:800;letter-spacing:.06em;padding:3px 6px;border-radius:4px}" +
      ".cnt-sep{color:#F37A23;padding-right:28px}" +
      "@keyframes cntScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}" +
      "@keyframes cntPulse{0%,100%{opacity:1}50%{opacity:.35}}" +
      "@media (prefers-reduced-motion:reduce){.cnt-track{animation:none}.cnt-viewport{overflow-x:auto}}" +
      "@media (max-width:600px){.cnt-label-text{display:none}.cnt-label{padding:10px 12px}}";
    document.head.appendChild(s);
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
    var one = items.map(function (it, i) {
      return '<a class="cnt-item" href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
        (i === 0 ? '<span class="cnt-new">NEW</span>' : "") +
        '<span class="cnt-title">' + esc(it.title) + '</span></a><span class="cnt-sep" aria-hidden="true">&bull;</span>';
    }).join("");
    var bar = document.createElement("div");
    bar.className = "cnt";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Latest business news from YourInfoDaily");
    bar.innerHTML =
      '<a class="cnt-label" href="' + SRC + '" target="_blank" rel="noopener"><span class="cnt-dot"></span><span class="cnt-label-text">YourInfoDaily Business</span></a>' +
      '<div class="cnt-viewport"><div class="cnt-track">' + one + '<span aria-hidden="true" style="display:contents">' + one.replace(/<a /g, '<a tabindex="-1" ') + "</span></div></div>";
    mount.parentNode.insertBefore(bar, mount);
    // Keep the speed steady (about 70px a second) whatever the number of headlines.
    var track = bar.querySelector(".cnt-track");
    requestAnimationFrame(function () {
      var w = track.scrollWidth / 2;
      track.style.setProperty("--cnt-dur", Math.max(20, Math.round(w / 70)) + "s");
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
