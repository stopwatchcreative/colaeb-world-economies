/* Colaeb investor pages: small page behaviours shared by /investors and the list pages. */
(function () {
  function go() {
    document.querySelectorAll(".cn-stat-label").forEach(function (e) { if (/^verified investors$/i.test(e.textContent.trim())) e.textContent = "Investors"; });
  }
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
