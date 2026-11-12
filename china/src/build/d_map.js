/* ---------- core ---------- */
const T = window.TRIP;
const S = {}; T.stops.forEach(s => { S[s.n] = s; });
const doc = document;
const $ = (q, el) => (el || doc).querySelector(q);
const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => '£' + (Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : n.toFixed(2));
const whole = n => Math.abs(n - Math.round(n)) < 0.005;
const range = (lo, hi) => Math.abs(hi - lo) < 0.005 ? money(lo) : whole(lo) && whole(hi) ? money(lo) + '–' + money(hi).slice(1) : '£' + lo.toFixed(2) + '–' + hi.toFixed(2);
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const parseISO = d => { const a = d.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); };
const isoOf = dt => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
const fmtDay = d => { const dt = parseISO(d); return DOW[dt.getDay()] + ' ' + dt.getDate() + ' ' + MON[dt.getMonth()]; };
const daysFrom = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
const TODAY = isoOf(new Date());
const TRIP_START = T.days[0][0], TRIP_END = T.days[T.days.length - 1][0];

const lastDate = {};
T.days.forEach(r => { if (!lastDate[r[1]] || r[0] > lastDate[r[1]]) lastDate[r[1]] = r[0]; });
T.legs.forEach(L => [L.a, L.b].concat(L.via || []).forEach(n => { if (!lastDate[n] || L.date > lastDate[n]) lastDate[n] = L.date; }));
const isPast = n => !!(S[n] && S[n].done) || (!!lastDate[n] && lastDate[n] < TODAY);

function todayStop() {
  if (TODAY < TRIP_START) return 1;
  if (TODAY > TRIP_END) return T.stops[T.stops.length - 1].n;
  const row = T.days.find(r => r[0] === TODAY);
  return row ? row[1] : 1;
}
const state = { sel: 1, today: todayStop(), geo: null, geoLabel: '', fs: false };

/* ---------- map setup ---------- */
const mapbox = $('#mapbox'), mapinner = $('#mapinner');
let svg, gVp, gCountries, gRange, gRangeIn, gRangeOut, gBorder, gGrat, gWater, gCLab, gLegs, gLead, gMk, gLab, gScale;
function initMapDom() {
  svg = d3.select('#map');
  svg.selectAll('*').remove(); lastK = 0;
  /* mountains are a light hatch, not a fill, so country colours show through; borders are drawn again on top */
  const defs = svg.append('defs');
  const pat = defs.append('pattern').attr('id', 'mtnpat').attr('patternUnits', 'userSpaceOnUse').attr('width', 5).attr('height', 5).attr('patternTransform', 'rotate(45)');
  pat.append('path').attr('class', 'mtnhatch').attr('d', 'M0,0V5');
  /* hatch is strong inside China and faint outside: a faint copy everywhere, plus a full copy clipped to China.
     A one-path clip stays cheap while zooming; an SVG mask made zoomed-in frames crawl on phones. */
  defs.append('clipPath').attr('id', 'cnclip').append('path');
  gVp = svg.append('g'); gCountries = gVp.append('g'); gRange = gVp.append('g'); gRangeOut = gRange.append('g'); gRangeIn = gRange.append('g'); gBorder = gVp.append('g'); gGrat = gVp.append('g'); gWater = gVp.append('g');
  gCLab = svg.append('g'); gLegs = svg.append('g'); gLead = svg.append('g'); gMk = svg.append('g'); gLab = svg.append('g');
  gScale = svg.append('g').attr('class', 'scale');
  /* a tap on the small map opens it full screen */
  svg.on('click.open', () => { if (!state.fs) openMap(0); });
}
let W = 0, H = 0, proj = null, zoomB = null, t = { k: 1, x: 0, y: 0 };
const base = {};
const BB = { w: 72.6, e: 118.2, s: 20.3, n: 44.0 };
const ROUTE_C = new Set(['CHN', 'VNM', 'China', 'Vietnam']);
const CC = { CHN: 'chn', China: 'chn', VNM: 'vnm', Vietnam: 'vnm', KGZ: 'kgz', Kyrgyzstan: 'kgz', TJK: 'tjk', Tajikistan: 'tjk', KAZ: 'kaz', Kazakhstan: 'kaz', MNG: 'mng', Mongolia: 'mng',
  LAO: 'lao', Laos: 'lao', MMR: 'mmr', Myanmar: 'mmr', IND: 'ind', India: 'ind', PAK: 'pak', Pakistan: 'pak', NPL: 'npl', Nepal: 'npl', BTN: 'btn', Bhutan: 'btn', BGD: 'bgd', Bangladesh: 'bgd', AFG: 'afg', Afghanistan: 'afg', THA: 'tha', Thailand: 'tha' };

function setup() {
  const r = mapinner.getBoundingClientRect();
  W = Math.max(260, Math.round(r.width));
  H = Math.max(200, Math.round(r.height));
  svg.attr('viewBox', '0 0 ' + W + ' ' + H);
  const rad = d => d * Math.PI / 180;
  const ym = lat => Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2));
  const pad = 18;
  const sc = Math.min((W - 2 * pad) / rad(BB.e - BB.w), (H - 2 * pad - 12) / (ym(BB.n) - ym(BB.s)));
  const latc = (2 * Math.atan(Math.exp((ym(BB.n) + ym(BB.s)) / 2)) - Math.PI / 2) * 180 / Math.PI;
  /* when the box is width-bound (phones), lift the route so the south end clears the zoom buttons */
  const spare = Math.max(0, (H - 2 * pad - 12) - sc * (ym(BB.n) - ym(BB.s)));
  proj = d3.geoMercator().scale(sc).center([(BB.w + BB.e) / 2, latc]).translate([W / 2, H / 2 - spare * 0.38]);
  T.stops.forEach(s => { base[s.n] = proj([s.lon, s.lat]); });
  zoomB = d3.zoom().scaleExtent([1, 16]).extent([[0, 0], [W, H]]).translateExtent(state.fs ? [[-W * 0.5, -H * 0.6], [W * 1.5, H * 1.6]] : [[0, 0], [W, H]])
    .filter(zoomFilter).on('zoom', ev => { t = ev.transform; gVp.attr('transform', t); zoomClass(); redraw(); });
  svg.call(zoomB);
  t = d3.zoomIdentity;
  svg.call(zoomB.transform, t);
  drawGrat();
  drawCountries();
  safe('physical map', drawPhysical);
  zoomClass();
  redraw();
}
/* only touch the svg when the zoom level changes, not on every pan frame */
let lastK = 0;
const zoomClass = () => { if (t.k === lastK && svg.attr('data-z')) return; lastK = t.k; svg.attr('data-z', t.k < 2 ? 1 : t.k < 4 ? 2 : 3); svg.select('#mtnpat').attr('patternTransform', 'scale(' + (1 / t.k).toFixed(4) + ') rotate(45)'); };

/* mountain ranges, lakes and rivers (Natural Earth, bundled in TRIP.geo) */
let PHYS = null;
function drawPhysical() {
  const g = T.geo; if (!g) return;
  if (!PHYS) { const dec = e => decodeRing(e[2], [e[0], e[1]], g.s); PHYS = { ranges: g.ranges.map(r => r[1].map(dec)), lakes: g.lakes.map(l => l[1].map(dec)), rivers: g.rivers.map(r => [r[0], dec(r[1])]) }; }
  const line = pts => { let d = ''; for (let i = 0; i < pts.length; i++) { const p = proj(pts[i]); d += (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); } return d; };
  const rd = PHYS.ranges.map(rs => rs.map(r => line(r) + 'Z').join('')).join('');
  gRangeOut.selectAll('path').data([rd]).join('path').attr('class', 'rng out').attr('d', d => d);
  gRangeIn.selectAll('path').data([rd]).join('path').attr('class', 'rng').attr('d', d => d);
  const rv = [1, 2, 3].map(c => PHYS.rivers.filter(r => (r[0] <= 3 ? 1 : r[0] <= 6 ? 2 : 3) === c).map(r => line(r[1])).join(''));
  gWater.selectAll('path.rv').data(rv).join('path').attr('class', (d, i) => 'rv r' + (i + 1)).attr('d', d => d);
  gWater.selectAll('path.lk').data([PHYS.lakes.map(ls => ls.map(r => line(r) + 'Z').join('')).join('')]).join('path').attr('class', 'lk').attr('d', d => d);
}

/* the small map ignores gestures so the page scrolls past it; full screen takes every gesture */
function zoomFilter(ev) {
  if (!state.fs) return false;
  if (ev.type === 'mousedown') return ev.button === 0;
  return !ev.button;
}

function drawGrat() {
  let d = '';
  for (let lon = 65; lon <= 125; lon += 5) { const a = proj([lon, 12]), b = proj([lon, 50]); d += 'M' + a[0].toFixed(1) + ',' + a[1].toFixed(1) + 'L' + b[0].toFixed(1) + ',' + b[1].toFixed(1); }
  for (let lat = 15; lat <= 45; lat += 5) { const a = proj([60, lat]), b = proj([130, lat]); d += 'M' + a[0].toFixed(1) + ',' + a[1].toFixed(1) + 'L' + b[0].toFixed(1) + ',' + b[1].toFixed(1); }
  gGrat.selectAll('path').data([d]).join('path').attr('class', 'grat').attr('d', d);
}

/* ---------- country outlines, loaded at runtime from script CDNs ---------- */
function ringsOf(g) {
  if (!g) return [];
  if (g.type === 'Polygon') return g.coordinates;
  if (g.type === 'MultiPolygon') return [].concat.apply([], g.coordinates);
  return [];
}
function ringInWindow(r) {
  let w = 1e9, e = -1e9, s = 1e9, n = -1e9;
  for (const p of r) { if (p[0] < w) w = p[0]; if (p[0] > e) e = p[0]; if (p[1] < s) s = p[1]; if (p[1] > n) n = p[1]; }
  return e > 60 && w < 130 && n > 10 && s < 55;
}
function drawCountries() {
  if (!state.geo) { gCountries.selectAll('path').remove(); gBorder.selectAll('path').remove(); return; }
  const rows = state.geo.map(f => {
    let d = '';
    ringsOf(f.geom).forEach(r => {
      if (!r || r.length < 3 || !ringInWindow(r)) return;
      for (let i = 0; i < r.length; i++) { const p = proj(r[i]); d += (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }
      d += 'Z';
    });
    return { d, route: ROUTE_C.has(f.id) || ROUTE_C.has(f.name), cc: CC[f.id] || CC[f.name] || '' };
  }).filter(x => x.d);
  gCountries.selectAll('path').data(rows).join('path')
    .attr('class', x => 'c-land' + (x.route ? ' route' : '') + (x.cc ? ' cc-' + x.cc : '')).attr('d', x => x.d);
  gBorder.selectAll('path').data(rows).join('path').attr('class', 'c-border').attr('d', x => x.d);
  const cn = rows.filter(x => x.cc === 'chn').map(x => x.d).join('');
  svg.select('#cnclip path').attr('d', cn || null);
  gRangeIn.attr('clip-path', cn ? 'url(#cnclip)' : null);
}

function loadScript(url, ms) {
  return new Promise((res, rej) => {
    const el = doc.createElement('script');
    el.src = url; el.async = true;
    const timer = setTimeout(() => { el.onload = el.onerror = null; rej(new Error('timeout')); }, ms);
    el.onload = () => { clearTimeout(timer); res(); };
    el.onerror = () => { clearTimeout(timer); rej(new Error('failed')); };
    (doc.head || doc.body).appendChild(el);
  });
}
async function fromDatamaps(url) {
  if (!window.topojson || !window.topojson.feature) throw new Error('topojson missing');
  await loadScript(url, 20000);
  const DM = window.Datamap || window.Datamaps;
  const topo = DM && DM.prototype && DM.prototype.worldTopo;
  if (!topo || typeof topo !== 'object' || !topo.objects) throw new Error('no world topology');
  const key = topo.objects.world ? 'world' : Object.keys(topo.objects)[0];
  const fc = window.topojson.feature(topo, topo.objects[key]);
  return fc.features.map(f => ({ id: f.id, name: f.properties && f.properties.name, geom: f.geometry }));
}
function decodeRing(c, off, scale) {
  const out = []; let px = off[0], py = off[1];
  for (let i = 0; i < c.length; i += 2) {
    let x = c.charCodeAt(i) - 64, y = c.charCodeAt(i + 1) - 64;
    x = (x >> 1) ^ (-(x & 1)); y = (y >> 1) ^ (-(y & 1));
    x += px; y += py; px = x; py = y;
    out.push([x / scale, y / scale]);
  }
  return out;
}
function decodeEcharts(json) {
  if (!json.UTF8Encoding) return json;
  const scale = json.UTF8Scale == null ? 1024 : json.UTF8Scale;
  json.features.forEach(f => {
    const g = f.geometry; if (!g) return;
    const off = g.encodeOffsets;
    g.coordinates.forEach((c, i) => {
      if (g.type === 'Polygon') { if (typeof c === 'string') g.coordinates[i] = decodeRing(c, off[i], scale); }
      else if (g.type === 'MultiPolygon') c.forEach((p, j) => { if (typeof p === 'string') c[j] = decodeRing(p, off[i][j], scale); });
    });
  });
  json.UTF8Encoding = false;
  return json;
}
async function fromEcharts(url) {
  let got = null;
  const had = Object.prototype.hasOwnProperty.call(window, 'echarts'), prev = window.echarts;
  window.echarts = { registerMap: (name, json) => { if (!got) got = json; } };
  try { await loadScript(url, 20000); }
  finally { if (had) window.echarts = prev; else { try { delete window.echarts; } catch (e) { window.echarts = undefined; } } }
  if (!got || !got.features) throw new Error('no map registered');
  return decodeEcharts(got).features.map(f => ({ id: f.id, name: f.properties && f.properties.name, geom: f.geometry }));
}
const GEO_SOURCES = [
  ['datamaps', 'https://cdnjs.cloudflare.com/ajax/libs/datamaps/0.5.9/datamaps.world.hires.min.js', 'Natural Earth (via Datamaps)'],
  ['datamaps', 'https://cdn.jsdelivr.net/npm/datamaps@0.5.9/dist/datamaps.world.hires.min.js', 'Natural Earth (via Datamaps)'],
  ['datamaps', 'https://cdnjs.cloudflare.com/ajax/libs/datamaps/0.5.9/datamaps.world.min.js', 'Natural Earth (via Datamaps)'],
  ['echarts', 'https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/js/world.js', 'the ECharts world map']
];
async function loadGeo() {
  const note = $('#mapnote');
  note.hidden = false; note.textContent = 'Loading country borders…';
  for (const src of GEO_SOURCES) {
    try {
      const feats = src[0] === 'datamaps' ? await fromDatamaps(src[1]) : await fromEcharts(src[1]);
      if (!feats || feats.length < 50) throw new Error('too few shapes');
      state.geo = feats; state.geoLabel = src[2];
      drawCountries(); redraw();
      note.hidden = true;
      const cav = $('#geosrc'); if (cav) cav.textContent = 'Borders: ' + src[2] + '.';
      return;
    } catch (e) { /* try the next source */ }
  }
  note.textContent = "Country borders didn't load (no connection?). The stops and routes are still in the right places.";
}

/* ---------- screen-space drawing: routes, markers, labels, scale ---------- */
const ptOf = k => typeof k === 'number' ? [S[k].lon, S[k].lat] : Array.isArray(k) ? k : T.wp[k];
function segPts(seg) {
  const v = seg[1];
  if (typeof v === 'string' && v.charAt(0) === '@') {
    const rev = v.slice(-1) === '~', pts = (T.roads && T.roads[v.slice(1).replace('~', '')]) || [];
    return rev ? pts.slice().reverse() : pts;
  }
  return v.map(ptOf);
}
/* direction arrows: evenly spaced along each segment, in screen space so they keep their size when zoomed */
const ARR_GAP = 75, ARR_MIN = 24;
function arrowsAlong(pts, mode) {
  const out = [];
  if (!pts || pts.length < 2) return out;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];
  if (total < ARR_MIN) return out;
  const at = dist => {
    dist = Math.max(0, Math.min(total, dist));
    let i = 1; while (i < cum.length - 1 && cum[i] < dist) i++;
    const l = cum[i] - cum[i - 1] || 1, f = (dist - cum[i - 1]) / l;
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
  };
  const n = Math.max(1, Math.floor(total / ARR_GAP)), step = total / n;
  for (let k = 0; k < n; k++) {
    const m = step * (k + 0.5), p = at(m), a = at(m - 9), b = at(m + 9);
    if (p[0] < -20 || p[0] > W + 20 || p[1] < -20 || p[1] > H + 20) continue;
    out.push({ x: p[0], y: p[1], ang: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI, mode });
  }
  return out;
}

function drawLegs() {
  const sel = state.sel;
  const g = gLegs.selectAll('g.leg').data(T.legs, L => L.id).join('g');
  g.each(function (L) {
    const hot = L.a === sel || L.b === sel || (L.via || []).indexOf(sel) >= 0;
    this.setAttribute('class', 'leg' + (hot ? ' hot' : '') + (L.status === 'done' || L.date < TODAY ? ' done' : ''));
    const parts = [], arrs = [];
    L.segs.forEach(seg => {
      const sp = segPts(seg).map(q => t.apply(proj(q)));
      const d = 'M' + sp.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L');
      if (seg[0] === 'rail') { parts.push(['rail', d]); parts.push(['tie', d]); } else parts.push([seg[0], d]);
      if (seg[0] !== 'day') arrowsAlong(sp, seg[0]).forEach(a => arrs.push(a));
    });
    const sel3 = d3.select(this);
    sel3.selectAll('path.ln').data(parts).join('path').attr('class', p => 'ln ' + p[0]).attr('d', p => p[1]);
    sel3.selectAll('path.arr').data(arrs).join('path').attr('class', a => 'arr a-' + a.mode)
      .attr('d', a => a.mode === 'rail' ? 'M-5.5,-6L6.2,0L-5.5,6Z' : 'M-4.6,-4.9L5.1,0L-4.6,4.9Z')
      .attr('transform', a => 'translate(' + a.x.toFixed(1) + ',' + a.y.toFixed(1) + ') rotate(' + a.ang.toFixed(1) + ')');
  });
  gLegs.selectAll('g.leg.hot').raise();
}

function layoutMarkers() {
  const R = 11, minD = 2 * R + 2;
  const P = T.stops.map(s => t.apply(base[s.n]));
  const vis = P.map(p => p[0] > -24 && p[0] < W + 24 && p[1] > -24 && p[1] < H + 24);
  const Q = P.map(p => [p[0], p[1]]);
  const idx = []; vis.forEach((v, i) => { if (v) idx.push(i); });
  for (let it = 0; it < 90; it++) {
    for (const i of idx) { Q[i][0] += (P[i][0] - Q[i][0]) * 0.08; Q[i][1] += (P[i][1] - Q[i][1]) * 0.08; }
    for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) {
      const i = idx[a], j = idx[b];
      let dx = Q[j][0] - Q[i][0], dy = Q[j][1] - Q[i][1], d = Math.hypot(dx, dy);
      if (d >= minD) continue;
      if (d < 1e-3) { const ang = i * 2.39996 + j; dx = Math.cos(ang); dy = Math.sin(ang); d = 1; }
      const push = (minD - d) / 2, ux = dx / d, uy = dy / d;
      Q[i][0] -= ux * push; Q[i][1] -= uy * push; Q[j][0] += ux * push; Q[j][1] += uy * push;
    }
  }
  return { P, Q, vis };
}

function drawMarkers(L) {
  const sel = state.sel, today = state.today;
  const data = [];
  T.stops.forEach((s, i) => { if (L.vis[i]) data.push({ s, p: L.P[i], q: L.Q[i] }); });
  const moved = data.filter(d => Math.hypot(d.q[0] - d.p[0], d.q[1] - d.p[1]) > 2.5);
  gLead.selectAll('g').data(moved, d => d.s.n).join(en => { const g = en.append('g'); g.append('line').attr('class', 'leader'); g.append('circle').attr('class', 'trudot').attr('r', 2.2); return g; })
    .each(function (d) {
      const g = d3.select(this);
      g.select('line').attr('x1', d.p[0]).attr('y1', d.p[1]).attr('x2', d.q[0]).attr('y2', d.q[1]);
      g.select('circle').attr('cx', d.p[0]).attr('cy', d.p[1]);
    });
  const mk = gMk.selectAll('g.mk').data(data, d => d.s.n).join(en => {
    const g = en.append('g').attr('tabindex', 0).attr('role', 'button');
    g.append('circle').attr('class', 'pulse').attr('r', 11);
    g.append('circle').attr('class', 'selring').attr('r', 16);
    g.append('circle').attr('class', 'hit').attr('r', 18);
    g.append('circle').attr('class', 'body').attr('r', 10.5);
    g.append('text').attr('dy', '0.36em');
    g.on('click', (ev, d) => { ev.stopPropagation(); onMarker(d); });
    g.on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onMarker(d); } });
    return g;
  });
  mk.attr('transform', d => 'translate(' + d.q[0].toFixed(1) + ',' + d.q[1].toFixed(1) + ')')
    .attr('class', d => 'mk' + (d.s.kind === 'pass' ? ' pass' : '') + (d.s.opt ? ' opt' : '') + (isPast(d.s.n) && d.s.n !== sel ? ' past' : '') + (d.s.n === sel ? ' sel' : ''))
    .attr('aria-label', d => 'Stop ' + d.s.n + ': ' + d.s.name + ', ' + d.s.dates);
  mk.select('text').text(d => d.s.n);
  mk.select('.pulse').style('display', d => d.s.n === today && TODAY >= TRIP_START && TODAY <= TRIP_END ? null : 'none');
  mk.select('.selring').style('display', d => d.s.n === sel ? null : 'none');
  mk.select('.body').attr('r', d => d.s.n === sel ? 12 : 10.5);
  mk.filter(d => d.s.n === sel).raise();
}

const mctx = doc.createElement('canvas').getContext('2d');
let wCache = {};
function textW(txt, font) {
  const key = font + '|' + txt;
  if (wCache[key]) return wCache[key];
  let w = 0;
  try { mctx.font = font; w = mctx.measureText(txt).width; } catch (e) { w = 0; }
  if (!w) w = txt.length * 6.8;
  return (wCache[key] = w);
}
const FONT = '"Atkinson Hyperlegible", system-ui, sans-serif';

function drawLabels(L) {
  gLab.selectAll('*').remove();
  gCLab.selectAll('*').remove();
  const boxes = state.fs ? [[0, 0, 64, 240], [0, H - 56, 150, 56]] : [[W - 128, H - 50, 128, 50], [0, H - 30, 140, 30]];
  const hit = b => boxes.some(o => b[0] < o[0] + o[2] && b[0] + b[2] > o[0] && b[1] < o[1] + o[3] && b[1] + b[3] > o[1]);
  const inB = b => b[0] >= 2 && b[1] >= 2 && b[0] + b[2] <= W - 2 && b[1] + b[3] <= H - 2;
  T.stops.forEach((s, i) => { if (L.vis[i]) boxes.push([L.Q[i][0] - 12, L.Q[i][1] - 12, 24, 24]); });
  const mboxes = boxes.slice();
  const hitM = b => mboxes.some(o => b[0] < o[0] + o[2] && b[0] + b[2] > o[0] && b[1] < o[1] + o[3] && b[1] + b[3] > o[1]);
  const order = T.stops.map((s, i) => i).filter(i => L.vis[i]);
  const rank = s => (s.n === state.sel ? 0 : s.kind === 'stay' ? 1 : 2);
  order.sort((a, b) => rank(T.stops[a]) - rank(T.stops[b]) || a - b);
  order.forEach(i => {
    const s = T.stops[i], q = L.Q[i], sel = s.n === state.sel;
    const font = (sel ? '700 13px ' : '700 12px ') + FONT;
    const w = textW(s.name, font), h = sel ? 13 : 12, r = sel ? 16 : 12;
    const C = [[q[0] + r + 2, q[1] + h / 2 - 2, 'start'], [q[0] - r - 2, q[1] + h / 2 - 2, 'end'], [q[0], q[1] + r + h, 'middle'], [q[0], q[1] - r - 4, 'middle'],
      [q[0] + r - 3, q[1] - r + 1, 'start'], [q[0] + r - 3, q[1] + r + h - 3, 'start'], [q[0] - r + 3, q[1] - r + 1, 'end'], [q[0] - r + 3, q[1] + r + h - 3, 'end']];
    let pick = null;
    for (const c of C) {
      const x0 = c[2] === 'start' ? c[0] : c[2] === 'end' ? c[0] - w : c[0] - w / 2;
      const b = [x0 - 2, c[1] - h + 1, w + 4, h + 2];
      if (inB(b) && !hit(b)) { boxes.push(b); pick = c; break; }
    }
    if (!pick && sel) {
      /* the chosen stop always gets a label: take the first spot inside the map and keep later labels off it */
      const xc = Math.max(4, Math.min(W - 4 - w, q[0] - w / 2));
      const C2 = C.concat([[xc, q[1] - r - 4, 'start'], [xc, q[1] + r + h, 'start']]);
      for (const loose of [false, true]) {
        for (const c of C2) {
          const x0 = c[2] === 'start' ? c[0] : c[2] === 'end' ? c[0] - w : c[0] - w / 2;
          const b = [x0 - 2, c[1] - h + 1, w + 4, h + 2];
          if (inB(b) && (loose || !hitM(b))) { boxes.push(b); pick = c; break; }
        }
        if (pick) break;
      }
      if (!pick) pick = (q[0] + r + 2 + w < W - 4) ? C[0] : C[1];
    }
    if (pick) gLab.append('text').attr('class', 'lab' + (sel ? ' sel' : '')).attr('x', pick[0].toFixed(1)).attr('y', pick[1].toFixed(1)).attr('text-anchor', pick[2]).text(s.name);
  });
  const xf = 'italic 400 11.5px ' + FONT, mf = 'italic 600 10px ' + FONT, pf = '600 10.5px ' + FONT;
  T.contextLabels.forEach(c => {
    if (t.k < c[4]) return;
    const p = t.apply(proj([c[1], c[2]]));
    if (c[3] === 'peak') {
      /* a triangle on the summit, the name beside it; if a stop marker sits on the summit, the name goes just clear of it with a ▲ in front */
      const tb = [p[0] - 5, p[1] - 5, 10, 10];
      if (!inB(tb)) return;
      const onMarker = hitM(tb), txt = onMarker ? '▲ ' + c[0] : c[0], w = textW(txt, pf);
      const C = onMarker ? [[0, 26, 'middle'], [0, -18, 'middle'], [18, 3.6, 'start'], [-18, 3.6, 'end'], [16, 20, 'start'], [-16, 20, 'end'], [16, -13, 'start'], [-16, -13, 'end'], [0, 40, 'middle']]
        : [[7, 3.6, 'start'], [-7, 3.6, 'end'], [0, 16, 'middle'], [0, -8, 'middle']];
      for (const q of C) {
        const x = p[0] + q[0], y = p[1] + q[1], x0 = q[2] === 'start' ? x : q[2] === 'end' ? x - w : x - w / 2;
        const lb = [x0 - 2, y - 10, w + 4, 13];
        if (!inB(lb) || hit(lb) || (!onMarker && hit(tb))) continue;
        boxes.push(lb);
        if (!onMarker) { boxes.push(tb); gLab.append('path').attr('class', 'pk').attr('d', 'M' + (p[0] - 4.6).toFixed(1) + ',' + (p[1] + 3.6).toFixed(1) + 'L' + p[0].toFixed(1) + ',' + (p[1] - 4.4).toFixed(1) + 'L' + (p[0] + 4.6).toFixed(1) + ',' + (p[1] + 3.6).toFixed(1) + 'Z'); }
        gLab.append('text').attr('class', 'xlab peak').attr('x', x.toFixed(1)).attr('y', y.toFixed(1)).attr('text-anchor', q[2]).text(txt);
        break;
      }
      return;
    }
    const txt = c[3] === 'mtn' ? c[0].toUpperCase() : c[0];
    const w = c[3] === 'mtn' ? textW(txt, mf) + txt.length * 1.2 : textW(txt, xf);
    const b = [p[0] - w / 2 - 2, p[1] - 11, w + 4, 14];
    if (!inB(b) || hit(b)) return;
    boxes.push(b);
    gLab.append('text').attr('class', 'xlab' + (c[3] ? ' ' + c[3] : '')).attr('x', p[0].toFixed(1)).attr('y', p[1].toFixed(1)).attr('text-anchor', 'middle').text(txt);
  });
  /* country names last, so stop names, summits and rivers win any clash */
  const cf = '700 10.5px ' + FONT;
  T.countryLabels.forEach(c => {
    const p = t.apply(proj([c[1], c[2]]));
    const w = textW(c[0], cf) + c[0].length * 1.7;
    const b = [p[0] - w / 2, p[1] - 9, w, 12];
    if (!inB(b) || hit(b)) return;
    boxes.push(b);
    gCLab.append('text').attr('class', 'clab').attr('x', p[0]).attr('y', p[1]).attr('text-anchor', 'middle').text(c[0]);
  });
}

function drawScale() {
  const c = proj.invert([(W / 2 - t.x) / t.k, (H / 2 - t.y) / t.k]);
  const pxPerKm = proj.scale() * t.k / (6371 * Math.cos(c[1] * Math.PI / 180));
  const km = [500, 200, 100, 50, 20, 10, 5].find(v => v * pxPerKm <= 110) || 5;
  const len = km * pxPerKm, x = 12, y = H - 12;
  gScale.selectAll('*').remove();
  gScale.append('line').attr('x1', x).attr('x2', x + len).attr('y1', y).attr('y2', y);
  gScale.append('line').attr('x1', x).attr('x2', x).attr('y1', y - 4).attr('y2', y + 1);
  gScale.append('line').attr('x1', x + len).attr('x2', x + len).attr('y1', y - 4).attr('y2', y + 1);
  gScale.append('text').attr('x', x + len + 6).attr('y', y + 3).text(km + ' km');
}

function redraw() {
  if (!proj) return;
  drawLegs();
  const L = layoutMarkers();
  state.layout = L;
  drawMarkers(L);
  drawLabels(L);
  drawScale();
}

/* centre a stop in the part of the map the stop panel doesn't cover */
function flyTo(n) {
  if (!proj || !zoomB || !state.fs) return;
  const b = base[n];
  let dmin = 1e9;
  T.stops.forEach(o => { if (o.n !== n) { const p = base[o.n]; dmin = Math.min(dmin, Math.hypot(p[0] - b[0], p[1] - b[1])); } });
  const need = dmin < 30 ? Math.min(9, 30 / dmin) : 1;
  const k = Math.max(2.4, Math.min(9, Math.max(need, Math.min(t.k, 3.5))));
  let cx = W / 2, cy = H / 2;
  const pop = $('#pop-' + n), mr = mapinner.getBoundingClientRect();
  if (pop && pop.getClientRects().length) {
    const pr = pop.getBoundingClientRect();
    if (pr.left > mr.left + W * 0.35) cx = Math.max(60, (pr.left - mr.left) / 2 + 20);
    else if (pr.top > mr.top + 40) cy = Math.max(70, (pr.top - mr.top) / 2 + 20);
  }
  const tr = d3.zoomIdentity.translate(cx - k * b[0], cy - k * b[1]).scale(k);
  svg.interrupt().transition().duration(reduce ? 0 : 650).call(zoomB.transform, tr);
}
function onMarker(d) { openMap(d.s.n); }

$('#zin').addEventListener('click', () => { if (zoomB) svg.transition().duration(reduce ? 0 : 220).call(zoomB.scaleBy, 1.8); });
$('#zout').addEventListener('click', () => { if (zoomB) svg.transition().duration(reduce ? 0 : 220).call(zoomB.scaleBy, 1 / 1.8); });
$('#zreset').addEventListener('click', () => { if (zoomB) svg.transition().duration(reduce ? 0 : 320).call(zoomB.transform, d3.zoomIdentity); });
