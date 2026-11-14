/* Colaeb grants list: renders [data-cn="grants"] on /investors from grants.json (GCG Grants, monthly). Hides grants whose deadline has passed. */
(function () {
  var mount = document.querySelector('[data-cn="grants"]');
  if (!mount) return;
  var SRC = mount.getAttribute("data-cn-src") || "https://cdn.jsdelivr.net/gh/stopwatchcreative/colaeb-world-economies@main/investors/grants/grants.json";
  var PAGE = 15;

  var css = '.cng{margin:0 0 8px}.cng *{box-sizing:border-box}' +
    '.cng-intro{color:var(--cn-slate,#465A69);max-width:46em;margin:0 0 18px;font-size:17px}' +
    '.cng-bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:0 0 12px}' +
    '.cng-bar .cn-search{flex:1 1 320px;margin:0}' +
    '.cng-select{font:600 14px/1 var(--cn-sans);color:var(--cn-ink,#101828);background:#fff;border:1.5px solid #C9CED6;border-radius:999px;padding:11px 34px 11px 16px;-webkit-appearance:none;appearance:none;background-image:linear-gradient(45deg,transparent 50%,#465A69 50%),linear-gradient(135deg,#465A69 50%,transparent 50%);background-position:calc(100% - 18px) 50%,calc(100% - 13px) 50%;background-size:5px 5px;background-repeat:no-repeat;cursor:pointer}' +
    '.cng .cn-chips{margin:0 0 16px}.cng .cn-chip[aria-pressed="true"]{background:var(--cn-ink,#101828);color:#fff;border-color:var(--cn-ink,#101828)}' +
    '.cng-count{font:400 13px/1.4 var(--cn-mono);color:var(--cn-mute,#7A8794);margin:0 0 8px}' +
    '.cng-list{list-style:none;margin:0;padding:0;border-top:1px solid var(--cn-line,#EAECF0)}' +
    '.cng-item{border-bottom:1px solid var(--cn-line,#EAECF0);padding:16px 0;display:grid;grid-template-columns:minmax(0,1fr) 150px 130px 92px;gap:18px;align-items:start}' +
    '.cng-name{font-weight:600;font-size:17px;line-height:1.35;margin:0;color:var(--cn-ink,#101828)}' +
    '.cng-meta{font-size:14px;color:var(--cn-slate,#465A69);margin:4px 0 0}' +
    '.cng-tag{display:inline-block;font:600 11px/1 var(--cn-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--cn-accent-ink,#B4520C);margin-right:8px}' +
    '.cng-k{display:block;font:400 11px/1 var(--cn-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--cn-mute,#7A8794);margin-bottom:6px}' +
    '.cng-v{font:600 15px/1.3 var(--cn-mono);color:var(--cn-ink,#101828)}' +
    '.cng-soon{color:var(--cn-accent-ink,#B4520C)}.cng-days{display:block;font:400 12px/1.3 var(--cn-mono);color:var(--cn-mute,#7A8794);margin-top:3px}' +
    '.cng a.cng-apply,.cng a.cng-apply:visited{display:inline-flex;justify-content:center;width:100%;padding:10px 12px;border-radius:10px;background:var(--cn-ink,#101828);color:#fff;font-weight:700;font-size:14px;text-decoration:none;transition:background .15s}.cng a.cng-apply:hover{background:var(--cn-accent,#F37A23);color:#fff}' +
    '.cng-more-btn{appearance:none;background:none;border:0;padding:0;margin:8px 0 0;font:600 14px/1 var(--cn-sans);color:var(--cn-accent-ink,#B4520C);cursor:pointer}' +
    '.cng-detail{margin:10px 0 0;font-size:15px;line-height:1.55;color:var(--cn-slate,#465A69)}.cng-detail p{margin:0 0 6px}.cng-detail b{color:var(--cn-ink,#101828)}' +
    '.cng-foot{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-top:18px}' +
    '.cng-load{appearance:none;border:1.5px solid var(--cn-ink,#101828);background:#fff;color:var(--cn-ink,#101828);font:700 15px/1 var(--cn-sans);padding:13px 20px;border-radius:10px;cursor:pointer}.cng-load:hover{background:var(--cn-ink,#101828);color:#fff}' +
    '.cng-fine{font-size:13px;color:var(--cn-mute,#7A8794);margin:0;max-width:52em}' +
    '.cng-empty{padding:28px 0;color:var(--cn-slate,#465A69)}' +
    '@media (max-width:820px){.cng-item{grid-template-columns:1fr 1fr;gap:12px}.cng-main{grid-column:1/-1}.cng-act{grid-column:1/-1}}';
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : ""; }
  var SYM = { USD: "$", EUR: "€", GBP: "£" };
  function money(n, cur) {
    if (n == null) return "Varies";
    var s = SYM[cur] || "", v;
    if (n >= 1e9) v = (n / 1e9).toFixed(n % 1e9 ? 1 : 0) + "B";
    else if (n >= 1e6) v = (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace(/\.0$/, "") + "M";
    else if (n >= 1e3) v = Math.round(n / 1e3) + "K";
    else v = String(n);
    return s + v + (s ? "" : (cur ? " " + cur : ""));
  }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function parse(d) { var p = d.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmt(d) { return MON[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear(); }

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var all = [], state = { q: "", t: "All", g: "All", shown: PAGE };

  mount.innerHTML = '<div class="cng"><p class="cng-empty">Loading open grants…</p></div>';

  fetch(SRC).then(function (r) { return r.json(); }).then(function (doc) {
    all = (doc.grants || []).filter(function (g) { return !g.d || parse(g.d) >= today; }).map(function (g) {
      g._d = g.d ? parse(g.d) : null;
      g._days = g._d ? Math.round((g._d - today) / 864e5) : null;
      g._s = (g.n + " " + g.a + " " + g.r + " " + g.f + " " + g.t + " " + g.e).toLowerCase();
      return g;
    });
    build(doc);
  }).catch(function () {
    mount.innerHTML = '<div class="cng"><p class="cng-empty">The grants list didn’t load. Refresh the page to try again.</p></div>';
  });

  function counts(list, key) { var c = {}; list.forEach(function (g) { c[g[key]] = (c[g[key]] || 0) + 1; }); return c; }

  function build(doc) {
    var tc = counts(all, "t"), gc = counts(all, "g");
    var order = ["Federal", "AI & tech", "Small business", "Workforce", "Nonprofit", "State", "Other"];
    var chips = '<button type="button" class="cn-chip" data-t="All" aria-pressed="true">All <span class="cn-chip-n">' + all.length + '</span></button>' +
      order.filter(function (t) { return tc[t]; }).map(function (t) {
        return '<button type="button" class="cn-chip" data-t="' + esc(t) + '" aria-pressed="false">' + esc(t) + ' <span class="cn-chip-n">' + tc[t] + '</span></button>';
      }).join("");
    var regions = ["North America", "Europe", "Africa", "Global"].filter(function (g) { return gc[g]; });
    var ed = doc.edition ? (function () { var p = doc.edition.split("-"); return MON[+p[1] - 1] + " " + p[0]; })() : "";
    mount.innerHTML =
      '<div class="cng">' +
      '<p class="cng-intro">Non-dilutive funding you can apply for now: ' + all.length + ' open grants from federal agencies, the EU, UK funders and foundations, for startups, small businesses, nonprofits and researchers. Grants drop off this list once their deadline passes.</p>' +
      '<div class="cng-bar"><div class="cn-search"><span class="cn-search-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></span>' +
      '<input class="cn-search-input cng-q" type="search" placeholder="Search grants by focus, funder or keyword. Try “AI” or “workforce”" aria-label="Search grants"></div>' +
      '<select class="cng-select cng-g" aria-label="Filter grants by region"><option value="All">All regions</option>' +
      regions.map(function (g) { return '<option value="' + esc(g) + '">' + esc(g) + ' (' + gc[g] + ')</option>'; }).join("") + '</select></div>' +
      '<div class="cn-chips" role="group" aria-label="Filter grants by type">' + chips + '</div>' +
      '<p class="cng-count" aria-live="polite"></p><ul class="cng-list"></ul>' +
      '<div class="cng-foot"><button type="button" class="cng-load">Show more grants</button>' +
      '<p class="cng-fine">' + (ed ? ed + " edition. " : "") + 'Funding shows the award size or total program budget as published by each funder. Confirm eligibility, amounts and deadlines on the funder’s page before applying.</p></div>' +
      '</div>';

    var q = mount.querySelector(".cng-q"), sel = mount.querySelector(".cng-g");
    var tmr;
    q.addEventListener("input", function () { clearTimeout(tmr); tmr = setTimeout(function () { state.q = q.value.trim().toLowerCase(); state.shown = PAGE; render(); }, 120); });
    sel.addEventListener("change", function () { state.g = sel.value; state.shown = PAGE; render(); });
    mount.querySelectorAll(".cn-chip").forEach(function (b) {
      b.addEventListener("click", function () {
        state.t = b.getAttribute("data-t"); state.shown = PAGE;
        mount.querySelectorAll(".cn-chip").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        render();
      });
    });
    mount.querySelector(".cng-load").addEventListener("click", function () { state.shown += PAGE; render(); });
    mount.querySelector(".cng-list").addEventListener("click", function (e) {
      var b = e.target.closest(".cng-more-btn"); if (!b) return;
      var d = b.nextElementSibling, open = b.getAttribute("aria-expanded") === "true";
      b.setAttribute("aria-expanded", open ? "false" : "true"); d.hidden = open; b.textContent = open ? "Eligibility and focus" : "Hide details";
    });
    render();
  }

  function render() {
    var words = state.q ? state.q.split(/\s+/) : [];
    var list = all.filter(function (g) {
      if (state.t !== "All" && g.t !== state.t) return false;
      if (state.g !== "All" && g.g !== state.g) return false;
      for (var i = 0; i < words.length; i++) if (g._s.indexOf(words[i]) < 0) return false;
      return true;
    });
    var ul = mount.querySelector(".cng-list");
    mount.querySelector(".cng-count").textContent = list.length + (list.length === 1 ? " open grant" : " open grants") + ", soonest deadline first";
    if (!list.length) {
      ul.innerHTML = '<li class="cng-empty">No open grants match' + (state.q ? ' “' + esc(state.q) + '”' : "") + '. Try a broader keyword or another type.</li>';
    } else {
      ul.innerHTML = list.slice(0, state.shown).map(function (g, i) {
        var u = safeUrl(g.u), soon = g._days != null && g._days <= 14;
        var days = g._days == null ? "" : (g._days === 0 ? "Closes today" : g._days === 1 ? "1 day left" : g._days + " days left");
        return '<li class="cng-item">' +
          '<div class="cng-main"><p class="cng-name">' + esc(g.n) + '</p>' +
          '<p class="cng-meta"><span class="cng-tag">' + esc(g.t) + '</span>' + esc(g.a) + (g.r ? " · " + esc(g.r) : "") + '</p>' +
          '<button type="button" class="cng-more-btn" aria-expanded="false" aria-controls="cng-d' + i + '">Eligibility and focus</button>' +
          '<div class="cng-detail" id="cng-d' + i + '" hidden>' + (g.f ? '<p><b>Focus:</b> ' + esc(g.f) + '</p>' : "") + (g.e ? '<p><b>Who can apply:</b> ' + esc(g.e) + '</p>' : "") + '</div></div>' +
          '<div><span class="cng-k">Funding</span><span class="cng-v">' + esc(money(g.amt, g.cur)) + '</span></div>' +
          '<div><span class="cng-k">Deadline</span><span class="cng-v' + (soon ? " cng-soon" : "") + '">' + (g._d ? esc(fmt(g._d)) : "Rolling") + '</span>' + (days ? '<span class="cng-days">' + days + '</span>' : "") + '</div>' +
          '<div class="cng-act">' + (u ? '<a class="cng-apply" href="' + esc(u) + '" target="_blank" rel="noopener nofollow">Details</a>' : "") + '</div>' +
          '</li>';
      }).join("");
    }
    mount.querySelector(".cng-load").hidden = list.length <= state.shown;
  }
})();
