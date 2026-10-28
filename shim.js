/*
 * Tiny runtime that lets the command center run as a plain static site.
 * It provides the small `dash` API the page code uses: datasets, calculations,
 * drawings that re-run on resize and when a tab is shown, and a colour palette.
 * Swap `window.AIB_DATA` (data.js) for fetch() calls to AIB feeds when they exist.
 */
(function () {
  'use strict';
  var DATA = window.AIB_DATA || {};
  var calcs = {};
  var memo = {};
  var draws = {};

  function columnsOf(rows) { return rows && rows[0] ? Object.keys(rows[0]) : []; }

  function get(id) {
    if (Object.prototype.hasOwnProperty.call(DATA, id)) {
      return { status: 'ok', data: DATA[id], rows: DATA[id], columns: columnsOf(DATA[id]), message: '', refreshing: false, meta: [] };
    }
    if (calcs[id]) {
      if (!memo[id]) {
        try {
          var ins = calcs[id].inputs.map(function (i) { return get(i); });
          if (ins.some(function (g) { return g.status !== 'ok'; })) return { status: 'error', data: [], message: 'Input unavailable', meta: [] };
          var out = calcs[id].fn.apply(null, ins.map(function (g) { return g.data; }));
          memo[id] = { status: 'ok', data: out, rows: out, columns: columnsOf(out), message: '', refreshing: false, meta: [] };
        } catch (e) {
          console.error('Calculation failed: ' + id, e);
          return { status: 'error', data: [], message: String(e), meta: [] };
        }
      }
      return memo[id];
    }
    return { status: 'missing', data: [], message: 'Unknown source ' + id, meta: [] };
  }

  var dash = {
    colors: ['#5b2a86', '#2fa58f', '#e0a526', '#2f6fb5', '#c4505f', '#7a8794', '#8f6fd1', '#2a8f6d'],
    data: get,
    calc: function (id, o) { calcs[id] = o; delete memo[id]; },
    draw: function (name, fn) { draws[name] = fn; },
    onData: function (fn) { try { fn(); } catch (e) { console.error(e); } },
    params: function () { return {}; },
    setParams: function () {},
    resetParams: function () {},
    refresh: function () {},
    loader: function () {},
    setLink: function (name) { try { history.replaceState(null, '', '#' + name); } catch (e) { /* ignore */ } }
  };
  window.dash = dash;

  function hidden(el) { return !!el.closest('[hidden]'); }

  function runAll(force) {
    Object.keys(draws).forEach(function (name) {
      var els = document.querySelectorAll('[data-draw="' + name + '"]');
      Array.prototype.forEach.call(els, function (el) {
        if (hidden(el)) return;
        var w = el.clientWidth;
        if (!force && el.__drawn && el.__w === w) return;
        el.__drawn = true;
        el.__w = w;
        try { draws[name](el); } catch (e) { console.error('Drawing failed: ' + name, e); }
      });
    });
  }

  var timer;
  function later(force) { clearTimeout(timer); timer = setTimeout(function () { runAll(force); }, 60); }

  window.addEventListener('DOMContentLoaded', function () {
    runAll(true);
    new MutationObserver(function () { later(false); }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
    window.addEventListener('resize', function () { later(false); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { later(true); });
  });
})();
