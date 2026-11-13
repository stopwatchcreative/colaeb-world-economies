/* Colaeb investor profile pages (colaeb.com/investors/<slug>, the Investors CMS template).
   Hides empty facts and shows recent deals from YourInfoDaily. */
(function () {
  "use strict";
  var DEALS = "https://cdn.jsdelivr.net/gh/stopwatchcreative/colaeb-world-economies@main/investors/enrich/yid-deals.json";
  var MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  function track(n, p) { try { if (window.gtag) window.gtag("event", n, p); } catch (e) {} }
  function esc(t) { return String(t || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function keyName(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
  function host(u) { u = String(u || "").toLowerCase(); if (!u || u.indexOf("linkedin.com") > -1) return ""; return u.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, ""); }
  function empty(el) { return !el || el.classList.contains("w-dyn-bind-empty") || !el.textContent.trim(); }

  function go() {
    var root = document.querySelector('[data-cn-root="investor-profile"]'); if (!root) return;
    var name = (root.querySelector('[data-cni="name"]') || {}).textContent || "";
    document.querySelectorAll(".cni-fact").forEach(function (f) { if (empty(f.querySelector(".cni-dd"))) f.style.display = "none"; });
    var facts = root.querySelector(".cni-facts");
    if (facts && ![].some.call(facts.children, function (f) { return f.style.display !== "none"; })) facts.style.display = "none";
    ["summary", "profile", "city", "country", "type"].forEach(function (k) { var el = root.querySelector('[data-cni="' + k + '"]'); if (empty(el)) el.style.display = "none"; });
    var web = root.querySelector('[data-cni="website"]');
    if (web) {
      var href = web.getAttribute("href") || "";
      if (!href || href === "#") web.style.display = "none";
      else if (/linkedin\.com/i.test(href)) web.textContent = "View on LinkedIn ↗";
      web.addEventListener("click", function () { track("investor_website_click", { investor: name }); });
    }
    var box = root.querySelector('[data-cni="deals"]');
    if (box) fetch(DEALS).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (j) {
      var d = (j && j.deals) || {}, h = host(web && web.getAttribute("href"));
      var list = (h && d["h:" + h]) || d["n:" + keyName(name)] || d["n:" + keyName(name.replace(/\s*\([^)]*\)/, ""))];
      if (!list || !list.length) return;
      box.innerHTML = '<h3 class="cni-h3">Recent deals covered by YourInfoDaily</h3><ul class="cni-deal-list">' + list.map(function (x) {
        var p = String(x.d || "").split("-");
        return '<li><b>' + (x.r === "led" ? "Led" : "Backed") + ":</b> <a href=\"" + esc(x.u) + '" target="_blank" rel="noopener">' + esc(x.t) + "</a> <span>" + (p.length > 1 ? MONTHS[+p[1] - 1] + " " + p[0] : "") + "</span></li>";
      }).join("") + "</ul>";
    });
  }
  var s = document.createElement("style");
  s.textContent = ".cni-h3{font-size:18px;margin:26px 0 10px;color:#101828}.cni-deal-list{margin:0;padding:0 0 0 18px}.cni-deal-list li{margin:0 0 8px;font-size:16px;line-height:1.5;color:#344054}.cni-deal-list a{color:#B4520C}.cni-deal-list span{color:#7A8794;font-size:14px}";
  document.head.appendChild(s);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
