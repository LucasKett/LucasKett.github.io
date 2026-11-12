(function () {
  var seen = [];
  window.__akmErr = function (where, e) {
    var msg = (e && (e.message || e.toString())) || String(e);
    var line = where + ': ' + msg;
    if (seen.indexOf(line) >= 0 || seen.length > 4) return;
    seen.push(line);
    var el = document.getElementById('jserr');
    if (!el) return;
    el.hidden = false;
    el.textContent = 'Part of this page failed to load (' + seen.join(' · ') + '). Screenshot this line and send it to Claude.';
  };
  window.addEventListener('error', function (ev) {
    if (ev && ev.target && ev.target !== window) return;
    if (ev && !ev.error && !ev.message) return;
    if (ev && !ev.error && /^Script error/i.test(ev.message || '')) return;
    if (ev && /cdnjs|jsdelivr|unpkg/.test(ev.filename || '')) return;
    window.__akmErr('page', ev.error || ev.message);
  }, true);
  window.addEventListener('unhandledrejection', function (ev) { window.__akmErr('async', ev.reason); });
})();
