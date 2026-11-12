const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const page0 = fs.readFileSync(path.join(root, 'almaty-to-kashgar.html'), 'utf8');
const fontFix = '<style>:root{--f-display:"Inter Display","Inter",sans-serif;--f-body:"Inter",sans-serif;--f-mono:"DejaVu Sans Mono",monospace}.wrap{padding-block:14px 20px}.mapcol{position:static!important}</style>';
const html = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>' + page0 + fontFix + '</body></html>';
const f = path.join(root, 'test', 'pdf-src.html'); fs.writeFileSync(f, html);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'light', viewport: { width: 430, height: 900 } });
  const page = await ctx.newPage();
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + f);
  await page.emulateMedia({ media: 'print', colorScheme: 'light' });
  const out = path.join(root, 'out', 'Almaty to Kashgar plan.pdf');
  await page.pdf({ path: out, width: '430px', height: '880px', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  await browser.close();
  console.log(out, fs.statSync(out).size);
})();
