const fs = require('fs'); const p = process.argv[2];
global.window = {}; const B = p + '/build/';
for (const f of ['c_data1.js','c_data2.js','c_data3.js','c_roads1.js','c_roads2.js']) eval(fs.readFileSync(B + f, 'utf8').replace('window.TRIP = {};', 'window.TRIP = {}; var TRIP = window.TRIP;'));
const T = window.TRIP, S = {}; T.stops.forEach((s, i) => { if (s.n !== i + 1) console.log('BAD n', s.n, i); S[s.n] = s; });
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const err = m => console.log('ERR', m);
T.legs.forEach(L => {
  if (!S[L.a] || !S[L.b]) err('leg stop ' + L.id);
  L.segs.forEach(sg => { const v = sg[1];
    if (typeof v === 'string') { const k = v.slice(1).replace('~',''); if (!T.roads[k]) err('road ' + k + ' in ' + L.id); }
    else v.forEach(x => { if (typeof x === 'number' && !S[x]) err('pt stop ' + x); if (typeof x === 'string' && !T.wp[x]) err('wp ' + x + ' in ' + L.id); }); });
  if (L.date) { const d = new Date(L.date + 'T12:00:00Z'); }
});
let prev = null;
T.days.forEach(r => { const d = new Date(r[0] + 'T12:00:00Z'); if (prev && (d - prev) !== 864e5) err('gap ' + r[0]); prev = d; if (!S[r[1]]) err('day stop ' + r[0]); });
// check weekday names in stop plans and dates text match the calendar
const MON = {Oct:9, Nov:10, Dec:11};
const re = /\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (\d{1,2}) (Oct|Nov|Dec)\b/g;
const scan = (txt, where) => { let m; while ((m = re.exec(txt))) { const d = new Date(Date.UTC(2026, MON[m[3]], +m[2])); if (DOW[d.getUTCDay()] !== m[1]) err('weekday ' + m[0] + ' in ' + where); } };
T.stops.forEach(s => { scan(s.dates, s.name); (s.plan || []).forEach(p => scan(p[0] + ' ' + p[1], s.name)); (s.tips || []).forEach(p => scan(p[1], s.name)); scan(s.blurb, s.name); });
T.bookings.forEach(b => { scan(b.when + ' ' + b.note, b.id); if (b.stop && !S[b.stop]) err('booking stop ' + b.id); });
T.legs.forEach(L => scan((L.time||'') + ' ' + (L.note||''), L.id));
T.days.forEach(r => scan(r[2] + ' ' + r[3], r[0]));
// nights per stop from days table vs len
const cnt = {}; T.days.forEach(r => cnt[r[1]] = (cnt[r[1]] || 0) + 1);
console.log('day rows per stop', JSON.stringify(cnt));
const lo = T.legs.reduce((a, L) => a + L.price[0], 0), hi = T.legs.reduce((a, L) => a + L.price[1], 0);
console.log('legs', T.legs.length, 'transport £', lo.toFixed(2), hi.toFixed(2), 'stops', T.stops.length, 'days', T.days.length);
