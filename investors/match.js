/*! Colaeb Investor Match (quick version): founders describe their company, the page ranks investors from the
 * Colaeb Investor List and shows the matches on the globe and in the directory.
 *
 * Markup: a Webflow form with data-cn-match on the <form> and fields named
 *   company, website, deck, email, stage, sector, location, country, raise, revenue
 * plus an element with data-cn-match-out for the summary. The Webflow form still submits normally, so every
 * request is saved in Webflow Forms; this script only adds the matching. Needs cn.js (window.CN, "cn:ready").
 *
 * Scoring uses what the list knows: investor type, stage and focus (when the source had them), city/state and
 * country, recent fund and Colaeb-verified status. Investors without stage/sector data still match on type and
 * location. Improve accuracy over time by enriching investors-feed.json with stage, focus and check size.
 */
(function () {
  "use strict";
  var SECTORS = {
    "Creator economy & media": /creator|influencer|media|entertain|music|content|social media|culture|\bfans?\b|streaming|live video/,
    "Fintech & payments": /fintech|payment|financ|bank|insur|crypto|web3|blockchain|lending/,
    "Consumer & e-commerce": /consumer|e-?commerce|dtc|d2c|retail|marketplace|brand|cpg|lifestyle/,
    "SaaS & B2B software": /saas|b2b|enterprise|software|devtool|productivity|future of work/,
    "AI & data": /\bai\b|artificial|machine learning|applied ai|\bdata\b|analytics/,
    "Health & life sciences": /health|bio|medtech|medical|life science|pharma|wellness|care/,
    "Climate & energy": /climate|energy|cleantech|sustainab|carbon|mobility|water/,
    "Deep tech & hardware": /deep|hardware|robot|space|semiconductor|quantum|iot|industrial|defen[cs]e/,
    "Education": /edtech|educat|learning|school/,
    "Real estate & proptech": /proptech|real estate|construction|housing/,
    "Food & agriculture": /food|agri|agtech|farm|beverage/,
    "Gaming & sports": /gaming|game|esport|sport|fitness/
  };
  var RELATED = { // second-choice sectors that still fit
    "Creator economy & media": ["Consumer & e-commerce", "Fintech & payments", "Gaming & sports"],
    "Fintech & payments": ["SaaS & B2B software"], "Consumer & e-commerce": ["Creator economy & media"],
    "Gaming & sports": ["Creator economy & media", "Consumer & e-commerce"], "AI & data": ["SaaS & B2B software"]
  };
  var STATES = "AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|DE Delaware|DC District of Columbia|FL Florida|GA Georgia|HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas|KY Kentucky|LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|MN Minnesota|MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|RI Rhode Island|SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|VA Virginia|WA Washington|WV West Virginia|WI Wisconsin|WY Wyoming"
    .split("|").map(function (s) { return [s.slice(0, 2), s.slice(3)]; });
  var REGIONS = { // neighbouring states count as "nearby"
    Midwest: "OH MI IN IL WI MN IA MO KS NE ND SD KY PA", Northeast: "NY NJ PA CT MA RI VT NH ME DE MD DC",
    South: "TX FL GA NC SC TN AL MS LA AR OK VA KY WV", West: "CA WA OR NV AZ UT CO ID MT WY NM AK HI"
  };
  var TOP = 60;
  function norm(s) { return String(s || "").toLowerCase(); }
  function stateOf(text) {
    var t = " " + String(text || "") + " ";
    for (var i = 0; i < STATES.length; i++) {
      if (new RegExp("[ ,]" + STATES[i][0] + "(?=[ ,.]|$)").test(t) || norm(t).indexOf(norm(STATES[i][1])) > -1) return STATES[i][0];
    }
    return "";
  }
  function region(st) { for (var k in REGIONS) if (REGIONS[k].split(" ").indexOf(st) > -1) return k; return ""; }
  function money(s) {
    var m = String(s || "").replace(/,/g, "").match(/([\d.]+)\s*(k|m|mm|million|thousand)?/i); if (!m) return 0;
    var v = parseFloat(m[1]), u = norm(m[2]); return u === "k" || u === "thousand" ? v * 1e3 : (u ? v * 1e6 : v);
  }
  function stageRe(st) { return st === "pre-seed" ? /pre-?seed|angel|idea|first check/ : st === "seed" ? /seed/ : /series ?a|early|growth|late|expansion/; }

  function score(r, q) {
    var s = 0, why = [];
    var type = r.industry || r.group || "", ex = r.extra || {};
    var stageTxt = norm(ex.stage), focusTxt = norm(ex.focus), all = norm([focusTxt, r.summary].join(" ")) + (focusTxt || r.summary ? "" : " " + norm(r.name));
    // stage
    if (stageTxt) {
      if (stageRe(q.stage).test(stageTxt)) { s += 4; why.push(q.stageLabel); } else s -= 3;
    }
    if (/accelerator/i.test(type)) { s += q.stage === "pre-seed" ? 3 : q.stage === "seed" ? 1 : -3; if (q.stage !== "series-a") why.push("Accelerator"); }
    else if (/angel/i.test(type)) { s += q.stage === "pre-seed" ? 3 : q.stage === "seed" ? 2 : -2; why.push(/network/i.test(type) ? "Angel network" : "Angel"); }
    else if (/corporate/i.test(type)) s += q.stage === "series-a" ? 1 : -1;
    else if (/government/i.test(type)) s += 0;
    // sector
    if (q.sector && SECTORS[q.sector]) {
      if (SECTORS[q.sector].test(all)) { s += focusTxt ? 5 : 4; why.push(q.sector.split(" & ")[0] + " focus"); }
      else if ((RELATED[q.sector] || []).some(function (k) { return SECTORS[k].test(all); })) { s += 2; why.push("Adjacent focus"); }
      else if (/generalist|sector.agnostic|agnostic/.test(all)) { s += 2; why.push("Generalist"); }
      else if (focusTxt) s -= 2;
    }
    // location
    var rc = norm(r.country), qc = norm(q.country);
    if (qc && rc) {
      if (rc === qc || (qc === "united states" && /^(us|usa|united states)$/.test(rc))) {
        s += 2;
        if (q.state) {
          var rs = stateOf(r.city);
          if (rs && rs === q.state) { s += 3; why.push(q.stateName || q.state); }
          else if (rs && region(rs) && region(rs) === region(q.state)) { s += 1; why.push(region(rs)); }
        } else if (q.city && norm(r.city).indexOf(norm(q.city)) > -1) { s += 3; why.push(q.city); }
        else if (!q.state) why.push(r.country);
      } else s -= 2;
    }
    // freshness and trust
    var yr = String(ex.raised || "").match(/(20\d\d)/); if (yr && +yr[1] >= 2022) { s += 1; why.push("Raised a fund in " + yr[1]); }
    if (r.featured) { s += 1; why.push("Colaeb verified"); }
    // recently active: led or backed a round covered by YourInfoDaily (extras.js attaches r.deals)
    if (r.deals && r.deals.length) {
      var d = r.deals[0], age = (Date.now() - Date.parse(d.d)) / 864e5, mo = new Date(d.d).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
      if (age <= 180) { s += d.r === "led" ? 3 : 2; why.push((d.r === "led" ? "Led a round " : "Backed a round ") + mo); }
      else if (age <= 365) { s += 1; why.push("Active in the last year"); }
    }
    // check size vs raise
    var chk = String(ex.check || ""); if (chk && q.raise) {
      var parts = chk.split(/[-–to]+/).map(money).filter(Boolean), lo = Math.min.apply(null, parts), hi = Math.max.apply(null, parts);
      if (parts.length && lo <= q.raise && hi >= q.raise * 0.05) { s += 1; why.push("Check size fits"); }
    }
    return { r: r, score: s, why: why.filter(function (w, i, a) { return w && a.indexOf(w) === i; }).slice(0, 4) };
  }

  function rank(q) {
    var items = (window.CN && window.CN.items()) || [];
    return items.filter(function (r) { return r.website; }).map(function (r) { return score(r, q); })
      .filter(function (m) { return m.score > 2; })
      .sort(function (a, b) { return b.score - a.score || (b.r.featured - a.r.featured) || a.r.name.localeCompare(b.r.name); });
  }

  function read(form) {
    var v = typeof form === "function" ? form : function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? String(el.value || "").trim() : ""; };
    var stage = norm(v("stage")).replace(/\s+/g, "-"); if (!/pre-seed|seed|series-a/.test(stage)) stage = "seed";
    var loc = v("location"), st = stateOf(loc), stName = "";
    STATES.forEach(function (x) { if (x[0] === st) stName = x[1]; });
    return {
      company: v("company"), email: v("email"), stage: stage, stageLabel: stage === "pre-seed" ? "Pre-seed" : stage === "seed" ? "Seed" : "Series A",
      sector: v("sector"), country: v("country") || "United States", city: loc.split(",")[0].trim(), state: st, stateName: stName,
      raise: money(v("raise")), revenue: money(v("revenue"))
    };
  }

  function csv(list) {
    var rows = [["Rank", "Investor", "Type", "Location", "Website", "Why it matches"]];
    list.forEach(function (m, i) { rows.push([i + 1, m.r.name, m.r.industry || "", m.r.place || [m.r.city, m.r.country].filter(Boolean).join(", "), m.r.website, (m.why || []).join("; ")]); });
    return rows.map(function (r) { return r.map(function (c) { c = String(c == null ? "" : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(","); }).join("\n");
  }
  // Google Analytics (gtag is on every colaeb.com page). Company names only, never emails.
  function track(name, params) { try { if (window.gtag) window.gtag("event", name, params); } catch (e) {} }
  function download(list, q) {
    track("csv_download", { company: q.company || "", website: ((document.querySelector("#cnm-website") || {}).value || ""), match_count: list.length, stage: q.stageLabel || "", sector: q.sector || "" });
    var blob = new Blob([csv(list)], { type: "text/csv" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = ((q.company || "my") + "-investor-matches.csv").replace(/[^\w.-]+/g, "-").toLowerCase();
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  // Shareable link: the match inputs only (never the email, website or deck), so anyone opening it sees the same ranked list.
  var SHARE_KEYS = ["company", "stage", "sector", "location", "country", "raise"];
  function shareUrl(q) {
    var p = new URLSearchParams();
    p.set("match", "1");
    if (q.company) p.set("company", q.company);
    p.set("stage", q.stageLabel); if (q.sector) p.set("sector", q.sector);
    if (q.city || q.state) p.set("location", [q.city, q.state].filter(Boolean).join(", "));
    if (q.country) p.set("country", q.country);
    if (q.raise) p.set("raise", String(q.raise));
    return location.origin + location.pathname + "?" + p.toString() + "#investor-match";
  }
  function share(q, n, btn) {
    var url = shareUrl(q), title = n + " investors that match " + (q.company || "my startup") + " | Colaeb";
    track("share_matches", { match_count: n, stage: q.stageLabel || "", sector: q.sector || "" });
    function done(t) { var old = btn.textContent; btn.textContent = t; setTimeout(function () { btn.textContent = old; }, 2500); }
    if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) { navigator.share({ title: title, url: url }).catch(function () {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { done("Link copied"); }, function () { done("Copy failed"); });
    else { var i = document.createElement("input"); i.value = url; document.body.appendChild(i); i.select(); try { document.execCommand("copy"); done("Link copied"); } catch (e) { done("Copy failed"); } i.remove(); }
  }
  function sharedQuery() {
    var p = new URLSearchParams(location.search); if (p.get("match") !== "1") return null;
    return read(function (n) { return String(p.get(n) || "").trim().slice(0, 120); });
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function summary(out, q, all) {
    if (!out) return;
    out.innerHTML = "";
    var p = el("div", "cnm-result");
    var top = all.slice(0, 3).map(function (m) { return m.r.name; });
    p.appendChild(el("p", "cnm-result-title", all.length ? all.length + " investors match " + (q.company || "your company") : "No strong matches yet"));
    p.appendChild(el("p", "cnm-result-text", all.length
      ? "Top matches: " + top.join(", ") + ". All " + all.length + " are highlighted on the globe." + (q.email ? " We'll also email your matches to " + q.email + "." : "")
      : "Try a broader sector, or leave location as just your country."));
    if (all.length) { var hint = el("p", "cnm-result-text cnm-result-hint", "\u2193 Your full list of " + all.length + " matches is below the map, ranked best match first."); hint.style.fontWeight = "700"; p.appendChild(hint); }
    if (all.length) {
      var row = el("div", "cnm-actions");
      var b = el("button", "cnm-btn", "See my matches"); b.type = "button";
      b.onclick = function () { var g = document.querySelector('[data-cn="directory"]') || document.querySelector('[data-cn="globe"]'); if (g) g.scrollIntoView({ behavior: "smooth", block: "start" }); };
      row.appendChild(b);
      var dl = el("button", "cnm-btn cnm-btn-ghost", "Download list (CSV)"); dl.type = "button";
      dl.onclick = function () { download(all, q); };
      row.appendChild(dl);
      var sh = el("button", "cnm-btn cnm-btn-ghost", "Share my matches"); sh.type = "button";
      sh.onclick = function () { share(q, all.length, sh); };
      row.appendChild(sh);
      p.appendChild(row);
    }
    var again = el("button", "cnm-link", "Edit details"); again.type = "button";
    again.onclick = function () { var f = document.querySelector("form[data-cn-match]"); if (f) { f.style.display = ""; var w = f.parentNode, d = w && w.querySelector(".w-form-done"); if (d) d.style.display = "none"; f.scrollIntoView({ behavior: "smooth", block: "center" }); } };
    p.appendChild(again);
    out.appendChild(p);
  }
  // Hidden fields so the Webflow submission (and the follow-up email automation) carries the matches.
  var EMAIL_TOP = 25;
  function hidden(form, name, label) {
    var f = form.querySelector('[name="' + name + '"]');
    if (!f) { f = document.createElement("textarea"); f.name = name; f.setAttribute("data-name", label); f.style.display = "none"; f.setAttribute("aria-hidden", "true"); f.tabIndex = -1; form.appendChild(f); }
    return f;
  }
  function fill(form) {
    if (!window.CN) return null;
    var q = read(form), all = rank(q);
    hidden(form, "match_count", "match_count").value = String(all.length);
    hidden(form, "matches", "matches").value = all.slice(0, EMAIL_TOP).map(function (m, i) {
      return (i + 1) + ". " + m.r.name + " (" + [m.r.industry, m.r.place || m.r.country].filter(Boolean).join(", ") + ") " + m.r.website + (m.why && m.why.length ? " | " + m.why.join(", ") : "");
    }).join("\n");
    hidden(form, "matches_html", "matches_html").value = "<ol>" + all.slice(0, EMAIL_TOP).map(function (m) {
      var esc = function (t) { return String(t || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
      return '<li><a href="' + esc(m.r.website) + '">' + esc(m.r.name) + "</a> &middot; " + esc([m.r.industry, m.r.place || m.r.country].filter(Boolean).join(", ")) + (m.why && m.why.length ? "<br><small>" + esc(m.why.join(" · ")) + "</small>" : "") + "</li>";
    }).join("") + "</ol>";
    return { q: q, all: all };
  }

  function bind() {
    document.querySelectorAll("form[data-cn-match]").forEach(function (form) {
      if (form.__cnm) return; form.__cnm = 1;
      // Repair what the Webflow importer changed: option labels cut at "&", the empty Seed value, the location field name.
      [].forEach.call(form.querySelectorAll("select option"), function (o) {
        if (!o.value && o.textContent.trim()) o.value = o.textContent.trim();
        if (o.value && o.textContent.trim() !== o.value) o.textContent = o.value;
      });
      var st = form.querySelector('[name="stage"]'); if (st) st.value = "Seed";
      // Reject emails without a real domain (e.g. "name@company"), so the matches email can be delivered.
      var em = form.querySelector('[name="email"]');
      if (em) { em.setAttribute("pattern", "[^@\\s]+@[^@\\s]+\\.[A-Za-z]{2,}"); em.setAttribute("title", "Enter a full email address, like you@company.com"); }
      var loc = form.querySelector("#cnm-location"); if (loc) { loc.name = "location"; loc.setAttribute("data-name", "Location"); }
      var t; function live() { clearTimeout(t); t = setTimeout(function () { fill(form); }, 250); }
      form.addEventListener("input", live); form.addEventListener("change", live);
      if (window.CN) fill(form); else document.addEventListener("cn:ready", function () { fill(form); }, { once: true });
      document.addEventListener("cn:deals", function () { fill(form); });
      var sq = sharedQuery();
      if (sq) {
        var shown = false;
        var showShared = function () {
          if (shown) return; shown = true;
          var all = rank(sq);
          window.CN.setMatches(all, sq.company);
          var out = document.querySelector("[data-cn-match-out]") || (form.parentNode && form.parentNode.querySelector(".w-form-done"));
          if (!out) return;
          form.style.display = "none"; out.style.display = "block";
          summary(out, sq, all);
          var note = el("p", "cnm-result-text", "This is a shared Investor Match list. Want matches for your own company? Use Edit details below, it\u2019s free.");
          var box = out.querySelector(".cnm-result"); if (box) box.insertBefore(note, box.children[1] || null);
          track("shared_matches_view", { match_count: all.length });
        };
        var go = function () { document.addEventListener("cn:deals", showShared, { once: true }); setTimeout(showShared, 4000); };
        if (window.CN) go(); else document.addEventListener("cn:ready", go, { once: true });
      }
      form.addEventListener("submit", function () {
        function val(n) { var e = form.querySelector('[name="' + n + '"]'); return e ? e.value : ""; }
        function run() {
          var res = fill(form) || { q: read(form), all: [] };
          window.CN && window.CN.setMatches(res.all, res.q.company);
          summary(document.querySelector("[data-cn-match-out]") || (form.parentNode && form.parentNode.querySelector(".w-form-done")), res.q, res.all);
        }
        track("investor_match_submit", { company: val("company"), website: val("website"), stage: val("stage"), sector: val("sector") });
        if (window.CN) run(); else document.addEventListener("cn:ready", run, { once: true });
      });
    });
  }
  window.CNMatch = { rank: rank, score: score, read: read };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
})();
