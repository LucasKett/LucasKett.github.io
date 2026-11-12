const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const page0 = fs.readFileSync(path.join(root, 'kashgar-to-hanoi.html'), 'utf8');
const skel = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + page0 + '</body></html>';
const harness = path.join(root, 'test', 'harness.html'); fs.writeFileSync(harness, skel);
const D3 = fs.readFileSync('/opt/npm-tools/node_modules/d3/dist/d3.min.js', 'utf8');
const TOPO = fs.readFileSync(path.join(root, 'test', 'topojson-mock.js'), 'utf8');
const DM = fs.readFileSync(path.join(root, 'test', 'datamaps-mock.js'), 'utf8');
const out = p => path.join(root, 'test', p);
async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: o.vp, colorScheme: o.dark ? 'dark' : 'light', deviceScaleFactor: 1.5, hasTouch: !!o.touch, isMobile: !!o.touch });
  const page = await ctx.newPage(); const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.clock.setFixedTime(new Date('2026-11-21T06:00:00Z'));
  await page.addInitScript({ path: out('mocks.js') });
  await page.route('**/*', route => { const u = route.request().url();
    if (u.startsWith('file:')) return route.continue();
    if (u.includes('/d3/7.8.5/d3.min.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: D3 });
    if (u.includes('/topojson/3.0.2/')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: TOPO });
    if (u.includes('datamaps.world.hires.min.js') && u.includes('cdnjs')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: DM });
    return route.abort(); });
  await page.goto('file://' + harness); await page.waitForTimeout(800);
  return { ctx, page, errors };
}
(async () => {
  const browser = await chromium.launch();
  for (const o of [{ name: 'phone', vp: { width: 390, height: 844 }, touch: true }, { name: 'desk-dark', vp: { width: 1280, height: 900 }, dark: true }]) {
    const { ctx, page, errors } = await open(browser, o);
    const info = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, markers: document.querySelectorAll('.mk').length, title: document.querySelector('.d-title').textContent, stats: document.getElementById('stats').textContent, legs: document.querySelectorAll('g.leg').length, emptyPaths: [...document.querySelectorAll('g.leg path')].filter(p => (p.getAttribute('d')||'').length < 12).length }));
    console.log(o.name, JSON.stringify(info), errors);
    await page.screenshot({ path: out(o.name + '-new.png'), fullPage: o.name === 'phone' });
    if (o.name === 'desk-dark') { await page.click('#tab-cost'); await page.waitForTimeout(200); const c = await page.evaluate(() => document.querySelector('.costsum').innerText); console.log(c.replace(/\n/g, ' | ')); await page.click('#tab-book'); await page.waitForTimeout(200); await page.screenshot({ path: out('desk-book-new.png') }); }
    await ctx.close();
  }
  await browser.close();
})();
