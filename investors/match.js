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
    "Creator economy & media": /creator|media|entertain|music|content|social|community|culture|fan|streaming/,
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
    var stageTxt = norm(ex.stage), focusTxt = norm(ex.focus), all = norm([r.name, focusTxt, r.summary].join(" "));
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
    function v(n) { var el = form.querySelector('[name="' + n + '"]'); return el ? String(el.value || "").trim() : ""; }
    var stage = norm(v("stage")).replace(/\s+/g, "-"); if (!/pre-seed|seed|series-a/.test(stage)) stage = "seed";
    var loc = v("location"), st = stateOf(loc), stName = "";
    STATES.forEach(function (x) { if (x[0] === st) stName = x[1]; });
    return {
      company: v("company"), stage: stage, stageLabel: stage === "pre-seed" ? "Pre-seed" : stage === "seed" ? "Seed" : "Series A",
      sector: v("sector"), country: v("country") || "United States", city: loc.split(",")[0].trim(), state: st, stateName: stName,
      raise: money(v("raise")), revenue: money(v("revenue"))
    };
  }

  function summary(out, q, list) {
    if (!out) return;
    out.innerHTML = "";
    var top = list.slice(0, 3).map(function (m) { return m.r.name; });
    var p = document.createElement("div"); p.className = "cnm-result";
    var h = document.createElement("p"); h.className = "cnm-result-title";
    h.textContent = list.length ? list.length + " investors match " + (q.company || "your company") : "No strong matches yet";
    var t = document.createElement("p"); t.className = "cnm-result-text";
    t.textContent = list.length ? "Top matches: " + top.join(", ") + ". They are now highlighted on the globe and listed below, best match first."
      : "Try a broader sector, or leave location as just your country.";
    p.appendChild(h); p.appendChild(t);
    if (list.length) {
      var b = document.createElement("button"); b.type = "button"; b.className = "cnm-btn"; b.textContent = "See my matches";
      b.onclick = function () { var g = document.querySelector('[data-cn="globe"]'); if (g) g.scrollIntoView({ behavior: "smooth", block: "start" }); };
      p.appendChild(b);
    }
    var again = document.createElement("button"); again.type = "button"; again.className = "cnm-link"; again.textContent = "Edit details";
    again.onclick = function () { var f = document.querySelector("form[data-cn-match]"); if (f) { f.style.display = ""; var w = f.parentNode, d = w && w.querySelector(".w-form-done"); if (d) d.style.display = "none"; f.scrollIntoView({ behavior: "smooth", block: "center" }); } };
    p.appendChild(again);
    out.appendChild(p);
  }

  function bind() {
    document.querySelectorAll("form[data-cn-match]").forEach(function (form) {
      if (form.__cnm) return; form.__cnm = 1;
      form.addEventListener("submit", function () {
        var q = read(form);
        function run() {
          var list = rank(q).slice(0, 60);
          if (window.CN) window.CN.setMatches(list, q.company);
          summary(document.querySelector("[data-cn-match-out]") || (form.parentNode && form.parentNode.querySelector(".w-form-done")), q, list);
          try { localStorage.setItem("cnm-last", JSON.stringify(q)); } catch (e) {}
        }
        if (window.CN) run(); else document.addEventListener("cn:ready", run, { once: true });
      });
    });
  }
  window.CNMatch = { rank: rank, score: score, read: read };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
})();
