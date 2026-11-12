// Phone-first checks: tabs, full-screen map and stop panels, with and without scripts, portrait and landscape.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const page0 = fs.readFileSync(path.join(root, 'kashgar-to-hanoi.html'), 'utf8');
const skel = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + page0 + '</body></html>';
const h = path.join(root, 'test', 'harness5.html'); fs.writeFileSync(h, skel);
const D3 = fs.readFileSync('/opt/npm-tools/node_modules/d3/dist/d3.min.js', 'utf8');
const TOPO = fs.readFileSync(path.join(root, 'test', 'topojson-mock.js'), 'utf8');
const DM = fs.readFileSync(path.join(root, 'test', 'datamaps-mock.js'), 'utf8');
const jsr = b => ({ status: 200, contentType: 'application/javascript', body: b });
const shot = p => path.join(root, 'test', 's5-' + p + '.png');
const PORT = { width: 390, height: 844 }, LAND = { width: 844, height: 390 };
async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: o.vp, isMobile: true, hasTouch: true, javaScriptEnabled: o.js, colorScheme: o.dark ? 'dark' : 'light', deviceScaleFactor: 2 });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  if (o.js) { await page.addInitScript({ path: path.join(root, 'test', 'mocks.js') }); if (o.clock) await page.clock.setFixedTime(new Date(o.clock)); }
  await page.route('**/*', r => { const u = r.request().url();
    if (u.startsWith('file:')) return r.continue();
    if (o.js && u.includes('/d3/7.8.5/')) return r.fulfill(jsr(D3));
    if (o.js && u.includes('/topojson/3.0.2/')) return r.fulfill(jsr(TOPO));
    if (o.js && u.includes('hires') && u.includes('cdnjs')) return r.fulfill(jsr(DM));
    return r.abort(); });
  await page.goto('file://' + h); await page.waitForTimeout(o.js ? 1200 : 250);
  return { ctx, page, errors };
}
const info = page => page.evaluate(() => {
  const vis = el => !!el && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const views = ['today', 'route', 'days', 'book', 'cost'].filter(v => vis(document.getElementById(v)));
  const pop = [...document.querySelectorAll('.pop')].find(vis);
  const mb = document.querySelector('#mapbox').getBoundingClientRect();
  const pr = pop && pop.getBoundingClientRect();
  return { nojs: document.querySelector('#wrap').classList.contains('nojs'), views: views.join(','), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    fs: getComputedStyle(document.querySelector('#mapbox')).position === 'fixed', map: [Math.round(mb.width), Math.round(mb.height)].join('x'),
    pop: pop ? pop.id + ' ' + [Math.round(pr.left), Math.round(pr.top), Math.round(pr.width), Math.round(pr.height)].join(',') + ' scroll ' + pop.scrollHeight + '/' + pop.clientHeight : '-',
    tabbar: vis(document.querySelector('.tabbar')), mk: document.querySelectorAll('#map .mk').length, land: document.querySelectorAll('#map .c-land').length,
    jserr: vis(document.querySelector('#jserr')) ? document.querySelector('#jserr').textContent : '' };
});
(async () => {
  const browser = await chromium.launch();
  const log = (n, x, e) => console.log(n.padEnd(22), JSON.stringify(x), e && e.length ? e : '');
  // ---- no scripts, portrait ----
  let { ctx, page, errors } = await open(browser, { vp: PORT, js: false });
  log('nojs today', await info(page)); await page.screenshot({ path: shot('nojs-today') });
  await page.click('.tabbar [for="v-route"]'); log('nojs route', await info(page)); await page.screenshot({ path: shot('nojs-route') });
  await page.click('.openmap'); log('nojs map', await info(page)); await page.screenshot({ path: shot('nojs-map') });
  await page.click('.mklabels [for="ms-12"]'); log('nojs pop 12', await info(page)); await page.screenshot({ path: shot('nojs-pop') });
  await page.click('#pop-12 .pnav >> nth=1'); log('nojs next', await info(page));
  await page.click('#pop-13 .pclose'); log('nojs pop closed', await info(page));
  await page.click('.mapclose'); log('nojs map closed', await info(page));
  await page.click('#s12 > summary'); await page.waitForTimeout(100); await page.screenshot({ path: shot('nojs-card') });
  for (const v of ['days', 'book', 'cost']) { await page.click('.tabbar [for="v-' + v + '"]'); await page.evaluate(() => window.scrollTo(0, 0)); log('nojs ' + v, await info(page)); await page.screenshot({ path: shot('nojs-' + v) }); }
  await ctx.close();
  // ---- no scripts, landscape ----
  ({ ctx, page, errors } = await open(browser, { vp: LAND, js: false }));
  await page.click('.tabbar [for="v-route"]'); await page.click('.openmap'); await page.click('.mklabels [for="ms-12"]');
  log('nojs land pop', await info(page)); await page.screenshot({ path: shot('nojs-land-pop') });
  await ctx.close();
  // ---- scripts, portrait, before the trip ----
  ({ ctx, page, errors } = await open(browser, { vp: PORT, js: true }));
  log('js today', await info(page), errors); await page.screenshot({ path: shot('js-today') });
  await page.click('.tabbar [for="v-route"]'); await page.waitForTimeout(400); log('js route', await info(page), errors); await page.screenshot({ path: shot('js-route') });
  const y0 = await page.evaluate(() => window.scrollY);
  await page.click('#map', { position: { x: 200, y: 150 } }); await page.waitForTimeout(500); log('js map open', await info(page), errors); await page.screenshot({ path: shot('js-map') });
  await page.evaluate(() => { const g = [...document.querySelectorAll('#map g.mk')].find(x => x.querySelector('text').textContent === '12'); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(900); log('js pop 12', await info(page), errors); await page.screenshot({ path: shot('js-pop') });
  await page.click('#pop-12 .pnav >> nth=1'); await page.waitForTimeout(900); log('js next', await info(page), errors); await page.screenshot({ path: shot('js-pop13') });
  await page.click('#pop-13 button[data-goto]'); await page.waitForTimeout(700); log('js full details', await info(page), errors);
  console.log('   open card:', await page.evaluate(() => { const d = document.querySelector('details.stop[open]'); return d && d.id + ' top ' + Math.round(d.getBoundingClientRect().top); }));
  await page.screenshot({ path: shot('js-card') });
  await ctx.close();
  // ---- scripts, landscape ----
  ({ ctx, page, errors } = await open(browser, { vp: LAND, js: true }));
  await page.click('.tabbar [for="v-route"]'); await page.waitForTimeout(300);
  await page.click('.openmap'); await page.waitForTimeout(500);
  await page.evaluate(() => { const g = [...document.querySelectorAll('#map g.mk')].find(x => x.querySelector('text').textContent === '20'); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(900); log('js land pop 20', await info(page), errors); await page.screenshot({ path: shot('js-land-pop') });
  await ctx.close();
  // ---- scripts, during the trip (birthday), dark ----
  ({ ctx, page, errors } = await open(browser, { vp: PORT, js: true, dark: true, clock: '2026-11-21T03:00:00Z' }));
  log('js dark today', await info(page), errors); await page.screenshot({ path: shot('js-dark-today') });
  await page.click('.tabbar [for="v-days"]'); await page.waitForTimeout(200); await page.screenshot({ path: shot('js-dark-days') });
  await page.click('.tabbar [for="v-book"]'); await page.waitForTimeout(200); await page.screenshot({ path: shot('js-dark-book') });
  await ctx.close();
  // ---- desktop ----
  ({ ctx, page, errors } = await open(browser, { vp: { width: 1280, height: 860 }, js: true }));
  await page.click('.tabbar [for="v-route"]'); await page.waitForTimeout(400); log('desk route', await info(page), errors); await page.screenshot({ path: shot('desk-route') });
  await ctx.close();
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
