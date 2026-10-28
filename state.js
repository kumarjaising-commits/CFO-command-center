/*
 * Page settings shared by both designs: open tab, period, comparison and chart choices.
 * They live in the address after the tab (#tab-pnl&p=m&e=2026-06), so a link reopens the same view
 * and the Option 1 / Option 2 switch carries them across. Only values that differ from the defaults are written.
 *
 *   tab  open page          p  period mode (m, q, y, r)   e / s  end / start month (YYYY-MM)
 *   c    compare (b, p, bp, n)   m  measure on the profit chart   fm  measure on the forecast chart
 *   fc   forecast on trend charts (1)   w  what-if changes (nii,fee,opex,imp in %)   t-<chart>  chart type
 */
(function () {
  'use strict';
  var DEFAULTS = { tab: 'overview', p: 'y', e: '', s: '', c: 'bp', m: 'net', fm: 'net', fc: '0', w: '0,0,0,0' };
  var state = parse(location.hash);
  var listeners = [];

  function parse(hash) {
    var out = {};
    String(hash || '').replace(/^#/, '').split('&').forEach(function (part, i) {
      if (!part) return;
      if (i === 0 && part.indexOf('tab-') === 0) { out.tab = decodeURIComponent(part.slice(4)); return; }
      var eq = part.indexOf('=');
      if (eq > 0) out[decodeURIComponent(part.slice(0, eq))] = decodeURIComponent(part.slice(eq + 1));
    });
    return out;
  }

  function serialize(s) {
    var parts = ['tab-' + encodeURIComponent(s.tab || DEFAULTS.tab)];
    Object.keys(s).sort().forEach(function (k) {
      var v = s[k];
      if (k === 'tab' || v == null || v === '' || v === DEFAULTS[k]) return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v).replace(/%2C/g, ','));
    });
    return parts.join('&');
  }

  function write() { try { history.replaceState(null, '', '#' + serialize(state)); } catch (e) { /* ignore */ } }
  function notify(keys) { listeners.forEach(function (fn) { try { fn(keys, state); } catch (e) { console.error(e); } }); }

  window.AIBState = {
    get: function (k) { return state[k] != null && state[k] !== '' ? state[k] : DEFAULTS[k]; },
    set: function (patch) {
      var changed = Object.keys(patch).filter(function (k) { return String(patch[k]) !== String(window.AIBState.get(k)); });
      Object.keys(patch).forEach(function (k) { state[k] = patch[k] == null ? '' : String(patch[k]); });
      write();
      if (changed.length) notify(changed);
    },
    // Replaces every setting from an address (used by the design switch and the back button)
    apply: function (hash) {
      state = parse(hash);
      write();
      notify(['*']);
    },
    hash: function () { return '#' + serialize(state); },
    on: function (fn) { listeners.push(fn); },
    // [nii, fee, opex, imp] what-if changes in %
    scenario: function () {
      var v = window.AIBState.get('w').split(',').map(Number);
      return { nii: v[0] || 0, fee: v[1] || 0, opex: v[2] || 0, imp: v[3] || 0 };
    },
    period: function (all) {
      return window.AIBA.resolvePeriod({ mode: window.AIBState.get('p'), end: window.AIBState.get('e'), start: window.AIBState.get('s') }, all);
    }
  };

  window.addEventListener('hashchange', function () { window.AIBState.apply(location.hash); });
})();
