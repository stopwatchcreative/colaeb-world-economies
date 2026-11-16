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
      ".cnx-new{margin:0 0 20px;padding:16px 18px;border:1px solid #FDE2C8;background:#FFF8F1;border-radius:14px}.cnx-new-head{margin:0 0 10px;font:400 14px/1.4 'Source Sans 3',system-ui,sans-serif;color:#475467}.cnx-new-head b{color:#B4520C;font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin-right:4px}" +
      ".cnx-new ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}.cnx-new a{display:inline-flex;gap:6px;align-items:baseline;padding:7px 12px;border-radius:999px;background:#fff;border:1px solid #F9C99B;color:#101828;font:600 14px/1.2 'Source Sans 3',system-ui,sans-serif;text-decoration:none}.cnx-new a:hover{border-color:#F37A23}.cnx-new a span{font-weight:400;color:#667085;font-size:12px}" +
      ".cnx-badge-modal{position:fixed;inset:0;z-index:10000;background:rgba(16,24,40,.55);display:flex;align-items:center;justify-content:center;padding:20px}.cnx-badge-box{position:relative;background:#fff;border-radius:16px;max-width:520px;width:100%;padding:26px;max-height:90vh;overflow:auto;font-family:'Source Sans 3',system-ui,sans-serif}" +
      ".cnx-badge-box h3{font-family:'Newsreader',Georgia,serif;font-size:24px;margin:0 0 6px;color:#101828}.cnx-badge-box p{color:#475467;margin:0 0 16px}.cnx-badge-x{position:absolute;top:10px;right:14px;border:0;background:none;font-size:26px;cursor:pointer;color:#667085}" +
      ".cnx-badge-opt{margin:0 0 18px}.cnx-badge-prev{padding:16px;border-radius:10px;margin:0 0 8px;display:flex;justify-content:center}.cnx-badge-light .cnx-badge-prev{background:#F2F4F7}.cnx-badge-dark .cnx-badge-prev{background:#0B1220}" +
      ".cnx-badge-opt textarea{width:100%;box-sizing:border-box;font:12px/1.4 'JetBrains Mono',ui-monospace,Menlo,monospace;border:1px solid #D0D5DD;border-radius:8px;padding:8px;margin:0 0 8px;resize:none;color:#344054}" +
      ".cnx-fv{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:#ECFDF3;color:#067647;border:1px solid #ABEFC6;font:600 11px/1.5 'Source Sans 3',system-ui,sans-serif;vertical-align:middle}" +
      ".cnx-claim{display:inline-block;margin:8px 0 0;font-size:13px;color:#667085;text-decoration:underline}.cnx-claim:hover{color:#B4520C}" +
      ".cn-actions .cnx-claim{margin:0 0 0 12px;align-self:center}" +
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
    if (r.fv) { var nm2 = li.querySelector(".cn-card-name"); if (nm2 && !nm2.querySelector(".cnx-fv")) nm2.insertAdjacentHTML("beforeend", '<span class="cnx-fv" title="Details confirmed by the firm">\u2713 Verified by the firm</span>'); }
    if (!li.querySelector(".cnx-claim")) {
      var cl = document.createElement("a"); cl.className = "cnx-claim"; cl.href = claimUrl(r); cl.textContent = r.fv ? "Update this listing" : "Is this your firm?";
      if (foot === li) li.appendChild(cl); else foot.parentNode.insertBefore(cl, foot.nextSibling);
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
      if (!acts.querySelector(".cnx-claim")) { var c2 = document.createElement("a"); c2.className = "cnx-claim"; c2.href = claimUrl(r); c2.textContent = r.fv ? "Update this listing" : "Is this your firm?"; acts.appendChild(c2); }
      if (!acts.querySelector(".cnx-badge-link")) { var bl = document.createElement("a"); bl.className = "cnx-claim cnx-badge-link"; bl.href = "#"; bl.textContent = "Get a \u201cListed on Colaeb\u201d badge"; bl.addEventListener("click", function (e) { e.preventDefault(); openBadge(r); }); acts.appendChild(bl); }
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
  // Firms that confirmed their listing from a company email (investors/enrich/firm-verified.json).
  var VERIFIED = CFG.firmVerified || "https://cdn.jsdelivr.net/gh/stopwatchcreative/colaeb-world-economies@main/investors/enrich/firm-verified.json";
  var verified = {};
  // ---------------------------------------------------------------- "New this week" strip
  // investors/enrich/first-seen.json maps h:<host> / n:<name> to the date a firm first appeared.
  var firstSeen = {};
  function seenOn(r) { var h = host(r.website); return (h && firstSeen["h:" + h]) || firstSeen["n:" + String(r.name || "").toLowerCase().trim()] || ""; }
  function newThisWeek(items) {
    var dir = document.querySelector('[data-cn="directory"]'); if (!dir || document.querySelector(".cnx-new")) return;
    var since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    var fresh = items.filter(function (r) { return seenOn(r) >= since; })
      .sort(function (a, b) { return seenOn(b) < seenOn(a) ? -1 : seenOn(b) > seenOn(a) ? 1 : 0; });
    if (!fresh.length) return;
    var sec = document.createElement("div"); sec.className = "cnx-new";
    sec.innerHTML = '<p class="cnx-new-head"><b>New this week</b> · ' + fresh.length + " investor" + (fresh.length === 1 ? "" : "s") + " added</p><ul>" +
      fresh.slice(0, 16).map(function (r) {
        var where = [r.city, r.country].filter(Boolean)[0] || "";
        return '<li><a href="?member=' + encodeURIComponent(r.slug) + '" data-slug="' + esc(r.slug) + '">' + esc(r.name) + (where ? "<span>" + esc(where) + "</span>" : "") + "</a></li>";
      }).join("") + "</ul>";
    sec.addEventListener("click", function (e) {
      var a = e.target.closest("a[data-slug]"); if (!a) return;
      track("new_this_week_click", { firm: a.getAttribute("data-slug") });
      if (window.CN && window.CN.pick && window.CN.pick(a.getAttribute("data-slug"))) e.preventDefault();
    });
    dir.parentNode.insertBefore(sec, dir);
  }

  // ---------------------------------------------------------------- "Listed on Colaeb" badge for firms' own sites
  var BADGE = "https://cdn.jsdelivr.net/gh/stopwatchcreative/colaeb-world-economies@main/investors/badge/";
  function badgeCode(r, dark) {
    var link = "https://colaeb.com" + (r.profile || "/investors?member=" + encodeURIComponent(r.slug));
    return '<a href="' + link + '" target="_blank" rel="noopener" title="' + esc(r.name) + ' on the Colaeb Investor List"><img src="' + BADGE + "listed-on-colaeb-" + (dark ? "dark" : "light") + '.svg" alt="Listed on Colaeb" width="200" height="56"></a>';
  }
  function openBadge(r) {
    var old = document.querySelector(".cnx-badge-modal"); if (old) old.remove();
    var m = document.createElement("div"); m.className = "cnx-badge-modal"; m.setAttribute("role", "dialog"); m.setAttribute("aria-label", "Listed on Colaeb badge");
    m.innerHTML = '<div class="cnx-badge-box"><button type="button" class="cnx-badge-x" aria-label="Close">×</button>' +
      "<h3>Show founders you’re on Colaeb</h3><p>Add this badge to your website. It links to " + esc(r.name) + "’s listing.</p>" +
      ["light", "dark"].map(function (v) {
        var code = badgeCode(r, v === "dark");
        return '<div class="cnx-badge-opt cnx-badge-' + v + '"><div class="cnx-badge-prev">' + code.replace(/target="_blank"/, 'target="_blank" tabindex="-1"') + '</div><textarea readonly rows="3">' + esc(code) + '</textarea><button type="button" class="cn-btn cnx-badge-copy">Copy ' + v + " badge code</button></div>";
      }).join("") + "</div>";
    m.addEventListener("click", function (e) {
      if (e.target === m || e.target.closest(".cnx-badge-x")) { m.remove(); return; }
      var c = e.target.closest(".cnx-badge-copy"); if (!c) return;
      var ta = c.parentNode.querySelector("textarea"); ta.select();
      (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).catch(function () { document.execCommand("copy"); });
      c.textContent = "Copied"; track("badge_copy", { firm: r.name });
    });
    document.body.appendChild(m);
  }

  function claimUrl(r) {
    var form = document.getElementById("list-your-firm") ? location.pathname : "/investors";
    return form + "?update=1&firm=" + encodeURIComponent(r.name || "") + (r.website && !/linkedin\.com/.test(r.website) ? "&site=" + encodeURIComponent(r.website) : "") + "#list-your-firm";
  }
  function attach(deals, profiles) {
    var items = (window.CN && window.CN.items && window.CN.items()) || [];
    items.forEach(function (r) {
      bySlug[r.slug] = r; byName[keyName(r.name)] = r;
      var h = host(r.website);
      var d = (h && deals["h:" + h]) || deals["n:" + keyName(r.name)];
      if (d && d.length) r.deals = d;
      var sl = (h && profiles["h:" + h]) || profiles["n:" + keyName(r.name)];
      if (sl) r.profile = "/investors/" + sl;
      if ((h && verified["h:" + h]) || verified["n:" + keyName(r.name)]) r.fv = 1;
    });
    ready = true;
    activeFirst(items);
    if (window.CN.refresh) window.CN.refresh();
    liveCounts(items.length);
    updatedLine(items);
    newThisWeek(items);
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
    Promise.all([get(DEALS), get(PROFILES), get(VERIFIED), CFG.firstSeen ? get(CFG.firstSeen) : Promise.resolve({})]).then(function (a) { UPDATED = (a[0] && a[0].updated) || ""; verified = a[2] || {}; firstSeen = a[3] || {}; attach((a[0] && a[0].deals) || {}, a[1] || {}); });
    new MutationObserver(function (muts) { if (!ready) return; muts.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); }); }); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (window.CN) start(); else document.addEventListener("cn:ready", start, { once: true });
})();
