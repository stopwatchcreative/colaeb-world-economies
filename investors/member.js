/* Colaeb membership popup on /investors (Investor Match).
   1) "before": shown when a founder submits the match form, before they go to their list. They choose:
      join Starter, see other plans, or "No thanks, show my matches".
   2) "after": shown once after they've spent time with their list (or downloaded it), if they didn't join.
   The Webflow form submission and the matching itself are untouched. */
(function () {
  if (window.__cmb) return; window.__cmb = 1;
  var STARTER = { name: "Starter", price: "$4.95", per: "/month", link: "https://buy.stripe.com/cN25kq5T70T2aFWcMW",
                  yearly: "https://buy.stripe.com/5kAdQWepD6dm3du6ox", yearlyLabel: "or $47.95 for the year" };
  var OTHERS = [
    { name: "Connect", price: "$35", per: "/mo", note: "Adds lead generation, network promotion and SEO", link: "https://buy.stripe.com/bIY6ou6Xb9pyaFWdRm" },
    { name: "Growth", price: "$95", per: "/mo", note: "Curated leads, on-demand support, landing pages", link: "https://buy.stripe.com/9AQ6ou6XbbxGg0gfZv" },
    { name: "Launch", price: "$300", per: "/mo", note: "Premium lead matching and done-for-you outreach", link: "https://buy.stripe.com/dR6cMSbdratCbK09B1" }
  ];
  var K_JOINED = "cmb_joined", K_AFTER = "cmb_after_shown";
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function ga(n, p) { try { window.gtag && gtag("event", n, p || {}); } catch (e) {} }
  function esc(t) { return String(t || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function goToList() {
    var g = document.querySelector('[data-cn="directory"]') || document.querySelector('[data-cn="globe"]') || document.querySelector("[data-cn-match-out]");
    if (g) g.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  function open(when, company) {
    if (document.querySelector(".cmb-ov") || ss(K_JOINED)) return;
    var before = when === "before";
    var who = company ? esc(company) : "your startup";
    var ov = document.createElement("div");
    ov.className = "cmb-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-labelledby", "cmb-h");
    ov.innerHTML =
      '<div class="cmb-card">' +
        '<button class="cmb-x" type="button" aria-label="Close">&times;</button>' +
        '<span class="cmb-eb">' + (before ? "Your matches are ready" : "Ready for warm introductions?") + '</span>' +
        '<h2 class="cmb-h" id="cmb-h">' + (before ? "Want a hand reaching these investors?" : "Turn " + who + "’s list into conversations") + '</h2>' +
        '<p class="cmb-lede">Colaeb members get more than a list. For about the price of <b>a cup of coffee a month</b>, we can:</p>' +
        '<ul class="cmb-list">' +
          '<li><b>Personalize your matches</b> to your raise, stage and story</li>' +
          '<li><b>Introduce you to investors we work closely with</b></li>' +
          '<li><b>Promote your business</b> to our network</li>' +
          '<li><b>Connect you with experts</b> and potential business partners</li>' +
        '</ul>' +
        '<div class="cmb-plan">' +
          '<div class="cmb-plan-top"><span class="cmb-plan-name">Starter</span><span class="cmb-price">' + STARTER.price + '<small>' + STARTER.per + '</small></span></div>' +
          '<a class="cmb-join" href="' + STARTER.link + '" target="_blank" rel="noopener" data-plan="starter">Join Starter for ' + STARTER.price + '/month →</a>' +
          '<a class="cmb-yearly" href="' + STARTER.yearly + '" target="_blank" rel="noopener" data-plan="starter_year">' + STARTER.yearlyLabel + '</a>' +
        '</div>' +
        '<p class="cmb-appeal">❤️ Your membership also keeps the Colaeb Investor List <b>free for every founder</b>.</p>' +
        '<button class="cmb-more" type="button" aria-expanded="false">See other plans</button>' +
        '<div class="cmb-others" hidden>' +
          OTHERS.map(function (p) {
            return '<a class="cmb-opt" href="' + p.link + '" target="_blank" rel="noopener" data-plan="' + p.name.toLowerCase() + '"><span><b>' + p.name + '</b><em>' + p.note + '</em></span><strong>' + p.price + '<small>' + p.per + '</small></strong></a>';
          }).join("") +
          '<a class="cmb-all" href="/#plans" data-plan="all">Brand and agency plans →</a>' +
        '</div>' +
        '<button class="cmb-skip" type="button">' + (before ? "No thanks, show my matches →" : "Maybe later") + '</button>' +
      '</div>';
    document.body.appendChild(ov);
    var prev = document.activeElement;
    requestAnimationFrame(function () { ov.classList.add("cmb-on"); ov.querySelector(".cmb-join").focus({ preventScroll: true }); });
    ga("member_popup_view", { when: when });
    if (!before) ss(K_AFTER, "1");

    function close(how) {
      ov.classList.remove("cmb-on"); document.removeEventListener("keydown", key);
      setTimeout(function () { ov.remove(); }, 300);
      try { prev && prev.focus && prev.focus({ preventScroll: true }); } catch (e) {}
      ga("member_popup_close", { when: when, how: how });
      if (before) setTimeout(goToList, 320);
    }
    function key(e) { if (e.key === "Escape") close("esc"); }
    document.addEventListener("keydown", key);
    ov.addEventListener("click", function (e) {
      if (e.target === ov) return close("backdrop");
      var a = e.target.closest("a[data-plan]");
      if (a) { ss(K_JOINED, "1"); ga("member_popup_plan_click", { when: when, plan: a.getAttribute("data-plan") }); setTimeout(function () { close("plan"); }, 150); return; }
      if (e.target.closest(".cmb-x")) return close("x");
      if (e.target.closest(".cmb-skip")) return close("skip");
      var m = e.target.closest(".cmb-more");
      if (m) {
        var box = ov.querySelector(".cmb-others"), show = box.hidden;
        box.hidden = !show; m.setAttribute("aria-expanded", String(show)); m.textContent = show ? "Hide other plans" : "See other plans";
        if (show) ga("member_popup_more", { when: when });
      }
    });
  }

  // "after": once per visit, when the founder has spent ~25s with their list in view, or downloads it.
  var afterArmed = false, company = "";
  function armAfter() {
    if (afterArmed) return; afterArmed = true;
    var seen = 0, last = 0, timer = 0, list = document.querySelector('[data-cn="directory"]');
    function fire() { if (!ss(K_AFTER) && !ss(K_JOINED) && !document.querySelector(".cmb-ov")) open("after", company); stop(); }
    function stop() { clearInterval(timer); if (io) io.disconnect(); }
    var visible = false, io = null;
    if (list && "IntersectionObserver" in window) {
      io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.2 });
      io.observe(list);
    }
    timer = setInterval(function () {
      if (document.querySelector(".cmb-ov") || document.hidden) return;
      if (visible || !list) seen += 1;
      if (seen >= 25) fire();
    }, 1000);
    document.addEventListener("click", function (e) {
      var b = e.target.closest("button, a");
      if (b && /download|csv/i.test(b.textContent || "")) setTimeout(fire, 1200);
    });
  }

  function bind() {
    document.querySelectorAll("form[data-cn-match]").forEach(function (form) {
      if (form.__cmb) return; form.__cmb = 1;
      form.addEventListener("submit", function () {
        var c = form.querySelector('[name="company"]'); company = c ? String(c.value || "").trim() : "";
        // Let the matching and the Webflow submission run first, then offer membership.
        setTimeout(function () { open("before", company); armAfter(); }, 700);
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
})();
