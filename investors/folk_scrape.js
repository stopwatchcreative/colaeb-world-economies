// folk shared-list scraper: virtual grid, rows by aria-rowindex, columns by header text.
// Output lines: name|domain|linkedin||city|region|type  (firm level, deduped, known hosts dropped)
window.__folkRun = function (knownUrl) { window.__fr = null; window.__folk(knownUrl).then(r => window.__fr = r, e => window.__fr = 'err ' + e.message); return 'started'; };
window.__folk = async function (knownUrl) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const H = {};
  document.querySelectorAll('[role=columnheader]').forEach((h, i) => { H[h.getAttribute('aria-colindex') || (i + 1)] = h.textContent.trim(); });
  const rows = {};
  const v = [...document.querySelectorAll('div')].find(e => e.scrollHeight > e.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(e).overflowY));
  const grab = () => document.querySelectorAll('[role=gridcell]').forEach(c => {
    const r = c.closest('[role=row]').getAttribute('aria-rowindex'); const k = H[c.getAttribute('aria-colindex')]; if (!k) return;
    const a = c.querySelector('a[href]'); let t = c.innerText.trim(); if (/linkedin/i.test(k) && a) t = a.href;
    (rows[r] = rows[r] || {})[k] = t;
  });
  for (let x = 0; x <= v.scrollWidth; x += Math.max(400, v.clientWidth * 0.7)) {
    v.scrollLeft = x;
    for (let y = 0; y <= v.scrollHeight + 300; y += 300) { v.scrollTop = y; await sleep(90); grab(); }
    v.scrollTop = 0; await sleep(100);
  }
  let known = new Set(); try { known = new Set(await (await fetch(knownUrl)).json()); } catch (e) {}
  const key = re => Object.values(H).find(n => re.test(n));
  const K = { co: key(/^compan/i), person: key(/^(person|name)/i), url: key(/^url|website|domain/i), em: key(/e-?mail/i), li: key(/linkedin/i),
    loc: key(/location|city|address|country/i), type: key(/type/i) };
  const host = u => (u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#\s]/)[0];
  const cl = s => (s || '').replace(/\|/g, '/').replace(/[?#].*$/, '').trim();
  const seen = {}, out = []; let dup = 0;
  Object.values(rows).forEach(r => {
    const co = cl(r[K.co]).split('\n')[0]; const name = co || cl(r[K.person]); if (!name) return;
    let w = host((r[K.url] || '').split('\n')[0]);
    if (!w && /@/.test(r[K.em] || '')) w = host((r[K.em].split(/[\s,\n]+/)[0] || '').split('@')[1]);
    if (/linkedin\.com|gmail|yahoo|hotmail|outlook/.test(w)) w = '';
    const k = (w || name).toLowerCase(); if (seen[k]) return; seen[k] = 1;
    if (w && known.has(w)) { dup++; return; }
    const li = co ? '' : cl(r[K.li]).replace(/^https?:\/\/(www\.)?linkedin\.com\//, '');
    if (!w && !li) return;
    const loc = (r[K.loc] || '').split('\n');
    out.push([name, w, li, '', cl(loc[0]), cl(loc[1]), cl(r[K.type]).split('\n')[0]].join('|'));
  });
  const pre = document.createElement('pre'); pre.id = '__out'; pre.textContent = out.join('\n');
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild); document.body.appendChild(pre);
  return Object.keys(rows).length + ' rows, ' + out.length + ' new, ' + dup + ' known; cols ' + JSON.stringify(K);
};
