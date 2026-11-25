/* Thanksgiving promo ribbon, inserted right under header.hp-nav-header on every page.
   Hides itself after END. To run a new promo, change TEXT/CODE/END and the storage key. */
(function () {
  var END = Date.parse("2026-12-01T04:59:59Z");            // 11:59 pm ET, Mon Nov 30 2026
  var CODE = "THANKSGIVING", KEY = "cpr_tg26_off";
  if (Date.now() > END || window.top !== window || window.__cpr) return; window.__cpr = 1;
  var P = location.pathname.toLowerCase();
  if (/^\/(insider-access|welcome-to-insider-access|deals|checkout|order-confirmation)/.test(P)) return;
  try { if (sessionStorage.getItem(KEY)) return; } catch (e) {}
  function ga(n, p) { try { window.gtag && gtag("event", n, p || {}); } catch (e) {} }

  function item() {
    return '<span class="cpr-item"><span class="cpr-dot"></span>Thanksgiving Holiday Promotion: <b>50% off month one</b> on All Plans!' +
      '<span class="cpr-dot"></span>Enter <button class="cpr-code" type="button" title="Copy code">' + CODE + '</button> as a promotion code at checkout.</span>';
  }
  function build() {
    var nav = document.querySelector("header.hp-nav-header");
    if (!nav || document.querySelector(".cpr")) return;
    var once = item() + item() + item();
    var el = document.createElement("div");
    el.className = "cpr"; el.setAttribute("role", "region"); el.setAttribute("aria-label", "Thanksgiving promotion");
    el.innerHTML =
      '<div class="cpr-in">' +
        '<span class="cpr-tag"><i aria-hidden="true">🦃</i>Holiday Deal</span>' +
        '<div class="cpr-track"><div class="cpr-row">' + once + '<span aria-hidden="true" style="display:contents">' + once + '</span></div></div>' +
        '<a class="cpr-cta" href="/#plans">Claim 50% off</a>' +
        '<button class="cpr-x" type="button" aria-label="Dismiss promotion">×</button>' +
      '</div>';
    nav.insertAdjacentElement("afterend", el);
    // Keep the menu on top when it is sticky, and let the ribbon scroll away under it.
    try { if (getComputedStyle(nav).position === "sticky" && !nav.style.zIndex) nav.style.zIndex = "50"; } catch (e) {}

    var toast = document.createElement("div"); toast.className = "cpr-toast"; document.body.appendChild(toast);
    el.addEventListener("click", function (e) {
      var c = e.target.closest(".cpr-code");
      if (!c) return;
      var done = function () { toast.textContent = "Code " + CODE + " copied. Paste it at checkout."; toast.classList.add("on"); setTimeout(function () { toast.classList.remove("on"); }, 2400); };
      try { navigator.clipboard.writeText(CODE).then(done, done); } catch (er) { done(); }
      ga("promo_code_copy", { promo: "thanksgiving_2026", page: P });
    });
    el.querySelector(".cpr-cta").addEventListener("click", function () { ga("promo_click", { promo: "thanksgiving_2026", placement: "ribbon", page: P }); });
    el.querySelector(".cpr-x").addEventListener("click", function () {
      try { sessionStorage.setItem(KEY, "1"); } catch (e) {}
      el.style.transition = "opacity .25s, max-height .35s"; el.style.maxHeight = el.offsetHeight + "px";
      requestAnimationFrame(function () { el.style.opacity = "0"; el.style.maxHeight = "0"; });
      setTimeout(function () { el.remove(); }, 400);
      ga("promo_dismiss", { promo: "thanksgiving_2026" });
    });
    ga("promo_view", { promo: "thanksgiving_2026", placement: "ribbon", page: P });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
