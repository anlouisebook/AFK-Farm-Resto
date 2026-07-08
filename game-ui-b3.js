'use strict';
(function () {
  try {
    var key = 'hh-afk-v1';
    var raw = localStorage.getItem(key);
    if (!raw) return;
    var state = JSON.parse(raw);
    if (!state || !state.seen) return;
    sessionStorage.setItem('hh-afk-offline-start', String(state.seen));
    state.seen = Date.now();
    localStorage.setItem(key, JSON.stringify(state));
  } catch (_) {}
}());
