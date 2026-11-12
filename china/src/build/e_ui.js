/* ---------- shared bits ---------- */
const STATUS = {
  booked: ['ok', 'Booked'], now: ['crit', 'Book now'], week: ['warn', 'Book a week ahead'],
  ahead: ['warn', 'Buy a day ahead'], check: ['warn', 'Times vary'], day: ['', 'Pay on the day'], done: ['', '']
};
const LINE = {
  road: '<path d="M1 5h20" stroke="var(--road)" stroke-width="2.6" stroke-linecap="round"/>',
  rail: '<path d="M1 5h20" stroke="var(--rail)" stroke-width="5"/><path d="M1 5h20" stroke="var(--panel)" stroke-width="1.6" stroke-dasharray="4 4"/>',
  hike: '<path d="M2 5h18" stroke="var(--hike)" stroke-width="3.2" stroke-linecap="round" stroke-dasharray=".1 6"/>',
  day: '<path d="M1 5h20" stroke="var(--road)" stroke-width="2.4" stroke-dasharray="6 4"/>',
  air: '<path d="M2 5h18" stroke="var(--ink-2)" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="1 5"/>'
};
const MODE_WORD = { road: 'by road', rail: 'by train', hike: 'on foot', day: 'day trip', air: 'by air' };
const icon = m => '<svg class="modeicon" viewBox="0 0 22 10" role="img" aria-label="' + MODE_WORD[m] + '">' + LINE[m] + '</svg>';
const inTrip = TODAY >= TRIP_START && TODAY <= TRIP_END;
const gmaps = s => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.q) + (s.pid ? '&query_place_id=' + encodeURIComponent(s.pid) : '');
const gsearch = q => 'https://www.google.com/search?q=' + encodeURIComponent(q);
const gimg = q => 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(q);
const gmapq = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
const inChina = s => /China/.test(s.cc);
const amapPoint = s => 'https://uri.amap.com/marker?position=' + s.lon.toFixed(5) + ',' + s.lat.toFixed(5) + '&name=' + encodeURIComponent(s.zh || s.name) + '&coordinate=wgs84&src=trip-plan&callnative=0';
const amapSearch = kw => 'https://uri.amap.com/search?keyword=' + encodeURIComponent(kw) + '&view=map&src=trip-plan&callnative=0';
const ctxOf = s => s.ctx || s.name;
const CHEV = '<span class="chev" aria-hidden="true"></span>';
/* [[Name|what it is|search words]] in the data becomes a Google-search link, with the short description in brackets */
function rich(txt) {
  txt = String(txt == null ? '' : txt);
  const re = /\[\[([^|\]]+)(?:\|([^|\]]+))?(?:\|([^|\]]+))?\]\]/g;
  let out = '', i = 0, m;
  while ((m = re.exec(txt))) {
    out += esc(txt.slice(i, m.index));
    out += '<a href="' + esc(gsearch(m[3] || m[1])) + '" target="_blank" rel="noopener">' + esc(m[1]) + '</a>' + (m[2] ? ' <span class="what">(' + esc(m[2]) + ')</span>' : '');
    i = re.lastIndex;
  }
  return out + esc(txt.slice(i));
}
/* the first n sentences, never cutting inside a [[link]] */
function sentences(txt, n) {
  txt = String(txt || ''); let depth = 0, count = 0;
  for (let i = 0; i < txt.length; i++) {
    if (txt[i] === '[' && txt[i + 1] === '[') depth++;
    if (txt[i] === ']' && txt[i + 1] === ']') depth--;
    if (!depth && /[.!?]/.test(txt[i]) && (i === txt.length - 1 || txt[i + 1] === ' ') && !/\b(e\.g|i\.e|approx|est|No)$/.test(txt.slice(Math.max(0, i - 6), i))) {
      if (++count >= n) return txt.slice(0, i + 1);
    }
  }
  return txt;
}
const ext = (txt, url, cls) => '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(txt) + '</a>';
const sub = (title, inner, count, open) => '<details class="sub"' + (open ? ' open' : '') + '><summary><span>' + esc(title) + '</span>' +
  (count ? '<span class="cnt">' + count + '</span>' : '') + CHEV + '</summary><div class="subin">' + inner + '</div></details>';
const gotoBtn = (n, txt, cls) => '<label class="' + (cls || 'btn-sm') + '" for="v-route" data-goto="' + n + '">' + esc(txt) + '</label>';

function legCard(L, n) {
  const from = S[L.a], to = S[L.b];
  const dir = L.a === L.b ? 'Day out from ' + from.name : L.b === n ? 'Arrive from ' + from.name : L.a === n ? 'Leave for ' + to.name : from.name + ' → ' + to.name + ' (change here)';
  const st = STATUS[L.status] || ['', ''];
  const modes = L.segs.map(x => x[0]).filter((m, i, a) => a.indexOf(m) === i);
  const pills = [];
  if (st[1]) pills.push('<span class="pill ' + st[0] + '">' + esc(st[1]) + '</span>');
  if (L.hitch) pills.push('<span class="pill acc">Hitchable</span>');
  if (L.opt) pills.push('<span class="pill">Optional</span>');
  const price = (L.price[1] > 0 ? range(L.price[0], L.price[1]) : '—') + (L.est ? ' <span class="pill">est.</span>' : '');
  return '<div class="legcard">' +
    '<div class="legtop">' + modes.map(icon).join('') + '<span class="mono">' + esc(L.date ? fmtDay(L.date) : 'Done') + '</span><span class="legtitle">' + esc(dir) + '</span></div>' +
    '<div class="legsub"><b>' + esc(L.title) + '</b>' + (L.time ? ' · ' + esc(L.time) : '') + '</div>' +
    (L.tt ? '<div class="legsub tt">' + esc(L.tt) + '</div>' : '') +
    '<div class="legtop"><span class="price">' + price + '</span>' + (L.ptxt ? '<span class="legsub">' + esc(L.ptxt) + '</span>' : '') + pills.join('') + '</div>' +
    (L.note ? '<div class="legsub">' + rich(L.note) + '</div>' : '') + '</div>';
}

/* Chinese mobiles get a WeChat button: it copies the number and opens WeChat (WeChat has no link that opens a chat by number) */
function contactsOf(o) {
  return (o.contacts || []).map(c => {
    const kind = c[0], digits = '+' + String(c[2] || c[1]).replace(/[^0-9]/g, '');
    const wx = kind === 'WeChat' ? c[1] : /^\+861\d{10}$/.test(digits) ? digits.slice(3) : '';
    const acts = (kind === 'WhatsApp' ? ext('WhatsApp', 'https://wa.me/' + digits.slice(1), 'btn-sm wa') : '') +
      (wx ? '<a class="btn-sm wx" href="weixin://" data-wx="' + esc(wx) + '" title="Copies the number and opens WeChat: + → Add Contacts → paste">WeChat</a>' : '') +
      '<button type="button" class="btn-sm js-only" data-copy="' + esc(c[1]) + '">Copy</button>' +
      (kind === 'WeChat' || kind === 'WhatsApp' ? '' : '<a class="btn-sm js-only" href="tel:' + esc(digits) + '">Call</a>');
    return '<div class="contact"><span class="minor">' + esc(kind) + '</span><span class="num">' + esc(c[1]) + '</span>' + acts + '</div>';
  }).join('');
}
function sleepOpt(o, s) {
  const plain = o.name.replace(/[　-鿿＀-￯].*$/, '').trim() || o.name;
  const where = plain + ' ' + ctxOf(s);
  const maps = [['Google Maps', gmapq(o.q || where)]];
  if (inChina(s) && o.zh) maps.push(['Amap', amapSearch(o.zh)]);
  const links = maps.concat(o.links || []).map(l => ext(l[0], l[1], 'btn-sm')).join('');
  const name = ext(o.name, o.url || gsearch(where));
  return '<div class="opt"><div class="legtop"><span class="opt-name">' + name + '</span>' +
    (o.pill && o.pill[1] ? '<span class="pill ' + esc(o.pill[0]) + '">' + esc(o.pill[1]) + '</span>' : '') + '</div>' +
    (o.price ? '<div class="legsub"><b>' + esc(o.price) + '</b></div>' : '') +
    (o.note ? '<div class="opt-note">' + rich(o.note) + '</div>' : '') + contactsOf(o) +
    (links ? '<div class="links-sm">' + links + '</div>' : '') + '</div>';
}

function foodItem(f, s) {
  const where = (f.q || f.name) + ' ' + ctxOf(s);
  const maps = [['Google Maps', gmapq(where)]];
  if (inChina(s) && f.zh) maps.push(['Amap', amapSearch(f.zh)]);
  return '<li><div class="food-name">' + ext(f.name, gsearch(where)) + (f.what ? ' <span class="what">(' + esc(f.what) + ')</span>' : '') + '</div>' +
    (f.note ? '<div class="opt-note">' + rich(f.note) + '</div>' : '') +
    '<div class="links-sm">' + maps.map(m => ext(m[0], m[1], 'btn-sm')).join('') + '</div></li>';
}

const byDate = (x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : T.legs.indexOf(x) - T.legs.indexOf(y);
function legsFor(n) { return T.legs.filter(L => L.a === n || L.b === n || (L.via || []).indexOf(n) >= 0).sort(byDate); }
function nextLegFrom(n) {
  const out = T.legs.filter(L => L.a === n).sort(byDate);
  return out.find(L => L.date >= TODAY) || out[0] || null;
}
const stopLinks = s => {
  const links = [['Photos', gimg(s.q)], ['Google Maps', gmaps(s)]];
  if (inChina(s)) links.push(['Amap', amapPoint(s)]);
  links.push(['Google search', gsearch(s.q)]);
  (s.links || []).forEach(l => links.push(l));
  return '<div class="links">' + links.map(l => ext(l[0], l[1])).join('') + '</div>';
};
const nightsWord = s => s.len;

/* ---------- route: stop cards ---------- */
function stopCard(s) {
  const n = s.n, legs = legsFor(n);
  let body = '<p class="d-what"><a href="' + esc(gsearch(s.q)) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a>' + (s.what ? ' (' + esc(s.what) + ')' : '') + '</p>' +
    '<p class="blurb">' + rich(s.blurb) + '</p>';
  if (s.plan && s.plan.length) body += '<ul class="plan">' + s.plan.map(p => '<li><span class="when">' + esc(p[0]) + '</span><span>' + rich(p[1]) + '</span></li>').join('') + '</ul>';
  if (legs.length) body += sub('Getting here and on', legs.map(L => legCard(L, n)).join(''), legs.length);
  let sleep = '';
  if (s.sleep && s.sleep.length) sleep = '<div class="opts">' + s.sleep.map(o => sleepOpt(o, s)).join('') + '</div>';
  else if (s.nosleep) sleep = '<p class="minor" style="margin:0">' + esc(s.nosleep) + '</p>';
  if (s.bed) sleep += '<p class="minor" style="margin:0">Beds here: <b class="mono">' + range(s.bed.lo, s.bed.hi) + '</b> for ' + s.bed.nights + ' night' + (s.bed.nights > 1 ? 's' : '') + (s.bed.note ? ' (' + esc(s.bed.note) + ')' : '') + '.</p>';
  if (sleep) body += sub('Where to sleep', sleep, s.sleep && s.sleep.length ? s.sleep.length : '');
  if (s.food && s.food.length) body += sub('Food', '<ul class="food">' + s.food.map(f => foodItem(f, s)).join('') + '</ul>', s.food.length);
  if (s.tips && s.tips.length) body += sub('Good to know', '<ul class="tips">' + s.tips.map(tp => '<li><span class="ic' + (tp[0] === 'info' ? ' info' : '') + '" aria-hidden="true">' + (tp[0] === 'info' ? 'i' : '!') + '</span><span>' + rich(tp[1]) + '</span></li>').join('') + '</ul>', s.tips.length);
  body += stopLinks(s);
  const here = s.n === state.today && inTrip;
  return '<details class="stop' + (isPast(n) ? ' past' : '') + '" name="stop" id="s' + n + '" data-n="' + n + '"><summary>' +
    '<span class="badge' + (s.kind === 'pass' ? ' pass' : '') + (here ? ' sel' : '') + '" aria-hidden="true">' + n + '</span>' +
    '<span class="s-main"><span class="s-name">' + esc(s.name) + '</span><span class="s-dates">' + esc(s.dates) + ' · ' + esc(nightsWord(s)) + '</span></span>' + CHEV +
    '</summary><div class="sbody">' + body + '</div></details>';
}
function renderStops() {
  $('#stoplist').innerHTML = T.stops.map(stopCard).join('');
  $('#stopsum').textContent = T.stops.length + ' stops · tap one to open it';
}

/* ---------- map: stop panel (bottom sheet in portrait, side panel in landscape) ---------- */
function popCard(s, i) {
  const prev = T.stops[i - 1], next = T.stops[i + 1];
  const nav = (o, dir) => o ? '<label class="pnav" for="ms-' + o.n + '" aria-label="' + (dir < 0 ? 'Previous' : 'Next') + ' stop: ' + esc(o.name) + '">' + (dir < 0 ? '‹ ' : '') + esc(o.name) + (dir > 0 ? ' ›' : '') + '</label>'
    : '<span class="pnav off">' + (dir < 0 ? 'Start' : 'End') + '</span>';
  const zh = s.zh ? ' <span class="p-zh" lang="zh">' + esc(s.zh.split(' ')[0]) + '</span>' : '';
  /* photo icon: a framed ink landscape with a red seal, linking to a Google Images search */
  const photo = '<a class="pphoto" href="' + esc(gimg(s.q)) + '" target="_blank" rel="noopener" aria-label="Photos of ' + esc(s.name) + '" title="Photos of ' + esc(s.name) + '">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M5.5 17.2 9.6 11.6l2.7 3 2.4-2.6 3.8 5.2"/><rect class="seal" x="14.6" y="7" width="3.6" height="3.6" rx=".5"/></svg></a>';
  let h = '<div class="pop-bar">' + nav(prev, -1) + nav(next, 1) + photo + '<label class="pclose" for="ms-open" aria-label="Close the stop panel">×</label></div>' +
    '<h3 class="p-title"><a href="' + esc(gsearch(s.q)) + '" target="_blank" rel="noopener">' + s.n + '. ' + esc(s.name) + '</a>' + zh + '</h3>' +
    '<div class="p-meta"><span class="mono">' + esc(s.dates) + '</span><span class="pill">' + esc(s.len) + '</span></div>' +
    (s.what ? '<p class="d-what" style="margin-top:6px">(' + esc(s.what) + ')</p>' : '') +
    '<p class="blurb">' + rich(sentences(s.blurb, 2)) + '</p>';
  if (s.plan && s.plan.length) h += '<ul class="plan">' + s.plan.slice(0, 5).map(p => '<li><span class="when">' + esc(p[0]) + '</span><span>' + rich(sentences(p[1], 1)) + '</span></li>').join('') + '</ul>';
  const bed = s.sleep && s.sleep[0];
  if (bed) h += '<div class="pinfo"><span class="k">Sleep</span><span><b>' + ext(bed.name, bed.url || gsearch(bed.name.replace(/[　-鿿＀-￯].*$/, '').trim() + ' ' + ctxOf(s))) + '</b>' + (bed.price ? ' · ' + esc(bed.price) : '') + '</span>' + contactsOf({ contacts: (bed.contacts || []).slice(0, 1) }) + '</div>';
  else if (s.nosleep) h += '<div class="pinfo"><span class="k">Sleep</span><span>' + esc(sentences(s.nosleep, 1)) + '</span></div>';
  const L = nextLegFrom(s.n);
  if (L) h += '<div class="pinfo"><span class="k">' + (L.a === L.b ? 'Day out' : 'Next') + '</span><span>' + icon(L.segs[0][0]) + ' <span class="mono">' + esc(fmtDay(L.date)) + '</span> · ' + esc(L.title) + '</span><span class="mono">' + (L.price[1] > 0 ? range(L.price[0], L.price[1]) : '') + (L.est ? ' est.' : '') + '</span></div>';
  h += stopLinks(s).replace(/>Google search</, '>Search<');
  h += '<button type="button" class="btn-sm acc full js-only" data-goto="' + s.n + '">Everything for ' + esc(s.name) + '</button>' +
    '<p class="minor nojs-only" style="margin:12px 0 0">Full details for each stop are in the list under the map.</p>';
  return '<article class="pop" id="pop-' + s.n + '" aria-label="Stop ' + s.n + ': ' + esc(s.name) + '">' + h + '</article>';
}
function renderPops() {
  const wrap = $('#mapwrap');
  if (!$('#ms-none')) {
    wrap.insertAdjacentHTML('afterbegin', '<input type="radio" name="ms" id="ms-none" class="msr" checked aria-label="Map closed">' +
      '<input type="radio" name="ms" id="ms-open" class="msr" aria-label="Map open">' +
      T.stops.map(s => '<input type="radio" name="ms" id="ms-' + s.n + '" class="msr" aria-label="Map: ' + esc(s.name) + '">').join(''));
  }
  const css = T.stops.map(s => '#ms-' + s.n + ':checked~.pops #pop-' + s.n).join(',') + '{display:block}' +
    T.stops.map(s => '#ms-' + s.n + ':checked~.mapbox .mklabels [for="ms-' + s.n + '"]').join(',') + '{box-shadow:0 0 0 3px var(--accent)}';
  $('#pops').innerHTML = '<style>' + css + '</style>' + T.stops.map(popCard).join('');
  $('#legend2').innerHTML = $('#legend').innerHTML;
}
const mapMode = () => { const r = doc.querySelector('.msr:checked'); return r ? r.id.slice(3) : 'none'; };
function setRadio(id) { const r = doc.getElementById(id); if (r) r.checked = true; }
function syncMap() {
  const v = mapMode(), fs = v !== 'none', n = /^\d+$/.test(v) ? +v : 0;
  const was = state.fs;
  state.fs = fs;
  if (n) state.sel = n;
  const after = () => safe('map', () => {
    if (mapState === 'ready') {
      const r = mapinner.getBoundingClientRect();
      if (was !== fs || Math.abs(r.width - W) > 2 || Math.abs(r.height - H) > 2) setup();
      if (n) { redraw(); flyTo(n); } else redraw();
    }
    const pop = n && $('#pop-' + n); if (pop) pop.scrollTop = 0;
  });
  requestAnimationFrame(() => requestAnimationFrame(after));
}
function openMap(n) { setRadio(n ? 'ms-' + n : 'ms-open'); syncMap(); }
function closeMap() { setRadio('ms-none'); syncMap(); }

function select(n) { if (!S[n]) return; state.sel = n; redraw(); }
function openStop(n) {
  if (!S[n]) return;
  if (state.fs) closeMap();
  setRadio('v-route');
  const d = $('#s' + n);
  doc.querySelectorAll('details.stop[open]').forEach(x => { if (x !== d) x.open = false; });
  d.open = true; select(n);
  requestAnimationFrame(() => { const y = d.getBoundingClientRect().top + window.pageYOffset - 10; try { window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, y); } });
}

/* ---------- today ---------- */
const DM = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function labelHas(label, iso) {
  if (label.indexOf(fmtDay(iso)) >= 0) return true;
  const m = /(\d{1,2})(?: (\w{3}))? – \w{3} (\d{1,2}) (\w{3})/.exec(label);
  if (!m) return false;
  const y = +iso.slice(0, 4), a = new Date(y, DM[m[2] || m[4]], +m[1]), b = new Date(y, DM[m[4]], +m[3]), d = parseISO(iso);
  return d >= a && d <= b;
}
function planFor(iso, n) {
  const out = [];
  [n].concat(T.stops.filter(s => s.n !== n).map(s => s.n)).forEach(k => (S[k].plan || []).forEach(p => { if (labelHas(p[0], iso)) out.push([k, p[1]]); }));
  return out.slice(0, 3);
}
const legsOn = d => T.legs.filter(L => L.date === d && L.price[1] > 0);
const dayLeg = L => '<div class="dayleg">' + icon(L.segs[0][0]) + '<span><b>' + esc(L.title) + '</b>' + (L.time ? '<br>' + esc(L.time) : '') + '<br><span class="mono">' + range(L.price[0], L.price[1]) + (L.est ? ' est.' : '') + '</span></span></div>';
function dayRow(r, cls) {
  const d = r[0], n = r[1], dt = parseISO(d);
  const c = 'day' + (r[4] ? ' travel' : '') + (d < TODAY ? ' past' : '') + (d === TODAY ? ' now' : '') + (cls ? ' ' + cls : '');
  return '<li class="' + c + '" data-goto="' + n + '" tabindex="0" role="button" aria-label="' + esc(fmtDay(d) + ': ' + r[2]) + '">' +
    '<div class="date">' + dt.getDate() + ' ' + MON[dt.getMonth()] + '<span class="dow">' + DOW[dt.getDay()] + '</span></div>' +
    '<div><div class="where"><span class="dnum' + (S[n].kind === 'pass' ? ' pass' : '') + '" aria-hidden="true">' + n + '</span>' + esc(r[2]) + (r[4] ? ' <span class="pill tag">Travel</span>' : '') + (d === TODAY ? ' <span class="pill acc tag">Today</span>' : '') + '</div>' +
    '<div class="what">' + esc(r[3]) + '</div>' + (d >= TODAY ? legsOn(d).map(dayLeg).join('') : '') + '</div></li>';
}
function renderToday() {
  let h = '';
  const trow = (k, v) => '<div class="trow"><span class="k">' + esc(k) + '</span><div class="v">' + v + '</div></div>';
  const legLine = L => '<div>' + icon(L.segs[0][0]) + ' <b>' + esc(L.title) + '</b>' + (L.time ? '<div class="legsub">' + esc(L.time) + '</div>' : '') +
    '<div class="legtop"><span class="price">' + (L.price[1] > 0 ? range(L.price[0], L.price[1]) : '') + '</span>' + (L.est ? '<span class="pill">est.</span>' : '') + (STATUS[L.status] && STATUS[L.status][1] ? '<span class="pill ' + STATUS[L.status][0] + '">' + STATUS[L.status][1] + '</span>' : '') + '</div></div>';
  if (TODAY < TRIP_START) {
    const dl = daysFrom(TODAY, TRIP_START), r0 = T.days[0], L = T.legs.filter(x => x.date === TRIP_START);
    h += '<p class="t-date">' + (dl === 1 ? 'Starts tomorrow' : 'Starts in ' + dl + ' days') + ' · ' + esc(fmtDay(TRIP_START)) + '</p>' +
      '<h2 class="t-title">' + esc(r0[2]) + '</h2><p class="t-sum">' + esc(r0[3]) + '</p>';
    if (L.length) h += trow('Travel', L.map(legLine).join(''));
    const s2 = S[r0[1]], bed = s2.sleep && s2.sleep[0];
    if (bed) h += trow('Night 1', '<span><b>' + esc(bed.name) + '</b>, ' + esc(s2.name) + '</span>' + contactsOf({ contacts: (bed.contacts || []).slice(0, 1) }));
    h += '<div class="t-acts">' + gotoBtn(1, 'See the crossing') + '<label class="btn-sm" for="v-book">What to book</label></div>';
  } else if (TODAY > TRIP_END) {
    h += '<p class="t-date">' + esc(fmtDay(TODAY)) + '</p><h2 class="t-title">China leg done</h2><p class="t-sum">In Hanoi from ' + esc(fmtDay(TRIP_END)) + '.</p>';
  } else {
    const i = T.days.findIndex(x => x[0] === TODAY), r = T.days[i], s = S[r[1]];
    const L = legsOn(TODAY);
    h += '<p class="t-date">Today · ' + esc(fmtDay(TODAY)) + ' · day ' + (i + 1) + ' of ' + T.days.length + '</p><h2 class="t-title">' + esc(r[2]) + '</h2><p class="t-sum">' + esc(r[3]) + '</p>';
    const pl = planFor(TODAY, s.n);
    const dedupe = t => t.indexOf(r[3]) === 0 ? t.slice(r[3].length).trim() : t;
    if (pl.length) h += trow('Plan', pl.map(p => '<div>' + rich(dedupe(p[1]) || p[1]) + '</div>').join(''));
    if (L.length) h += trow(L.some(x => x.a === x.b || x.segs[0][0] === 'day') && !L.some(x => x.a !== x.b) ? 'Day out' : 'Travel', L.map(legLine).join(''));
    const onTrain = L.some(x => /night train/i.test(x.title) && x.a === r[1]) || /night train/i.test(r[2].split('→').pop());
    const bed = s.sleep && s.sleep[0];
    if (onTrain) h += trow('Tonight', 'On the night train.');
    else if (bed) h += trow('Tonight', '<span><b>' + esc(bed.name) + '</b>' + (bed.price ? ' · ' + esc(bed.price) : '') + '</span>' + contactsOf({ contacts: (bed.contacts || []).slice(0, 1) }));
    const nx = T.days[i + 1];
    if (nx) h += trow('Tomorrow', '<span><b>' + esc(nx[2]) + '</b>' + (nx[4] ? ' <span class="pill tag">Travel</span>' : '') + '</span><span class="minor">' + esc(nx[3]) + '</span>' + legsOn(nx[0]).map(dayLeg).join(''));
    h += '<div class="t-acts">' + gotoBtn(s.n, 'Open ' + s.name) + '<label class="btn-sm" for="ms-' + s.n + '">On the map</label></div>';
  }
  $('#todaycard').innerHTML = '<article class="today">' + h + '</article>';
  const from = TODAY < TRIP_START ? 0 : Math.max(0, T.days.findIndex(x => x[0] > TODAY));
  const up = TODAY > TRIP_END ? [] : T.days.slice(from, from + 5);
  $('#upnext').innerHTML = up.length ? up.map(r => dayRow(r)).join('') : '<li class="minor">Nothing left on this leg.</li>';
}

/* ---------- day by day, grouped by week ---------- */
function weekKey(iso) { const d = parseISO(iso); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return isoOf(d); }
function spanLabel(a, b) {
  const x = parseISO(a), y = parseISO(b);
  return DOW[x.getDay()] + ' ' + x.getDate() + (x.getMonth() !== y.getMonth() ? ' ' + MON[x.getMonth()] : '') + ' – ' + DOW[y.getDay()] + ' ' + y.getDate() + ' ' + MON[y.getMonth()];
}
function renderDays() {
  const groups = [];
  T.days.forEach(r => { const k = weekKey(r[0]); const g = groups[groups.length - 1]; if (g && g.k === k) g.rows.push(r); else groups.push({ k, rows: [r] }); });
  const ref = TODAY < TRIP_START ? TRIP_START : TODAY > TRIP_END ? TRIP_END : TODAY;
  $('#daylist').innerHTML = groups.map((g, i) => {
    const a = g.rows[0][0], b = g.rows[g.rows.length - 1][0];
    const names = []; g.rows.forEach(r => { const nm = S[r[1]].name; if (names.indexOf(nm) < 0) names.push(nm); });
    const open = g.k === weekKey(ref);
    return '<details class="week' + (b < TODAY ? ' past' : '') + '"' + (open ? ' open' : '') + '><summary><span class="wk-t">Week ' + (i + 1) + ' · ' + esc(spanLabel(a, b)) + '</span>' + CHEV +
      '<span class="wk-s">' + esc(names.join(', ')) + '</span></summary><ul class="days">' + g.rows.map(r => dayRow(r)).join('') + '</ul></details>';
  }).join('');
  $('#daysum').textContent = T.days.length + ' days · travel days are shaded';
}

/* ---------- bookings: ticks saved with the page when it can, else in this browser ---------- */
const ticks = {};
const pending = new Set();
let dbRef = null, saveMode = 'local', canWrite = true;
function loadLocal() { try { const raw = localStorage.getItem('cnv-ticks'); const o = raw ? JSON.parse(raw) : null; if (o && typeof o === 'object') Object.keys(o).forEach(k => { ticks[k] = !!o[k]; }); } catch (e) { } }
function saveLocal() { try { localStorage.setItem('cnv-ticks', JSON.stringify(ticks)); } catch (e) { } }
const isDone = b => Object.prototype.hasOwnProperty.call(ticks, b.id) ? !!ticks[b.id] : !!b.done;
function groupOf(b) {
  if (isDone(b)) return 'done';
  if ((b.on && b.on < TODAY) || (b.stop && isPast(b.stop))) return 'gone';
  if (!b.due) return 'go';
  const dl = daysFrom(TODAY, b.due);
  return dl <= 1 ? 'now' : dl <= 10 ? 'soon' : 'later';
}
function dueText(b) {
  const dl = daysFrom(TODAY, b.due);
  if (dl < 0) return 'was due ' + fmtDay(b.due);
  if (dl === 0) return 'today';
  if (dl === 1) return 'by tomorrow';
  return 'by ' + fmtDay(b.due);
}
const GROUPS = [['now', 'Do now', true], ['soon', 'In the next ten days', true], ['later', 'Later', false], ['go', 'As you go', false], ['done', 'Done', false], ['gone', 'Past', false]];
const sortedBookings = () => T.bookings.slice().sort((a, b) => (a.due || '9') < (b.due || '9') ? -1 : (a.due || '9') > (b.due || '9') ? 1 : 0);
function renderBookings() {
  const items = sortedBookings();
  let html = '<p class="savenote js-only">' + (saveMode === 'db' ? 'Ticks are saved with this page, on any device, and Claude can read them when you ask.' : 'Ticks are saved in this browser only.') + (canWrite ? '' : ' You can view these but not change them.') + '</p>';
  GROUPS.forEach(g => {
    const list = items.filter(b => groupOf(b) === g[0]);
    if (!list.length) return;
    html += '<details class="bgroup"' + (g[2] ? ' open' : '') + '><summary><span class="wk-t">' + esc(g[1]) + '</span>' + CHEV + '<span class="wk-s">' + list.length + ' item' + (list.length > 1 ? 's' : '') + '</span></summary><div class="blist">' + list.map(b => {
      const done = isDone(b);
      return '<div class="bk' + (done ? ' done' : '') + (g[0] === 'now' ? ' urgent' : '') + '">' +
        '<input type="checkbox" id="bk-' + b.id + '" data-bk="' + b.id + '"' + (done ? ' checked' : '') + (!canWrite || pending.has(b.id) ? ' disabled' : '') + '>' +
        '<div><label class="bk-title" for="bk-' + b.id + '">' + esc(b.title) + '</label>' +
        '<div class="bk-when">' + esc(b.when) + (b.due && !done ? ' · ' + esc(dueText(b)) : '') + '</div>' +
        '<div class="bk-note">' + esc(b.note) + '</div>' +
        (b.stop ? '<div style="margin-top:8px">' + gotoBtn(b.stop, 'Stop ' + b.stop + ', ' + S[b.stop].name) + '</div>' : '') +
        '</div></div>';
    }).join('') + '</div></details>';
  });
  $('#booklist').innerHTML = html;
  const left = T.bookings.filter(b => !isDone(b) && groupOf(b) !== 'gone').length;
  $('#booksum').textContent = left + ' left to sort';
  const next = items.filter(b => ['now', 'soon'].indexOf(groupOf(b)) >= 0).slice(0, 3);
  $('#booknext').innerHTML = (next.length ? next.map(b => '<div class="bn' + (groupOf(b) === 'now' ? ' urgent' : '') + '"><b>' + esc(b.title) + '</b><span>' + esc(b.when) + (b.due ? ' · ' + esc(dueText(b)) : '') + '</span></div>').join('') : '<p class="minor" style="margin:0">Nothing due in the next ten days.</p>') +
    '<label class="more" for="v-book">All ' + T.bookings.length + ' bookings →</label>';
}
$('#booklist').addEventListener('change', async e => {
  const inp = e.target.closest('input[data-bk]');
  if (!inp) return;
  const id = inp.dataset.bk, val = inp.checked;
  ticks[id] = val;
  const after = () => { renderBookings(); renderStats(); const again = $('#bk-' + id); if (again) again.focus(); };
  if (dbRef && canWrite) {
    pending.add(id); renderBookings(); renderStats();
    try { await dbRef.collection('bookings').doc(id).set({ done: val, at: new Date().toISOString() }); }
    catch (err) { if (err && err.code === 'invalid_argument') canWrite = false; saveLocal(); }
    finally { pending.delete(id); after(); }
  } else { saveLocal(); after(); }
});
async function initDb() {
  let c = null;
  try { c = window.claude; } catch (e) { c = null; }
  if (!c || typeof c.use !== 'function') return;
  let d = null;
  try { d = await c.use('db'); } catch (e) { d = null; }
  if (!d) return;
  dbRef = d; saveMode = 'db';
  try { const u = await c.use('user'); if (u && typeof u.can === 'function') { const w = await u.can('data.write'); if (w === false) canWrite = false; } } catch (e) { }
  try {
    d.collection('bookings').onSnapshot(snap => {
      const next = {};
      snap.docs.forEach(x => { const v = x.data(); if (v && typeof v.done === 'boolean') next[x.id] = v.done; });
      Object.keys(ticks).forEach(k => { if (!pending.has(k)) delete ticks[k]; });
      Object.keys(next).forEach(k => { if (!pending.has(k)) ticks[k] = next[k]; });
      renderBookings(); renderStats();
    }, () => { dbRef = null; saveMode = 'local'; loadLocal(); renderBookings(); renderStats(); });
  } catch (e) { dbRef = null; saveMode = 'local'; }
  renderBookings();
}

/* ---------- costs ---------- */
/* everything above plus food at roughly £6–10 a day and the £69 Airalo eSIM; Hanoi beds and odd extras left out */
function roughTotal(lo, hi) {
  const days = T.days.length, gLo = Math.round(lo + 6 * days + 69), gHi = Math.round(hi + 10 * days + 69);
  const gbp = n => '£' + n.toLocaleString('en-GB');
  const a = parseISO(TRIP_START), b = parseISO(TRIP_END);
  return '<div class="costbox total"><div class="k">Rough total, ' + a.getDate() + ' ' + MON[a.getMonth()] + ' – ' + b.getDate() + ' ' + MON[b.getMonth()] + '</div><div class="v">' + gbp(gLo) + '–' + gbp(gHi).slice(1) + '</div>' +
    '<div class="s">About £' + Math.round(gLo / days) + '–' + Math.round(gHi / days) + ' a day. Adds food at roughly £6–10 a day (noodles, rice dishes, street food) and £69 for the Airalo eSIM (bought). Excludes Hanoi beds and odd extras.</div></div>';
}
const sumOf = (rows, i) => rows.reduce((a, r) => a + r[i], 0);
const nightsOf = s => parseInt(s.len, 10) || 0;
function renderCosts() {
  const tLo = T.legs.reduce((a, L) => a + L.price[0], 0), tHi = T.legs.reduce((a, L) => a + L.price[1], 0);
  const fLo = sumOf(T.fees, 1), fHi = sumOf(T.fees, 2);
  const beds = T.stops.filter(s => s.bed);
  const bLo = beds.reduce((a, s) => a + s.bed.lo, 0), bHi = beds.reduce((a, s) => a + s.bed.hi, 0), bN = beds.reduce((a, s) => a + (s.bed.nights || nightsOf(s)), 0);
  const trains = T.legs.filter(L => /night train/i.test(L.title)).length;
  let html = '<div class="costsum">' +
    '<div class="costbox"><div class="k">Transport</div><div class="v">' + range(Math.round(tLo), Math.round(tHi)) + '</div><div class="s">' + T.legs.length + ' legs, ' + trains + ' night trains, no flights. Train prices are Trip.com prices, about 25% over face value; a station counter is cheaper.</div></div>' +
    '<div class="costbox"><div class="k">Beds</div><div class="v">' + range(Math.round(bLo), Math.round(bHi)) + '</div><div class="s">' + bN + ' nights priced. Hanoi from ' + esc(fmtDay(TRIP_END)) + ' not yet.</div></div>' +
    '<div class="costbox"><div class="k">Entry fees</div><div class="v">' + range(Math.round(fLo), Math.round(fHi)) + '</div><div class="s">' + T.fees.length + ' sights, below.</div></div>' +
    '<div class="costbox"><div class="k">All three</div><div class="v">' + range(Math.round(tLo + bLo + fLo), Math.round(tHi + bHi + fHi)) + '</div><div class="s">Before food and SIM.</div></div>' +
    roughTotal(tLo + bLo + fLo, tHi + bHi + fHi) + '</div>';
  html += '<details class="legs"><summary>Every leg (' + T.legs.length + ')' + CHEV + '</summary><div class="tablewrap"><table><thead><tr><th>Date</th><th>Leg</th><th class="n">£</th></tr></thead><tbody>' +
    T.legs.map(L => { const dt = L.date ? parseISO(L.date) : null; return '<tr class="click" data-goto="' + L.b + '"><td class="mono nowrap">' + (dt ? dt.getDate() + ' ' + MON[dt.getMonth()] : '—') + '</td><td><b>' + esc(S[L.a].name + (L.a === L.b ? ' day out' : ' → ' + S[L.b].name)) + '</b>' + (L.opt ? ' <span class="pill">Optional</span>' : '') + '<div class="minor">' + esc(L.title) + '</div></td><td class="n">' + (L.price[1] > 0 ? range(L.price[0], L.price[1]) : '—') + (L.est ? '<div><span class="pill">est.</span></div>' : '') + '</td></tr>'; }).join('') +
    '</tbody><tfoot><tr><td colspan="2">Transport total</td><td class="n">' + range(Math.round(tLo), Math.round(tHi)) + '</td></tr></tfoot></table></div></details>';
  html += '<div class="csec"><h3>Entry fees</h3><ul class="tips">' + T.fees.map(f => '<li><span class="ic info" aria-hidden="true">£</span><span>' + esc(f[0]) + ': <b class="mono">' + range(f[1], f[2]) + '</b></span></li>').join('') + '</ul></div>';
  if (T.extras.length) html += '<div class="csec"><h3>Optional extras, not in the totals</h3><ul class="tips">' + T.extras.map(f => '<li><span class="ic info" aria-hidden="true">+</span><span>' + esc(f[0]) + ': <b class="mono">' + range(f[1], f[2]) + '</b></span></li>').join('') + '</ul></div>';
  html += '<p class="minor">Hard-sleeper fares are for the cheaper middle or upper berths where known; lower berths cost a little more. Bus fares in Yunnan come from old schedules or posts.</p>';
  $('#costlist').innerHTML = html;
}

/* ---------- header stats ---------- */
function renderStats() {
  const tLo = T.legs.reduce((a, L) => a + L.price[0], 0), tHi = T.legs.reduce((a, L) => a + L.price[1], 0);
  const nowCount = T.bookings.filter(b => groupOf(b) === 'now').length;
  let html = '<span class="stat"><b>' + T.days.length + '</b> days</span><span class="stat"><b>' + T.stops.length + '</b> stops</span>';
  html += '<span class="stat">Transport <b>' + range(Math.round(tLo), Math.round(tHi)) + '</b></span>';
  $('#stats').innerHTML = html;
  $('#bookbadge').textContent = nowCount ? String(nowCount) : '';
  $('#bookbadge').setAttribute('aria-label', nowCount ? nowCount + ' to book now' : '');
}

/* ---------- clicks shared across views ---------- */
doc.addEventListener('click', e => {
  const wx = e.target.closest('a[data-wx]');
  if (wx) {
    try { navigator.clipboard.writeText(wx.dataset.wx).catch(() => { }); } catch (err) { }
    if (!wx.dataset.old) { wx.dataset.old = wx.textContent; wx.textContent = 'Number copied'; setTimeout(() => { wx.textContent = wx.dataset.old; delete wx.dataset.old; }, 2500); }
    return;
  }
  const cp = e.target.closest('button[data-copy]');
  if (cp) {
    const text = cp.dataset.copy, old = cp.textContent;
    const done = msg => { cp.textContent = msg; setTimeout(() => { cp.textContent = old; }, 1600); };
    const fallback = () => {
      const num = cp.parentElement && cp.parentElement.querySelector('.num');
      if (num) { const r = doc.createRange(); r.selectNodeContents(num); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
      done('Selected');
    };
    try { navigator.clipboard.writeText(text).then(() => done('Copied'), fallback); } catch (err) { fallback(); }
    return;
  }
  const go = e.target.closest('[data-goto]');
  if (go && !e.target.closest('a[href]')) { e.preventDefault(); openStop(+go.dataset.goto); }
});
doc.addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.fs) { e.preventDefault(); if (/^\d+$/.test(mapMode())) openMap(0); else closeMap(); return; }
  const el = e.target.closest && e.target.closest('li[data-goto]');
  if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openStop(+el.dataset.goto); }
});
doc.querySelectorAll('.vr').forEach(r => r.addEventListener('change', () => { window.scrollTo(0, 0); }));
$('#mapwrap').addEventListener('change', e => { if (e.target.classList && e.target.classList.contains('msr')) syncMap(); });
$('#stoplist').addEventListener('toggle', e => {
  const d = e.target;
  if (!d.classList || !d.classList.contains('stop') || !d.open) return;
  doc.querySelectorAll('details.stop[open]').forEach(x => { if (x !== d) x.open = false; });
  select(+d.dataset.n);
}, true);

/* ---------- start ---------- */
const LIBS = {
  d3: ['https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js', 'https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js', 'https://unpkg.com/d3@7.8.5/dist/d3.min.js'],
  topojson: ['https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js', 'https://cdn.jsdelivr.net/npm/topojson@3.0.2/dist/topojson.min.js', 'https://unpkg.com/topojson@3.0.2/dist/topojson.min.js']
};
async function loadLib(name) {
  if (window[name]) return true;
  for (const u of LIBS[name]) {
    try { await loadScript(u, 15000); if (window[name]) return true; } catch (e) { /* next CDN */ }
  }
  return !!window[name];
}
function safe(where, fn) {
  try { return fn(); } catch (e) { if (window.__akmErr) window.__akmErr(where, e); }
}
let mapState = 'idle';
async function startMap() {
  if (mapState === 'loading' || mapState === 'ready') return;
  mapState = 'loading';
  const fixed = !!$('#map').firstElementChild;
  const note = $('#mapnote');
  if (fixed) note.hidden = true; else { note.hidden = false; note.textContent = 'Loading the map…'; }
  const ok = await loadLib('d3');
  if (!ok) {
    mapState = 'failed';
    $('#wrap').classList.add('nod3');
    note.hidden = false;
    note.innerHTML = (fixed ? "Fixed map: zooming and borders need a better connection." : "The map couldn't load on this connection. Everything else still works.") + " <button type=\"button\" class=\"retry\" id=\"mapretry\">Try again</button>";
    const b = $('#mapretry'); if (b) b.addEventListener('click', () => { mapState = 'idle'; startMap(); });
    return;
  }
  await loadLib('topojson');
  safe('map', () => {
    initMapDom(); setup();
    mapState = 'ready';
    $('#wrap').classList.remove('nod3');
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => { wCache = {}; redraw(); });
    let rt = null;
    const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { const r = mapinner.getBoundingClientRect(); if (r.width > 0 && (Math.abs(r.width - W) > 2 || Math.abs(r.height - H) > 2)) safe('map resize', () => { setup(); if (state.fs && /^\d+$/.test(mapMode())) flyTo(+mapMode()); }); }, 120); };
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(mapinner); else window.addEventListener('resize', onResize);
    loadGeo();
  });
  if (mapState !== 'ready') { mapState = 'failed'; note.textContent = "The map hit a problem. Everything else still works."; }
}
function init() {
  const m = /^#s(\d{1,2})$/.exec(location.hash || '');
  state.sel = state.today;
  safe('sources', () => { $('#sources').innerHTML = T.sourcesList.map(x => '<li>' + ext(x[0], x[1]) + '</li>').join(''); });
  safe('saved ticks', loadLocal);
  safe('today', renderToday); safe('stops', renderStops); safe('map panel', renderPops); safe('days', renderDays);
  safe('bookings', renderBookings); safe('costs', renderCosts); safe('stats', renderStats);
  if ($('#stoplist').firstElementChild && $('#todaycard').firstElementChild && $('#ms-none')) $('#wrap').classList.remove('nojs');
  if (m && S[+m[1]]) safe('open stop', () => openStop(+m[1]));
  window.addEventListener('online', () => { if (mapState === 'failed') { mapState = 'idle'; startMap(); } else if (mapState === 'ready' && !state.geo) loadGeo(); });
  startMap();
  safe('sync', initDb);
}
init();
