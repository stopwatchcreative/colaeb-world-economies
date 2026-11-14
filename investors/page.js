/* Colaeb investor pages: small page behaviours shared by /investors and the list pages. */
(function () {
  function go() {
    lists();
    document.querySelectorAll(".cn-stat-label").forEach(function (e) { if (/^verified investors$/i.test(e.textContent.trim())) e.textContent = "Investors"; });
  }

  // Internal links between the investor list pages (colaeb.com/pre-seed-investors, /investors-in-ohio, ...).
  var LISTS = {"By stage":[["pre-seed-investors","Pre-seed investors"],["seed-investors","Seed investors"],["series-a-investors","Series A investors"]],"By sector":[["ai-investors","AI investors"],["fintech-investors","Fintech investors"],["healthcare-investors","Healthcare investors"],["biotech-investors","Biotech investors"],["climate-tech-investors","Climate tech investors"],["deep-tech-investors","Deep tech investors"],["saas-investors","SaaS investors"],["consumer-investors","Consumer investors"],["edtech-investors","Edtech investors"],["cybersecurity-investors","Cybersecurity investors"],["crypto-investors","Crypto and web3 investors"]],"By location":[["investors-in-new-york","Investors in New York"],["investors-in-san-francisco","Investors in San Francisco and the Bay Area"],["investors-in-los-angeles","Investors in Los Angeles"],["investors-in-boston","Investors in Boston"],["investors-in-chicago","Investors in Chicago"],["investors-in-texas","Investors in Texas"],["investors-in-ohio","Investors in Ohio"],["investors-in-london","Investors in London"],["investors-in-the-uk","Investors in the UK"],["investors-in-australia","Investors in Australia"],["investors-in-germany","Investors in Germany"],["investors-in-france","Investors in France"],["investors-in-israel","Investors in Israel"],["investors-in-india","Investors in India"],["investors-in-canada","Investors in Canada"],["investors-in-singapore","Investors in Singapore"],["pre-seed-investors-new-york","Pre-seed investors in New York"],["pre-seed-investors-san-francisco","Pre-seed investors in San Francisco"],["pre-seed-investors-uk","Pre-seed investors in the UK"],["ai-investors-san-francisco","AI investors in San Francisco"]]};
  function lists() {
    if (document.querySelector(".cnx-lists")) return;
    var here = location.pathname.replace(/^\/+|\/+$/g, "");
    var sec = document.createElement("section"); sec.className = "cnx-lists"; sec.setAttribute("aria-label", "Browse investor lists");
    var html = '<div class="cnx-lists-inner"><p class="cnx-lists-kicker">Browse investor lists</p><h2 class="cnx-lists-title">Find investors by stage, sector and location</h2>';
    Object.keys(LISTS).forEach(function (g) {
      html += '<div class="cnx-lists-group"><h3>' + g + '</h3><ul>' + LISTS[g].map(function (l) {
        return '<li><a href="/' + l[0] + '"' + (l[0] === here ? ' aria-current="page"' : "") + ">" + l[1] + "</a></li>";
      }).join("") + "</ul></div>";
    });
    if (here !== "investors") html += '<p class="cnx-lists-all"><a href="/investors">See the full Colaeb Investor List \u2192</a></p>';
    sec.innerHTML = html + "</div>";
    var anchor = document.querySelector(".cnc") || document.querySelector("footer");
    if (anchor) anchor.parentNode.insertBefore(sec, anchor); else document.body.appendChild(sec);
  }
  var st = document.createElement("style");
  st.textContent = ".cnx-lists{padding:56px 0 8px}.cnx-lists-inner{max-width:1240px;margin:0 auto;padding:0 24px}" +
    ".cnx-lists-kicker{font:600 12px/1 'JetBrains Mono',ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#B4520C;margin:0 0 14px}" +
    ".cnx-lists-title{font-family:'Newsreader',Georgia,serif;font-weight:600;font-size:clamp(26px,3vw,36px);line-height:1.1;color:#101828;margin:0 0 22px}" +
    ".cnx-lists-group{margin:0 0 18px}.cnx-lists-group h3{font-size:14px;font-weight:700;color:#475467;margin:0 0 10px;text-transform:uppercase;letter-spacing:.06em}" +
    ".cnx-lists-group ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}" +
    ".cnx-lists-group a{display:inline-block;padding:8px 12px;border-radius:999px;border:1px solid #D0D5DD;color:#101828;font-size:14px;text-decoration:none;background:#fff}" +
    ".cnx-lists-group a:hover{border-color:#F37A23;color:#B4520C}.cnx-lists-group a[aria-current]{background:#101828;color:#fff;border-color:#101828}" +
    ".cnx-lists-all{margin:8px 0 0}.cnx-lists-all a{color:#B4520C;font-weight:600}";
  document.head.appendChild(st);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
  window.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href="#list-your-firm"]'); if (!a) return;
    var t = document.getElementById("list-your-firm"); if (!t) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var n = document.querySelector(".hp-nav-header"), off = (n ? n.getBoundingClientRect().height : 72) + 16;
    window.scrollTo({ top: t.getBoundingClientRect().top + window.pageYOffset - off, behavior: "smooth" });
    history.replaceState(null, "", "#list-your-firm");
    var f = document.getElementById("cnl-status"); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 700);
  }, true);
})();
