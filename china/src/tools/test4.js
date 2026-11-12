const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const page0 = fs.readFileSync(path.join(root, 'kashgar-to-hanoi.html'), 'utf8');
const skel = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>' + page0 + '</body></html>';
const h = path.join(root, 'test', 'harness4.html'); fs.writeFileSync(h, skel);
const D3 = fs.readFileSync('/opt/npm-tools/node_modules/d3/dist/d3.min.js', 'utf8');
const TOPO = fs.readFileSync(path.join(root, 'test', 'topojson-mock.js'), 'utf8');
const DM = fs.readFileSync(path.join(root, 'test', 'datamaps-mock.js'), 'utf8');
const js = b => ({ status: 200, contentType: 'application/javascript', body: b });
const runs = [
  { name: 'nojs-light', js: false, shot: true },
  { name: 'nojs-dark', js: false, dark: true, shot: true },
  { name: 'js-ok', js: true, libs: true },
  { name: 'js-nocdn', js: true, libs: false, shot: true },
];
(async () => {
  const browser = await chromium.launch();
  for (const o of runs) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, javaScriptEnabled: o.js, colorScheme: o.dark ? 'dark' : 'light' });
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    if (o.js) await page.addInitScript({ path: path.join(root, 'test', 'mocks.js') });
    await page.route('**/*', r => { const u = r.request().url();
      if (u.startsWith('file:')) return r.continue();
      if (o.libs && u.includes('/d3/7.8.5/')) return r.fulfill(js(D3));
      if (o.libs && u.includes('/topojson/3.0.2/')) return r.fulfill(js(TOPO));
      if (o.libs && u.includes('hires') && u.includes('cdnjs')) return r.fulfill(js(DM));
      return r.abort(); });
    await page.goto('file://' + h); await page.waitForTimeout(o.js ? 1500 : 300);
    const info = await page.evaluate(() => {
      const vis = el => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      return { nojs: document.querySelector('#wrap').classList.contains('nojs'), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        allstops: vis(document.querySelector('#allstops')), cards: [...document.querySelectorAll('#allstops .detail')].filter(vis).length,
        detail: vis(document.querySelector('#detail')) ? document.querySelector('#detail .d-title') && document.querySelector('#detail .d-title').textContent : '(hidden)',
        panels: ['days', 'book', 'cost'].map(n => vis(document.querySelector('#panel-' + n)) ? n : '-').join(','),
        mk: document.querySelectorAll('#map .mk').length, land: document.querySelectorAll('#map .c-land').length,
        note: vis(document.querySelector('#mapnote')) ? document.querySelector('#mapnote').textContent : '(hidden)',
        jserr: vis(document.querySelector('#jserr')) ? document.querySelector('#jserr').textContent : '(hidden)', h: document.documentElement.scrollHeight };
    });
    console.log(o.name, JSON.stringify(info), errors);
    if (o.shot) await page.screenshot({ path: path.join(root, 'test', o.name + '.png'), fullPage: o.name !== 'js-nocdn' });
    await ctx.close();
  }
  await browser.close();
})();
