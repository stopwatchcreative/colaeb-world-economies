/* Colaeb site-wide welcome screen (once per visitor) + "Cola", a guide who follows the
   cursor and invites visitors to join. Loaded from the Webflow site footer with welcome.css. */
(function () {
  if (window.__cw || window.top !== window) return; window.__cw = 1;
  var P = location.pathname.toLowerCase();
  var SKIP = [/^\/deals/, /^\/welcome-to-insider-access/, /^\/checkout/, /^\/order-confirmation/, /^\/onboarding/];
  if (SKIP.some(function (r) { return r.test(P); })) return;

  var JOIN = "/#plans";
  var KEY_SEEN = "cw_seen_v2", KEY_OFF = "cw_guide_off";
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function ga(n, p) { try { window.gtag && gtag("event", n, p || {}); } catch (e) {} }
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var touch = matchMedia("(hover: none), (pointer: coarse)").matches;

  var FACE =
    '<svg class="cg-svg" viewBox="0 0 86 110" aria-hidden="true">' +
      '<ellipse cx="43" cy="106" rx="22" ry="4" fill="rgba(13,43,31,.18)"/>' +
      '<path d="M22 104 L25 76 H61 L64 104 Z" fill="#16233A"/>' +                         // trousers
      '<path d="M18 80 Q17 54 30 50 H56 Q69 54 68 80 Z" fill="#1E2F4D"/>' +               // blazer
      '<path d="M36 50 H50 L43 66 Z" fill="#fff"/>' +                                    // shirt
      '<path d="M43 53 L46 57 L44 72 L43 74 L42 72 L40 57 Z" fill="#FF8A3D"/>' +         // tie
      '<path d="M30 50 L43 70 L36 50 Z M56 50 L43 70 L50 50 Z" fill="#2A3F63"/>' +       // lapels
      '<path d="M24 58 Q17 70 20 84" stroke="#1E2F4D" stroke-width="8" stroke-linecap="round" fill="none"/>' +
      '<circle cx="20" cy="85" r="4.5" fill="#2ECC71"/>' +
      '<g class="cg-arm"><path d="M62 58 Q74 50 76 36" stroke="#1E2F4D" stroke-width="8" stroke-linecap="round" fill="none"/>' +
        '<circle cx="76.5" cy="33" r="5" fill="#2ECC71"/></g>' +
      '<rect x="38" y="42" width="10" height="9" rx="3" fill="#1F9A55"/>' +              // neck
      '<circle cx="43" cy="28" r="17" fill="#2ECC71"/>' +                                // head
      '<path d="M26 26 Q26 9 43 9 Q60 9 60 26 Q56 17 43 17 Q31 17 26 26 Z" fill="#1B1410"/>' + // hair
      '<ellipse class="cg-eye" cx="37" cy="29" rx="2.2" ry="2.6" fill="#1B1410"/>' +
      '<ellipse class="cg-eye" cx="49" cy="29" rx="2.2" ry="2.6" fill="#1B1410"/>' +
      '<path d="M37 36 Q43 41 49 36" stroke="#1B1410" stroke-width="2" stroke-linecap="round" fill="none"/>' +
      '<circle cx="33" cy="34" r="2.6" fill="#0D6B3A" opacity=".35"/><circle cx="53" cy="34" r="2.6" fill="#0D6B3A" opacity=".35"/>' +
      '<rect x="48" y="66" width="12" height="8" rx="1.5" fill="#FF8A3D"/>' +            // pocket square
    '</svg>';

  /* ---------- welcome screen ---------- */
  function welcome(done) {
    if (ls(KEY_SEEN)) return done();
    var ov = document.createElement("div");
    ov.className = "cw-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-labelledby", "cw-h");
    ov.innerHTML =
      '<div class="cw-card">' +
        '<button class="cw-x" aria-label="Close">&times;</button>' +
        '<div class="cw-wave">' + FACE.replace('class="cg-svg"', 'class="cg-svg" style="width:86px;height:110px;margin-top:-12px"') + '</div>' +
        '<span class="cw-eb">Collaborate and Elevate</span>' +
        '<h2 class="cw-h" id="cw-h">Welcome to Colaeb!</h2>' +
        '<p class="cw-p"><b>Colaeb</b> (pronounced <i>collab</i>), aka <b>Collaborate and Elevate</b>, is a vetted community of humans leveraging technology to reach their goals. Enjoy!</p>' +
        '<button class="cw-go">Let’s go →</button>' +
      '</div>';
    document.body.appendChild(ov);
    var prevFocus = document.activeElement;
    requestAnimationFrame(function () { ov.classList.add("cw-on"); ov.querySelector(".cw-go").focus({ preventScroll: true }); });
    ls(KEY_SEEN, String(Date.now())); ga("welcome_view", { page: P });
    function close(how) {
      ov.classList.remove("cw-on"); document.removeEventListener("keydown", key);
      setTimeout(function () { ov.remove(); }, 350);
      try { prevFocus && prevFocus.focus && prevFocus.focus({ preventScroll: true }); } catch (e) {}
      ga("welcome_close", { how: how }); setTimeout(done, 900);
    }
    function key(e) { if (e.key === "Escape") close("esc"); }
    ov.querySelector(".cw-x").onclick = function () { close("x"); };
    ov.querySelector(".cw-go").onclick = function () { close("go"); };
    ov.addEventListener("click", function (e) { if (e.target === ov) close("backdrop"); });
    document.addEventListener("keydown", key);
  }

  /* ---------- guide character ---------- */
  var LINES = [
    "Hi! Want more customers? Join a vetted network of 700+ businesses.",
    "Collaborate and Elevate. Let us introduce you to your next customer.",
    "Looking to grow? Colaeb makes warm, human-vetted introductions.",
    "Join the network and put your business on the map."
  ];
  function guide() {
    var off = +ls(KEY_OFF) || 0;
    if (off && Date.now() - off < 7 * 864e5) return;
    var g = document.createElement("div");
    g.className = "cg"; g.setAttribute("role", "complementary"); g.setAttribute("aria-label", "Join Colaeb");
    g.innerHTML = '<div class="cg-body">' + FACE + '</div>' +
      '<div class="cg-bub"><button class="cg-close" aria-label="Hide guide">&times;</button><span class="cg-t"></span><br><a href="' + JOIN + '">Join Colaeb →</a></div>';
    document.body.appendChild(g);
    var bub = g.querySelector(".cg-bub"), txt = g.querySelector(".cg-t"), line = 0, hideT = 0, talked = 0;

    function talk() {
      txt.textContent = LINES[line++ % LINES.length];
      g.classList.add("cg-talk"); talked = Date.now();
      clearTimeout(hideT); hideT = setTimeout(quiet, 8000);
      ga("guide_prompt", { page: P });
    }
    function quiet() { g.classList.remove("cg-talk"); }
    g.querySelector(".cg-close").onclick = function (e) {
      e.preventDefault(); e.stopPropagation(); ls(KEY_OFF, String(Date.now())); ga("guide_close", { page: P });
      g.classList.remove("cg-on"); setTimeout(function () { g.remove(); }, 400); stop = 1;
    };
    bub.querySelector("a").onclick = function () { ga("guide_join_click", { page: P }); };

    var stop = 0;
    if (touch || reduce) {
      // Phones and reduced-motion: stand in the corner, speak once after a scroll or a few seconds.
      g.classList.add("cg-dock", "cg-on");
      g.style.pointerEvents = "auto";
      g.querySelector(".cg-body").onclick = function () { g.classList.contains("cg-talk") ? quiet() : talk(); };
      var spoke = 0;
      function maybe() { if (!spoke && (scrollY > innerHeight * 0.6)) { spoke = 1; talk(); } }
      addEventListener("scroll", maybe, { passive: true });
      setTimeout(function () { if (!spoke) { spoke = 1; talk(); } }, 9000);
      return;
    }

    // Desktop: trail the cursor, talk when the visitor pauses.
    var x = innerWidth - 120, y = innerHeight - 140, tx = x, ty = y, mx = -1, my = -1, idleT = 0, lastX = x, frozen = 0;
    g.classList.add("cg-on");
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      var dx = mx - (x + 43), dy = my - (y + 55), dist = Math.sqrt(dx * dx + dy * dy);
      if (g.classList.contains("cg-talk")) {
        // While speaking, hold still so the visitor can reach the button; walk on if they move away.
        if (dist < 300) { frozen = 1; return; }
        quiet();
      }
      frozen = 0;
      tx = clamp(mx + 34, 8, innerWidth - 96);
      ty = clamp(my + 22, 8, innerHeight - 120);
      clearTimeout(idleT);
      idleT = setTimeout(function () { if (!stop && Date.now() - talked > 20000) talk(); }, 1600);
    }, { passive: true });
    document.addEventListener("mouseleave", function () { tx = innerWidth - 120; ty = innerHeight - 140; });
    (function loop() {
      if (stop) return;
      if (!frozen) {
        x += (tx - x) * 0.07; y += (ty - y) * 0.07;
        if (Math.abs(x - lastX) > 0.6) g.classList.toggle("cg-flip", x < lastX);
        lastX = x;
      }
      g.classList.toggle("cg-left", x < innerWidth / 2);
      g.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
      requestAnimationFrame(loop);
    })();
    setTimeout(function () { if (!talked) talk(); }, 4000);
  }

  function start() { welcome(guide); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
