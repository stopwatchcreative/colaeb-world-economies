/* Colaeb homepage: Our Impact face rows + count-up stats, How Colaeb Works stacking cards.
   Adapted from MotionSites recipes (MIT, github.com/Motionsites-AI/claude-skill). */
(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raf = window.requestAnimationFrame;

  /* 1. Our Impact: replace the single marquee with two rows moving in opposite directions.
        Rows drift slowly on their own and speed along with the page scroll. No names are shown. */
  (function(){
    var mq = document.querySelector('.hp-our-impact-section .hp-marquee') || document.querySelector('.hp-marquee');
    if (!mq || mq.querySelector('.co-rows')) return;
    var seen = {}, srcs = [];
    [].slice.call(mq.querySelectorAll('img')).forEach(function(i){
      var s = i.currentSrc || i.src; if (s && !seen[s]) { seen[s] = 1; srcs.push(s); }
    });
    if (srcs.length < 6) return;
    var a = [], b = [];
    srcs.forEach(function(s, i){ (i % 2 ? b : a).push(s); });
    function row(list, dir){
      var one = list.map(function(s){ return '<div class="co-face"><img src="' + s + '" alt="" loading="lazy" decoding="async"></div>'; }).join('');
      return '<div class="co-row" data-dir="' + dir + '">' + one + '<span style="display:contents" aria-hidden="true">' + one + one + '</span></div>';
    }
    var wrap = document.createElement('div');
    wrap.className = 'co-rows'; wrap.setAttribute('aria-label', 'Founders and operators in the Colaeb network');
    wrap.setAttribute('role', 'img');
    wrap.innerHTML = row(a, 1) + row(b, -1);
    mq.appendChild(wrap); mq.classList.add('co-rows-on');
    if (reduce) return;
    var rows = [].slice.call(wrap.querySelectorAll('.co-row'));
    var widths = rows.map(function(r){ return r.scrollWidth / 3; });
    var drift = 0, last = performance.now(), hovering = false, visible = true;
    wrap.addEventListener('mouseenter', function(){ hovering = true; });
    wrap.addEventListener('mouseleave', function(){ hovering = false; });
    if ('IntersectionObserver' in window) new IntersectionObserver(function(e){ visible = e[0].isIntersecting; }).observe(wrap);
    function tick(now){
      var dt = Math.min(64, now - last); last = now;
      if (visible) {
        if (!hovering) drift += dt * 0.018;
        var scroll = (innerHeight - wrap.getBoundingClientRect().top) * 0.3;
        rows.forEach(function(r, i){
          var w = widths[i] || 1, d = +r.getAttribute('data-dir');
          var off = ((scroll + drift) * d) % w;
          r.style.transform = 'translate3d(' + (-w + off) + 'px,0,0)';
        });
      }
      raf(tick);
    }
    raf(tick);
    addEventListener('resize', function(){ widths = rows.map(function(r){ return r.scrollWidth / 3; }); });
  })();

  /* 2. Our Impact stats: count up when the tiles come into view (final values stay in the HTML). */
  (function(){
    var box = document.querySelector('.hp-imp-stats');
    if (!box || reduce || !('IntersectionObserver' in window)) return;
    var items = [];
    [].slice.call(box.querySelectorAll('.hp-imp-num')).forEach(function(el){
      var t = el.textContent.trim(), m = t.match(/^(\$?)([\d,]+)(K?\+?)$/);
      if (m) items.push({ el: el, pre: m[1], to: +m[2].replace(/,/g, ''), suf: m[3], comma: /,/.test(m[2]), final: t });
    });
    if (!items.length) return;
    var fmt = function(v, it){ var n = Math.round(v); return it.pre + (it.comma ? n.toLocaleString('en-US') : n) + it.suf; };
    var io = new IntersectionObserver(function(es){
      if (!es[0].isIntersecting) return; io.disconnect();
      items.forEach(function(it, i){
        it.el.textContent = fmt(0, it);
        setTimeout(function(){
          var t0 = performance.now(), dur = 1500 + i * 80;
          raf(function f(now){
            var p = Math.min(1, (now - t0) / dur);
            it.el.textContent = p < 1 ? fmt(it.to * (1 - Math.pow(1 - p, 3)), it) : it.final;
            if (p < 1) raf(f);
          });
        }, 300 + i * 90);
      });
    }, { threshold: 0.25 });
    io.observe(box);
  })();

  /* 3. How Colaeb works: steps become sticky cards that stack and shrink slightly (desktop only). */
  (function(){
    var grid = document.querySelector('#how .hp-how-grid');
    if (!grid || grid.classList.contains('co-stack')) return;
    if (!window.matchMedia('(min-width: 992px)').matches) return;
    var steps = [].slice.call(grid.querySelectorAll(':scope > .hp-step'));
    if (steps.length < 3) return;
    var n = steps.length;
    steps.forEach(function(s, i){
      var slot = document.createElement('div'); slot.className = 'co-slot';
      grid.insertBefore(slot, s); slot.appendChild(s);
      s.style.setProperty('--i', i);
      var tag = document.createElement('span'); tag.className = 'co-step-tag';
      tag.textContent = 'Step ' + (i + 1) + ' of ' + n; s.appendChild(tag);
    });
    grid.classList.add('co-stack');
    if (reduce) return;
    var ticking = false;
    function update(){
      ticking = false;
      var r = grid.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
      steps.forEach(function(card, i){
        var target = 1 - (n - 1 - i) * 0.03;
        var t = Math.min(1, Math.max(0, (p - i / n) / (1 - i / n)));
        card.style.transform = 'scale(' + (1 + (target - 1) * t) + ')';
      });
    }
    addEventListener('scroll', function(){ if (!ticking) { ticking = true; raf(update); } }, { passive: true });
    addEventListener('resize', update);
    update();
  })();
})();
