/* Colaeb Interviews: renders /interviews from the hidden Webflow CMS list and
   upgrades /interviews/[slug] pages (video player, related interviews, VideoObject schema). */
(function () {
  var d = document;
  var root = d.querySelector('[data-iv-root]');
  if (!root) return;

  function esc(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function txt(el, f) { var n = el.querySelector('[data-f="' + f + '"]'); return n ? n.textContent.trim() : ''; }
  function read(scope) {
    var out = [];
    Array.prototype.forEach.call(scope.querySelectorAll('[data-iv-item]'), function (el) {
      var it = { name: txt(el, 'name'), slug: txt(el, 'slug'), yt: txt(el, 'yt'), sum: txt(el, 'sum'), type: txt(el, 'type'), guests: txt(el, 'guests'), date: txt(el, 'date'), dur: txt(el, 'dur') };
      it.t = Date.parse(it.date) || 0;
      if (it.slug && it.yt) out.push(it);
    });
    out.sort(function (a, b) { return b.t - a.t; });
    return out;
  }
  function thumb(id) { return 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/hqdefault.jpg'; }
  function year(it) { var dt = new Date(it.t); return it.t ? dt.getFullYear() : ''; }
  function fmtDate(it) { return it.t ? new Date(it.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''; }
  function card(it) {
    return '<a class="iv-card" href="/interviews/' + esc(it.slug) + '"><span class="iv-thumb"><img loading="lazy" src="' + thumb(it.yt) + '" alt=""><span class="iv-dur">' + esc(it.dur) + '</span></span>' +
      '<p class="iv-card-type">' + esc(it.type) + (year(it) ? ' · ' + year(it) : '') + '</p><h3 class="iv-card-title">' + esc(it.name) + '</h3>' +
      (it.guests ? '<p class="iv-card-meta">' + esc(it.guests) + '</p>' : '') + '</a>';
  }

  /* ---------- listing page ---------- */
  if (root.getAttribute('data-iv-root') === 'list') {
    var items = read(d);
    var feat = d.querySelector('[data-iv="featured"]');
    if (feat && items.length) {
      var f = items[0];
      var side = items.slice(1, 5).map(function (it) {
        return '<a class="iv-row" href="/interviews/' + esc(it.slug) + '"><span class="iv-thumb"><img loading="lazy" src="' + thumb(it.yt) + '" alt=""></span><span><h3 class="iv-row-title">' + esc(it.name) + '</h3><p class="iv-row-meta">' + esc(it.type) + ' · ' + esc(it.dur) + '</p></span></a>';
      }).join('');
      feat.innerHTML = '<a class="iv-feat-main" href="/interviews/' + esc(f.slug) + '"><span class="iv-thumb"><img src="' + thumb(f.yt) + '" alt=""><span class="iv-badge"><span class="iv-play"></span>Latest · ' + esc(f.dur) + '</span></span>' +
        '<p class="iv-kicker">' + esc(f.type) + ' · ' + esc(fmtDate(f)) + '</p><h2 class="iv-feat-title">' + esc(f.name) + '</h2><p class="iv-feat-sum">' + esc(f.sum) + '</p></a><div class="iv-side">' + side + '</div>';
    }
    var grid = d.querySelector('[data-iv="grid"]'), tools = d.querySelector('[data-iv="tools"]'), count = d.querySelector('[data-iv="count"]');
    if (grid) {
      var state = { q: '', type: 'All', shown: 24 };
      var types = {};
      items.forEach(function (it) { if (it.type) types[it.type] = (types[it.type] || 0) + 1; });
      var order = Object.keys(types).sort(function (a, b) { return types[b] - types[a]; });
      if (tools) {
        tools.innerHTML = '<input class="iv-search" type="search" placeholder="Search by guest, company or topic" aria-label="Search interviews"><div class="iv-chips" role="group" aria-label="Filter by type">' +
          ['All'].concat(order).map(function (t) { return '<button type="button" class="iv-chip" data-type="' + esc(t) + '" aria-pressed="' + (t === 'All') + '">' + esc(t) + '<span>' + (t === 'All' ? items.length : types[t]) + '</span></button>'; }).join('') + '</div>';
        tools.querySelector('.iv-search').addEventListener('input', function (e) { state.q = e.target.value.toLowerCase().trim(); state.shown = 24; render(); });
        Array.prototype.forEach.call(tools.querySelectorAll('.iv-chip'), function (b) {
          b.addEventListener('click', function () {
            state.type = b.getAttribute('data-type'); state.shown = 24;
            Array.prototype.forEach.call(tools.querySelectorAll('.iv-chip'), function (x) { x.setAttribute('aria-pressed', x === b); });
            render();
          });
        });
      }
      var more = d.createElement('div'); more.className = 'iv-more-btn';
      grid.parentNode.insertBefore(more, grid.nextSibling);
      function render() {
        var list = items.filter(function (it) {
          if (state.type !== 'All' && it.type !== state.type) return false;
          if (!state.q) return true;
          return (it.name + ' ' + it.guests + ' ' + it.sum + ' ' + it.type).toLowerCase().indexOf(state.q) > -1;
        });
        grid.innerHTML = list.length ? list.slice(0, state.shown).map(card).join('') : '<p class="iv-empty">No interviews match that search yet.</p>';
        if (count) count.textContent = list.length + (list.length === 1 ? ' interview' : ' interviews');
        more.innerHTML = list.length > state.shown ? '<button type="button" class="iv-btn">Show more interviews</button>' : '';
        var b = more.querySelector('button'); if (b) b.addEventListener('click', function () { state.shown += 24; render(); });
      }
      render();
    }
    return;
  }

  /* ---------- interview page ---------- */
  var idEl = d.querySelector('[data-f="yt"]');
  var id = idEl ? idEl.textContent.trim() : '';
  var player = d.querySelector('.iv-player');
  var title = (d.querySelector('[data-f="name"]') || {}).textContent || '';
  if (id && player) {
    var btn = d.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Play video: ' + title);
    btn.innerHTML = '<img src="https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/maxresdefault.jpg" alt="" onerror="this.onerror=null;this.src=\'' + thumb(id) + '\'"><span class="iv-play"></span>';
    btn.addEventListener('click', function () {
      player.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0" title="' + esc(title) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    });
    player.appendChild(btn);
    var link = d.querySelector('[data-iv="ytlink"]');
    if (link) link.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(id);
    try {
      var sum = (d.querySelector('[data-f="sum"]') || {}).textContent || '';
      var dateTxt = (d.querySelector('[data-f="date"]') || {}).textContent || '';
      var t = Date.parse(dateTxt);
      var s = d.createElement('script'); s.type = 'application/ld+json';
      s.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'VideoObject', name: title.trim(), description: sum.trim() || title.trim(), thumbnailUrl: [thumb(id)], uploadDate: t ? new Date(t).toISOString() : undefined, embedUrl: 'https://www.youtube.com/embed/' + id, url: location.href, publisher: { '@type': 'Organization', name: 'Colaeb', url: 'https://colaeb.com/' } });
      d.head.appendChild(s);
    } catch (e) {}
  }
  var g = d.querySelector('[data-f="guests"]');
  if (g && !g.textContent.trim()) { var row = g.closest('.iv-guests'); if (row) row.style.display = 'none'; }
  var moreBox = d.querySelector('[data-iv="more"]');
  if (moreBox && window.fetch && window.DOMParser) {
    var here = location.pathname.replace(/\/$/, '').split('/').pop();
    var myType = ((d.querySelector('[data-f="type"]') || {}).textContent || '').trim();
    fetch('/interviews').then(function (r) { return r.text(); }).then(function (html) {
      var all = read(new DOMParser().parseFromString(html, 'text/html')).filter(function (it) { return it.slug !== here; });
      var same = all.filter(function (it) { return it.type === myType; });
      var pick = same.slice(0, 3);
      all.forEach(function (it) { if (pick.length < 3 && pick.indexOf(it) < 0) pick.push(it); });
      if (pick.length) moreBox.innerHTML = '<h2 class="iv-h2">More interviews</h2><div class="iv-grid">' + pick.map(card).join('') + '</div>';
    }).catch(function () {});
  }
})();
