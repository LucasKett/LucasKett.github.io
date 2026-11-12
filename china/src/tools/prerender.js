// Bakes the rendered plan into the HTML so it reads fully, with working tabs, map and stop panels, when the viewer runs no scripts.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const raw = fs.readFileSync(path.join(root, 'kashgar-to-hanoi.raw.html'), 'utf8');
const skel = b => '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + b + '</body></html>';
const tmp = path.join(root, 'test', 'prerender-src.html'); fs.writeFileSync(tmp, skel(raw));
const NSTOPS = (raw.match(/\{n:\d+,name:/g) || []).length;
const D3 = fs.readFileSync('/opt/npm-tools/node_modules/d3/dist/d3.min.js', 'utf8');
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const now = new Date(Date.now() + 8 * 3600e3 + new Date().getTimezoneOffset() * 60e3), asof = DOW[now.getDay()] + ' ' + now.getDate() + ' ' + MON[now.getMonth()];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai' });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => { const u = r.request().url();
    if (u.startsWith('file:')) return r.continue();
    if (u.includes('/d3/7.8.5/d3.min.js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: D3 });
    return r.abort(); });
  await page.goto('file://' + tmp);
  await page.waitForFunction(() => document.querySelector('#ms-none') && !document.querySelector('#wrap').classList.contains('nojs'), null, { timeout: 20000 });
  // show the route view so the map lays out at its real phone size
  await page.evaluate(() => { document.getElementById('v-route').checked = true; });
  await page.waitForFunction(n => document.querySelectorAll('#map .mk').length >= n, NSTOPS, { timeout: 20000 });
  await page.waitForTimeout(900);
  const out1 = await page.evaluate(asof => {
    const wrap = document.getElementById('wrap').cloneNode(true);
    wrap.classList.add('nojs');
    const pick = (sel, id) => wrap.querySelectorAll(sel).forEach(r => { if (r.id === id) r.setAttribute('checked', ''); else r.removeAttribute('checked'); });
    pick('input.vr', 'v-today'); pick('input.msr', 'ms-none');
    const svg = wrap.querySelector('#map');
    svg.removeAttribute('style');
    svg.querySelectorAll('.pulse,.selring').forEach(e => e.remove());
    svg.querySelectorAll('.sel,.hot,.dim').forEach(e => e.classList.remove('sel', 'hot', 'dim'));
    const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number), W = vb[2], H = vb[3];
    const inner = wrap.querySelector('#mapinner');
    inner.setAttribute('style', '--ar:' + W + ' / ' + H + ';--arn:' + (W / H).toFixed(4));
    let labels = '';
    svg.querySelectorAll('g.mk').forEach(g => {
      g.removeAttribute('tabindex'); g.removeAttribute('role');
      const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(g.getAttribute('transform') || '');
      const n = (g.querySelector('text') || {}).textContent;
      if (!m || !n) return;
      labels += '<label for="ms-' + n + '" style="left:' + (m[1] / W * 100).toFixed(2) + '%;top:' + (m[2] / H * 100).toFixed(2) + '%" aria-label="' + (g.getAttribute('aria-label') || 'Stop ' + n).replace(/"/g, '&quot;') + '"></label>';
    });
    const old = inner.querySelector('.mklabels'); if (old) old.remove();
    inner.insertAdjacentHTML('beforeend', '<div class="mklabels">' + labels + '</div>');
    wrap.querySelectorAll('.js-only,button[data-copy]').forEach(e => e.remove());
    wrap.querySelectorAll('li[data-goto]').forEach(li => { li.removeAttribute('role'); li.removeAttribute('tabindex'); });
    wrap.querySelectorAll('input[type=checkbox]').forEach(i => i.setAttribute('disabled', ''));
    wrap.querySelectorAll('details.stop[open]').forEach(d => d.removeAttribute('open'));
    const tc = wrap.querySelector('.today');
    if (tc) { const td = tc.querySelector('.t-date'); if (td) td.textContent = td.textContent.replace(/^Today · /, '');
      tc.insertAdjacentHTML('beforeend', '<p class="asof">Page last updated ' + asof + '. If that was a while ago, later days are under Coming up.</p>'); }
    wrap.querySelectorAll('.day .pill.acc.tag').forEach(e => e.remove());
    const note = wrap.querySelector('#mapnote'); if (note) note.setAttribute('hidden', '');
    return { html: wrap.outerHTML, mk: svg.querySelectorAll('.mk').length, labels: (labels.match(/<label/g) || []).length, pops: wrap.querySelectorAll('.pop').length, cards: wrap.querySelectorAll('details.stop').length, vb: W + 'x' + H };
  }, asof);
  await browser.close();
  if (errs.length) { console.error('page errors', errs); process.exit(1); }
  if (out1.mk < NSTOPS || out1.labels < NSTOPS || out1.pops < NSTOPS || out1.cards < NSTOPS) throw new Error('snapshot incomplete ' + JSON.stringify(out1));
  if (/<script[^>]*>/.test(out1.html)) throw new Error('script leaked into static copy');
  const a = raw.indexOf('<div class="wrap nojs" id="wrap">'), b = raw.indexOf('<!--/wrap-->');
  if (a < 0 || b < 0 || raw.indexOf('<!--/wrap-->', b + 1) >= 0) throw new Error('wrap markers not found once');
  const out = raw.slice(0, a) + out1.html + '\n' + raw.slice(b);
  fs.writeFileSync(path.join(root, 'kashgar-to-hanoi.html'), out);
  console.log('prerendered', Buffer.byteLength(out), 'bytes;', out1.cards, 'stop cards;', out1.pops, 'panels; map', out1.vb, out1.mk, 'markers', out1.labels, 'tap targets');
})().catch(e => { console.error(e); process.exit(1); });
