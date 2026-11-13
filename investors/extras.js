/* Colaeb /investors extras, layered on top of the shared globe/directory (network/cn.js):
   1. "Recent deal" tags from YourInfoDaily Business coverage (enrich/yid-deals.json, refreshed daily by GitHub Actions).
   2. Profile links to colaeb.com/investors/<slug> pages when CN_CONFIG.profiles is set.
   3. Active-first order: Colaeb verified, then investors with the most recent YourInfoDaily-confirmed round.
   4. Live counts: any "3,500+"-style investor count in the page copy shows the real number, plus a
      "last updated" line above the directory ([data-cnx-updated] if present, otherwise inserted).
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
      ".cnx-updated{max-width:1200px;margin:0 auto 14px;padding:0;font-size:14px;line-height:1.5;color:#475467}.cnx-updated b{color:#101828}.cnx-updated a{color:inherit;text-decoration:underline}" +
      ".cnx-active{display:inline-block;margin-left:6px;padding:2px 6px;border-radius:4px;background:#16A34A;color:#fff;font:700 10px/1.4 Arial,sans-serif;letter-spacing:.04em;vertical-align:middle}";
    document.head.appendChild(s);
  }

  function dealHtml(d) {
    return '<span aria-hidden="true">●</span><span><b>' + (d.r === "led" ? "Led" : "Participated") + ":</b> " +
      '<a href="' + esc(d.u) + '" target="_blank" rel="noopener">' + esc(d.t) + "</a></span>";
  }
  var ACTIVE_DAYS = 90, UPDATED = "";
  function lastDeal(r) { return (r.deals && r.deals[0] && r.deals[0].d) || ""; }
  function activeFirst(items) {
    items.sort(function (a, b) {
      return (b.featured - a.featured) || (lastDeal(b) > lastDeal(a) ? 1 : lastDeal(b) < lastDeal(a) ? -1 : 0) || a.name.localeCompare(b.name);
    });
  }
  function fmtDate(iso) { var p = String(iso || "").split("-"); return p.length === 3 ? MONTHS[+p[1] - 1] + " " + (+p[2]) + ", " + p[0] : ""; }
  // Page copy like "a free database of 3,500+ venture capital firms" shows the live count instead.
  function liveCounts(n) {
    var label = Number(n).toLocaleString("en-US");
    var walker = document.createTreeWalker(document.querySelector("main") || document.body, NodeFilter.SHOW_TEXT, null);
    var rx = /\b\d{1,2},\d00\+(?=\s+(?:venture|investors|VC|startup investors))/g, nodes = [];
    while (walker.nextNode()) if (rx.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
    nodes.forEach(function (t) { rx.lastIndex = 0; t.nodeValue = t.nodeValue.replace(rx, label); });
  }
  function updatedLine(items) {
    var since = new Date(Date.now() - ACTIVE_DAYS * 864e5).toISOString().slice(0, 10);
    var active = items.filter(function (r) { return lastDeal(r) >= since; }).length;
    var el = document.querySelector("[data-cnx-updated]");
    if (!el) {
      var dir = document.querySelector('[data-cn="directory"]'); if (!dir) return;
      el = document.createElement("p"); el.setAttribute("data-cnx-updated", ""); el.className = "cnx-updated";
      var wrap = dir.querySelector(".cn-dir-search") || dir.firstChild;
      if (wrap) wrap.insertBefore(el, wrap.firstChild); else dir.insertBefore(el, dir.firstChild);
    }
    el.innerHTML = "<b>Updated " + esc(fmtDate(UPDATED) || fmtDate(new Date().toISOString().slice(0, 10))) + "</b> · " +
      active.toLocaleString("en-US") + " investors active in the last " + ACTIVE_DAYS + " days, listed first. " +
      'Activity is verified against <a href="https://www.yourinfodaily.com/p/t/business" target="_blank" rel="noopener">YourInfoDaily\u2019s startup funding coverage</a>.';
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
    if (r.profile) {
      var name = li.querySelector(".cn-card-name");
      if (name && !name.querySelector("a")) { var t = name.firstChild; var a = document.createElement("a"); a.href = r.profile; a.textContent = r.name; if (t) name.replaceChild(a, t); }
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
      if (r.profile && !acts.querySelector('a[href*="/investors/"]')) {
        var pr = document.createElement("a"); pr.className = "cn-btn"; pr.href = r.profile; pr.textContent = "Investor profile"; acts.appendChild(pr);
      }
    }
  }

  function scan(root) {
    if (!ready) return;
    if (root.matches && root.matches(".cn-card[data-slug]")) decorateCard(root);
    (root.querySelectorAll ? root : document).querySelectorAll(".cn-card[data-slug]").forEach(decorateCard);
    document.querySelectorAll(".cn-panel-name").forEach(function (n) { var p = n.closest(".cn-panel-head"); if (p && p.parentNode) decoratePanel(p.parentNode); });
  }

  var PROFILES = CFG.profileMap || "https://cdn.jsdelivr.net/gh/stopwatchcreative/colaeb-world-economies@main/investors/enrich/profiles.json";
  function attach(deals, profiles) {
    var items = (window.CN && window.CN.items && window.CN.items()) || [];
    items.forEach(function (r) {
      bySlug[r.slug] = r; byName[keyName(r.name)] = r;
      var h = host(r.website);
      var d = (h && deals["h:" + h]) || deals["n:" + keyName(r.name)];
      if (d && d.length) r.deals = d;
      var sl = (h && profiles["h:" + h]) || profiles["n:" + keyName(r.name)];
      if (sl) r.profile = "/investors/" + sl;
    });
    ready = true;
    activeFirst(items);
    if (window.CN.refresh) window.CN.refresh();
    liveCounts(items.length);
    updatedLine(items);
    scan(document);
    try { document.dispatchEvent(new CustomEvent("cn:deals")); } catch (e) {}
  }

  function start() {
    css();
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("[data-cn-promo]");
      if (a) track("promo_click", { promo: a.getAttribute("data-cn-promo") });
    });
    var get = function (u) { return fetch(u).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }); };
    Promise.all([get(DEALS), get(PROFILES)]).then(function (a) { UPDATED = (a[0] && a[0].updated) || ""; attach((a[0] && a[0].deals) || {}, a[1] || {}); });
    new MutationObserver(function (muts) { if (!ready) return; muts.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); }); }); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (window.CN) start(); else document.addEventListener("cn:ready", start, { once: true });
})();
