// Airtable shared-view scraper: scrolls the grid (both axes), collects every cell by row/column id,
// maps columns by header name, drops rows already known (localStorage __known), and writes
// "name|website|linkedin|email|city|country|type|stage" lines into a <pre> for get_page_text.
window.__atRun = function (over) { window.__sr = null; window.__atScrape(over).then(r => window.__sr = r, e => window.__sr = 'error ' + e.message); return 'started'; };
window.__atScrape = async function (over) {
  over = over || {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rows = {}, cols = {};
  const grab = () => {
    document.querySelectorAll('.cell.header[data-columnid]').forEach(h => {
      const id = h.getAttribute('data-columnid'); const nm = (h.querySelector('.name, .truncate') || h).textContent.trim();
      if (id && nm && !h.closest('[data-rowid]')) cols[id] = cols[id] || nm;
    });
    document.querySelectorAll('[data-rowid] [data-columnid]').forEach(c => {
      const r = c.closest('[data-rowid]').getAttribute('data-rowid');
      const a = c.querySelector('a[href]'); let v = c.innerText.trim();
      if (a && /^https?:|^mailto:/.test(a.getAttribute('href'))) v = v || a.getAttribute('href');
      if (a && /linkedin\.com|^mailto:/.test(a.getAttribute('href'))) v = a.getAttribute('href');
      (rows[r] = rows[r] || {})[c.getAttribute('data-columnid')] = v;
    });
  };
  const v = document.querySelector('.antiscroll-inner.keyboard-accessible-grid-container') || document.querySelector('.antiscroll-inner');
  if (!v) return 'no grid';
  for (let x = 0; x <= v.scrollWidth; x += Math.max(300, v.clientWidth * 0.7)) {
    v.scrollLeft = x;
    for (let y = 0; y <= v.scrollHeight + 300; y += 160) { v.scrollTop = y; await sleep(70); grab(); }
    v.scrollTop = 0; await sleep(80);
  }
  const names = Object.entries(cols);
  const pick0 = re => (names.find(([id, n]) => re.test(n)) || [])[0];
  const pick = re => pick0(re);
  const first = names[0] && names[0][0];
  const C0 = {
    name: pick(/^(name|fund|firm|investor|company|vc|organi[sz]ation|fund name|firm name|investor name)/i) || first,
    web: pick(/web|url|site|homepage/i), li: pick(/linkedin/i), em: pick(/e-?mail/i),
    city: pick(/city|location|hq|headquarter|based|office/i), country: pick(/country|region|geograph/i),
    type: pick(/type|category|kind/i), stage: pick(/stage|round/i), focus: pick(/focus|sector|industr|vertical|thesis/i), contact: pick(/contact/i), state: pick(/^state$/i)
  };
  const C = Object.assign({}, C0); Object.keys(over).forEach(k => { C[k] = pick0(new RegExp(over[k], 'i')); });
  const known = new Set(JSON.parse(localStorage.getItem('__known') || '[]'));
  const clean = s => (s || '').replace(/\s+/g, ' ').replace(/\|/g, '/').trim();
  const host = u => (u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
  const out = []; let dup = 0; const seenN = {};
  Object.values(rows).forEach(r => {
    const nm = clean(r[C.name]); if (!nm) return;
    const nk = nm.toLowerCase(); if (seenN[nk]) return; seenN[nk] = 1;
    const w = clean(r[C.web]).split(/[\s,]+/)[0];
    if (w && known.has(host(w))) { dup++; return; }
    out.push([nm, w, clean(r[C.li]), (clean(r[C.em]) || (/@/.test(r[C.contact] || '') ? clean(r[C.contact]) : '')).replace(/^mailto:/, ''), clean(r[C.city]), clean(r[C.state] ? r[C.state] : r[C.country]), clean(r[C.type]), clean(r[C.stage]), clean(r[C.focus]).slice(0, 80)].join('|').split('|').map(f => f.replace(/[?#].*$/, '')).join('|'));
  });
  const pre = document.createElement('pre'); pre.id = '__out'; pre.textContent = out.join('\n');
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
  document.body.appendChild(pre);
  return JSON.stringify({ rows: Object.keys(rows).length, kept: out.length, dup, cols: Object.fromEntries(Object.entries(C).map(([k, id]) => [k, (cols[id] || '').slice(0, 30)])) }).replace(/[?=&]/g, ' ');
};
