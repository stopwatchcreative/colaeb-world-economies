/* Colaeb homepage motion layer.
   Recipes adapted from MotionSites (MIT, github.com/Motionsites-AI/claude-skill):
   viewport-triggered staggered reveal, count-up statistics, cursor spotlight,
   magnetic hover, pointer parallax/tilt, scroll-linked word-by-word reveal. */
(function(){
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var raf = requestAnimationFrame;
  var $$ = function(s, r){ return [].slice.call((r || document).querySelectorAll(s)); };
  var skip = function(el){ return el.closest('.hp-hero-section,.co-stack,.co-rows,.cn-globe,.hp-imp-stats'); };

  /* 1. Staggered reveal --------------------------------------------------- */
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){
        if (!e.isIntersecting) return;
        var el = e.target; io.unobserve(el); el.classList.add('co-in');
        var ms = (parseFloat(el.style.getPropertyValue('--d')) || 0) * 1000 + 950;
        setTimeout(function(){ el.classList.add('co-done'); }, ms);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    var used = [];
    var mark = function(el, o){
      if (!el || skip(el) || used.indexOf(el) > -1 || (el.parentElement && el.parentElement.closest('.tm-viewport'))) return;
      if (el.getBoundingClientRect().top < innerHeight) return;   /* already on screen: leave it alone */
      used.push(el); o = o || {};
      el.classList.add('co-rv'); if (o.scale) el.classList.add('co-scale');
      if (o.x) el.style.setProperty('--x', o.x + 'px');
      if (o.y != null) el.style.setProperty('--y', o.y + 'px');
      if (o.dur) el.style.setProperty('--dur', o.dur + 's');
      el.style.setProperty('--d', ((o.d || 0) / 1000) + 's');
      io.observe(el);
    };
    /* headings cascade: eyebrow, headline, lead */
    $$('section').forEach(function(sec){
      $$('.hp-eyebrow,.cnh-kicker', sec).forEach(function(el){ mark(el, { y: 20 }); });
      $$('.hp-h2,.cnh-title', sec).forEach(function(el){ mark(el, { y: 40, d: 90 }); });
      $$('.hp-lead,.cnh-text,.hp-our-impact-text,.cnh-stats,.cnh-note', sec).forEach(function(el, i){ mark(el, { d: 180 + i * 60 }); });
      $$('.hp-btn,.cnh-actions,.hp-plans-flex', sec).forEach(function(el){ mark(el, { y: 18, d: 260 }); });
    });
    /* card groups */
    var group = function(sel, kids, o){
      $$(sel).forEach(function(g){
        $$(kids, g).forEach(function(el, i){
          mark(el, { scale: o.scale, y: o.y, d: (o.base || 0) + i * (o.step || 100) });
        });
      });
    };
    group('.hp-wrap.is-wrap-3', ':scope > .hp-chk', { step: 120, y: 16 });
    group('.hp-our-impact-grid', ':scope > *', { scale: 1, step: 100 });
    group('.hp-benefits-section .hp-benefits-grid', ':scope > .hp-card', { scale: 1, step: 100 });
    group('.hp-plans-grid', ':scope > *', { scale: 1, step: 110 });
    group('.hp-onboarding-grid', ':scope > .hp-step', { base: 150, step: 140 });
    group('.hp-capital-flex', ':scope > *', { base: 300, step: 110, y: 14 });
    group('.hp-faq-div', '.hp-faq-div-2', { step: 70, y: 20 });
    $$('.tm-viewport').forEach(function(el){ mark(el, { y: 40, dur: .9 }); });
    /* two-column splits slide in from the sides */
    mark(document.querySelector('.hp-capital-div'), { x: -40, y: 0, dur: .9, d: 200 });
    mark(document.querySelector('.hp-capital-div-2'), { x: 40, y: 0, dur: .9, d: 150 });
    mark(document.querySelector('.hp-open-a-ban-div-2'), { x: -40, y: 0, dur: .9, d: 200 });
    $$('section').forEach(function(sec){
      if (!sec.querySelector('.hp-open-a-ban-div-2')) return;
      $$('.hp-card', sec).forEach(function(el){ mark(el, { x: 40, y: 0, dur: .9, d: 150 }); });
    });
    mark(document.querySelector('.hp-taja-ai-su-flex'), { y: 20, d: 200 });
    mark(document.querySelector('.hp-ig-wrap'), { x: 40, y: 0, dur: .9, d: 150 });
    mark(document.querySelector('.cnh-globe'), { y: 50, dur: 1 });
    mark(document.querySelector('.hp-contact-div-3'), { x: -40, y: 0, dur: .9 });
    mark(document.querySelector('.cf-form') || document.querySelector('.hp-contact-flex'), { x: 40, y: 0, dur: .9, d: 120 });
  }

  /* 2. Count-up on plan prices and the funding range ----------------------- */
  (function(){
    if (reduce || !('IntersectionObserver' in window)) return;
    var run = function(node, parts, dur){
      var t0 = performance.now();
      raf(function f(now){
        var p = Math.min(1, (now - t0) / dur), k = 1 - Math.pow(1 - p, 3);
        node.nodeValue = parts.map(function(x){
          if (typeof x === 'string') return x;
          var v = Math.round(x.to * k); return x.comma ? v.toLocaleString('en-US') : String(v);
        }).join('');
        if (p < 1) raf(f); else node.nodeValue = parts.final;
      });
    };
    var parse = function(node){
      var t = node.nodeValue, parts = [], last = 0, m, re = /\d[\d,]*/g;
      while ((m = re.exec(t))) {
        parts.push(t.slice(last, m.index));
        parts.push({ to: +m[0].replace(/,/g, ''), comma: m[0].indexOf(',') > -1 });
        last = m.index + m[0].length;
      }
      parts.push(t.slice(last)); parts.final = t;
      return parts.length > 1 ? parts : null;
    };
    var cio = new IntersectionObserver(function(es){
      es.forEach(function(e){
        if (!e.isIntersecting) return; cio.unobserve(e.target);
        var node = e.target.firstChild, parts = node && node.nodeType === 3 && parse(node);
        if (parts) setTimeout(function(){ run(node, parts, 1300); }, 250);
      });
    }, { threshold: 0.6 });
    $$('.hp-price,.hp-capital-div-3').forEach(function(el){
      var n = el.firstChild;
      if (n && n.nodeType === 3 && /\d/.test(n.nodeValue)) cio.observe(el);
    });
  })();

  /* 3. Cursor spotlight on cards ------------------------------------------ */
  if (fine && !reduce) {
    $$('.hp-card').forEach(function(card){
      if (skip(card) || card.closest('.hp-how-grid')) return;
      var cs = getComputedStyle(card);
      if (cs.position === 'static') card.style.position = 'relative';
      var g = document.createElement('span'); g.className = 'co-glow'; g.setAttribute('aria-hidden', 'true');
      card.insertBefore(g, card.firstChild); card.classList.add('co-spot');
      var bg = cs.backgroundColor.match(/\d+/g);
      if (bg && (+bg[0] + +bg[1] + +bg[2]) < 200 && (bg[3] === undefined || +bg[3] > 0)) card.classList.add('co-dark');
      card.addEventListener('pointermove', function(e){
        var r = card.getBoundingClientRect();
        card.style.setProperty('--gx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--gy', (e.clientY - r.top) + 'px');
        card.classList.add('co-lit');
      });
      card.addEventListener('pointerleave', function(){ card.classList.remove('co-lit'); });
    });
  }

  /* 4. Magnetic buttons ---------------------------------------------------- */
  if (fine && !reduce) {
    var mags = $$('.hp-btn,.cnh-btn,.cf-btn').filter(function(b){ return !b.closest('.hp-plans-grid'); });
    var mx = -1e4, my = -1e4, ticking = false;
    var state = mags.map(function(){ return { on: false, x: 0, y: 0 }; });
    var upd = function(){
      ticking = false;
      mags.forEach(function(b, i){
        var s = state[i], r = b.getBoundingClientRect();
        var cx = r.left - s.x + r.width / 2, cy = r.top - s.y + r.height / 2;
        var dx = mx - cx, dy = my - cy;
        var inside = Math.abs(dx) < r.width / 2 + 40 && Math.abs(dy) < r.height / 2 + 40;
        if (inside) {
          if (!s.on) { s.on = true; b.style.transition = 'transform .3s ease-out'; }
          s.x = dx / 4; s.y = dy / 4;
          b.style.transform = 'translate3d(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px,0)';
        } else if (s.on) {
          s.on = false; s.x = 0; s.y = 0;
          b.style.transition = 'transform .6s ease-in-out'; b.style.transform = '';
        }
      });
    };
    addEventListener('mousemove', function(e){ mx = e.clientX; my = e.clientY; if (!ticking) { ticking = true; raf(upd); } }, { passive: true });
  }

  /* 5. Pointer tilt on the funding and banking visuals --------------------- */
  if (fine && !reduce) {
    ['.hp-capital-div', '.hp-open-a-ban-div-2'].forEach(function(sel){
      var box = document.querySelector(sel), inner = box && box.firstElementChild;
      if (!inner) return;
      box.classList.add('co-tilt'); inner.classList.add('co-tilt-in');
      var tx = 0, ty = 0, x = 0, y = 0, loop = 0;
      var step = function(){
        x += (tx - x) * 0.12; y += (ty - y) * 0.12;
        box.style.setProperty('--tx', x.toFixed(4)); box.style.setProperty('--ty', y.toFixed(4));
        loop = (Math.abs(tx - x) > 0.0005 || Math.abs(ty - y) > 0.0005) ? raf(step) : 0;
      };
      box.addEventListener('pointermove', function(e){
        var r = box.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5;
        if (!loop) loop = raf(step);
      });
      box.addEventListener('pointerleave', function(){ tx = 0; ty = 0; if (!loop) loop = raf(step); });
    });
  }

  /* 6. Taja quote lights up word by word as you scroll --------------------- */
  (function(){
    var q = document.querySelector('.hp-taja-ai-su-quote');
    if (!q || reduce || q.querySelector('.co-w')) return;
    var walk = function(n){
      [].slice.call(n.childNodes).forEach(function(c){
        if (c.nodeType === 3) {
          var frag = document.createDocumentFragment();
          c.nodeValue.split(/(\s+)/).forEach(function(w){
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
            var s = document.createElement('span'); s.className = 'co-w'; s.textContent = w; frag.appendChild(s);
          });
          c.parentNode.replaceChild(frag, c);
        } else if (c.nodeType === 1) walk(c);
      });
    };
    q.setAttribute('aria-label', q.textContent.trim());
    walk(q); q.classList.add('co-words');
    var ws = $$('.co-w', q), N = ws.length, last = -1, tk = false;
    var upd = function(){
      tk = false;
      var r = q.getBoundingClientRect(), vh = innerHeight;
      var p = Math.min(1, Math.max(0, (0.85 * vh - r.top) / (0.45 * vh + r.height)));
      if (Math.abs(p - last) < 0.0005) return; last = p;
      ws.forEach(function(s, i){
        var a = i / N - 0.1, b = i / N + 0.05;
        s.style.opacity = (0.18 + 0.82 * Math.min(1, Math.max(0, (p - a) / (b - a)))).toFixed(3);
      });
    };
    addEventListener('scroll', function(){ if (!tk) { tk = true; raf(upd); } }, { passive: true });
    addEventListener('resize', upd); upd();
  })();
})();
