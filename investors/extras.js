/* Colaeb /investors extras, layered on top of the shared globe/directory (network/cn.js):
   1. "Recent deal" tags from YourInfoDaily Business coverage (enrich/yid-deals.json, refreshed daily by GitHub Actions).
   2. Profile links to colaeb.com/investors/<slug> pages when CN_CONFIG.profiles is set.
   Investor Match (match.js) reads r.deals to rank recently active investors higher. */
(function () {
  "use strict";
  var CFG = window.CN_CONFIG || {};
  var DEALS = CFG.deals || "https://cdn.jsdelivr.net/gh/stopwatchcreative/colaeb-world-economies@main/investors/enrich/yid-deals.json";
  var MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  var bySlug = {}, byName = {}, ready = false;

  function keyName(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
  function host(u) { u = String(u || "").toLowerCase(); if (!u || u.indexOf("linkedin.com") > -1) return ""; return u.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, ""); }
  function month(d) { var p = String(d || "").split("-"); return p.length > 1 ? MONTHS[+p[1] - 1] + " " + p[0] : ""; }
  function track(name, params) { try { if (window.gtag) window.gtag("event", name, params); } catch (e) {} }
  function esc(t) { return String(t || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function css() {
    var s = document.createElement("style");
    s.textContent =
      ".cnx-deal{display:flex;gap:8px;align-items:flex-start;margin:10px 0 0;padding:8px 10px;border-radius:10px;background:#F0FDF4;border:1px solid #BBF7D0;font-size:13px;line-height:1.4;color:#14532D}" +
      ".cnx-deal b{font-weight:700;white-space:nowrap}.cnx-deal a{color:#14532D;text-decoration:underline}.cnx-deal small{color:#3F6212;white-space:nowrap}" +
      ".cnx-active{display:inline-block;margin-left:6px;padding:2px 6px;border-radius:4px;background:#16A34A;color:#fff;font:700 10px/1.4 Arial,sans-serif;letter-spacing:.04em;vertical-align:middle}";
    document.head.appendChild(s);
  }

  function dealHtml(d) {
    return '<span aria-hidden="true">●</span><span><b>' + (d.r === "led" ? "Led a round" : "Backed a round") + ":</b> " +
      '<a href="' + esc(d.u) + '" target="_blank" rel="noopener">' + esc(d.t) + "</a> <small>" + month(d.d) + " · YourInfoDaily</small></span>";
  }

  function decorateCard(li) {
    if (li.__cnx) return; li.__cnx = 1;
    var r = bySlug[li.getAttribute("data-slug")]; if (!r) return;
    var foot = li.querySelector(".cn-card-foot") || li;
    if (r.deals && r.deals.length) {
      var p = document.createElement("p"); p.className = "cnx-deal"; p.innerHTML = dealHtml(r.deals[0]);
      foot.parentNode.insertBefore(p, foot);
      var nm = li.querySelector(".cn-card-name"); if (nm && !nm.querySelector(".cnx-active")) nm.insertAdjacentHTML("beforeend", '<span class="cnx-active">ACTIVE</span>');
    }
    if (CFG.profiles && r.slug) {
      var name = li.querySelector(".cn-card-name");
      if (name && !name.querySelector("a")) { var t = name.firstChild; var a = document.createElement("a"); a.href = CFG.profiles.replace(/\/?$/, "/") + r.slug; a.textContent = r.name; if (t) name.replaceChild(a, t); }
    }
  }

  function decoratePanel(panel) {
    var nm = panel.querySelector(".cn-panel-name"); if (!nm || panel.__cnxFor === nm.textContent) return;
    panel.__cnxFor = nm.textContent;
    var r = byName[keyName(nm.textContent)]; if (!r) return;
    var acts = panel.querySelector(".cn-actions");
    (r.deals || []).slice(0, 3).forEach(function (d) {
      var p = document.createElement("p"); p.className = "cnx-deal"; p.innerHTML = dealHtml(d);
      panel.insertBefore(p, acts);
    });
    if (acts) {
      if (CFG.profiles && r.slug && !acts.querySelector('a[href*="/investors/"]')) {
        var pr = document.createElement("a"); pr.className = "cn-btn"; pr.href = CFG.profiles.replace(/\/?$/, "/") + r.slug; pr.textContent = "Investor profile"; acts.appendChild(pr);
      }
    }
  }

  function scan(root) {
    if (!ready) return;
    if (root.matches && root.matches(".cn-card[data-slug]")) decorateCard(root);
    (root.querySelectorAll ? root : document).querySelectorAll(".cn-card[data-slug]").forEach(decorateCard);
    document.querySelectorAll(".cn-panel-name").forEach(function (n) { var p = n.closest(".cn-panel-head"); if (p && p.parentNode) decoratePanel(p.parentNode); });
  }

  function attach(deals) {
    var items = (window.CN && window.CN.items && window.CN.items()) || [];
    items.forEach(function (r) {
      bySlug[r.slug] = r; byName[keyName(r.name)] = r;
      var h = host(r.website);
      var d = (h && deals["h:" + h]) || deals["n:" + keyName(r.name)];
      if (d && d.length) r.deals = d;
    });
    ready = true;
    scan(document);
    try { document.dispatchEvent(new CustomEvent("cn:deals")); } catch (e) {}
  }

  function start() {
    css();
    fetch(DEALS).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
      .then(function (j) { attach((j && j.deals) || {}); });
    new MutationObserver(function (muts) { if (!ready) return; muts.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); }); }); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (window.CN) start(); else document.addEventListener("cn:ready", start, { once: true });
})();
