const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const harness = path.join(root, 'test', 'harness.html');
const D3 = fs.readFileSync('/opt/npm-tools/node_modules/d3/dist/d3.min.js', 'utf8');
const TOPO = fs.readFileSync(path.join(root, 'test', 'topojson-mock.js'), 'utf8');
const DM = fs.readFileSync(path.join(root, 'test', 'datamaps-mock.js'), 'utf8');
const js = b => ({ status: 200, contentType: 'application/javascript', body: b });
const cases = {
  noCdn: u => null,
  cdnjsDown: u => u.includes('cdnjs') ? null : u.includes('jsdelivr.net/npm/d3@') ? js(D3) : u.includes('jsdelivr.net/npm/topojson@') ? js(TOPO) : u.includes('jsdelivr.net/npm/datamaps') ? js(DM) : null,
  slowD3: u => u.includes('/d3/7.8.5/') ? 'slow' : u.includes('/topojson/3.0.2/') ? js(TOPO) : u.includes('hires') && u.includes('cdnjs') ? js(DM) : null
};
(async () => {
  const browser = await chromium.launch();
  for (const [name, fn] of Object.entries(cases)) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
    await page.clock.setFixedTime(new Date('2026-11-21T06:00:00Z'));
    await page.addInitScript({ path: path.join(root, 'test', 'mocks.js') });
    await page.route('**/*', async route => { const u = route.request().url();
      if (u.startsWith('file:')) return route.continue();
      const r = fn(u);
      if (r === 'slow') { await new Promise(z => setTimeout(z, 3000)); return route.fulfill(js(D3)); }
      return r ? route.fulfill(r) : route.abort(); });
    await page.goto('file://' + harness);
    await page.waitForTimeout(400);
    const early = await page.evaluate(() => ({ stats: document.querySelector('#stats').textContent.slice(0, 40), detail: !!document.querySelector('#detail, .detail') && (document.querySelector('#detail') || document.querySelector('.detail')).textContent.length, days: document.querySelectorAll('#days li, #days tr, #days .day').length, note: document.querySelector('#mapnote').hidden ? '(hidden)' : document.querySelector('#mapnote').textContent }));
    await page.waitForTimeout(name === 'slowD3' ? 4000 : 1500);
    const late = await page.evaluate(() => ({ markers: document.querySelectorAll('#map .mk, #map g.marker, #map circle').length, note: document.querySelector('#mapnote').hidden ? '(hidden)' : document.querySelector('#mapnote').textContent, jserr: document.querySelector('#jserr').hidden ? '(hidden)' : document.querySelector('#jserr').textContent }));
    console.log(name, JSON.stringify(early), JSON.stringify(late), errors);
    if (name === 'noCdn') await page.screenshot({ path: path.join(root, 'test', 'phone-nocdn.png') });
    await ctx.close();
  }
  await browser.close();
})();
