/*
 * Option 1 / Option 2 design switch, shared by index.html and option-2.html.
 * On the home page, Option 2 opens in a full-window frame so the address stays the same;
 * Option 2's own "Option 1" button closes the frame. The open page (#tab-<name>) carries across.
 * Opened on its own, option-2.html links back to index.html as a normal page.
 */
(function () {
  'use strict';
  var links = document.querySelectorAll('[data-opt-link]');
  var host = window.parent !== window && window.parent.__optSwitch;

  function tabName() { var h = location.hash; return h.indexOf('#tab-') === 0 ? h.slice(5) : ''; }
  function isPrintKey(e) { return (e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'p' || e.key === 'P'); }

  // Inside the frame: "Option 1" hands control back to the home page.
  if (host) {
    Array.prototype.forEach.call(links, function (a) {
      if (a.getAttribute('href').split('#')[0] !== 'index.html') return;
      a.addEventListener('click', function (e) { e.preventDefault(); host.showOption1(tabName()); });
    });
    // Cmd/Ctrl+P prints Option 2 rather than the home page behind it
    document.addEventListener('keydown', function (e) { if (isPrintKey(e)) { e.preventDefault(); window.print(); } });
    return;
  }

  // option-2.html opened directly: plain links that keep the open page.
  if (!document.getElementById('dash-root')) {
    Array.prototype.forEach.call(links, function (a) {
      a.addEventListener('click', function () { a.href = a.getAttribute('href').split('#')[0] + location.hash; });
    });
    return;
  }

  // Home page: show Option 2 in place.
  var frame = null;

  function cover(on) {
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el !== frame && el.tagName !== 'SCRIPT') el.inert = on;
    });
    document.documentElement.style.overflow = on ? 'hidden' : '';
  }

  function showOption2() {
    var tab = tabName();
    if (!frame) {
      frame = document.createElement('iframe');
      frame.className = 'opt-frame';
      frame.title = 'Option 2 design';
      frame.src = 'option-2.html' + (tab ? '#tab-' + tab : '');
      document.body.appendChild(frame);
    } else {
      frame.hidden = false;
      var w = frame.contentWindow;
      if (tab && w.switchTab && w.document.getElementById('page-' + tab)) w.switchTab(tab);
      else if (w.renderProfitChart) w.renderProfitChart();
    }
    cover(true);
    frame.focus();
  }

  function showOption1(tab) {
    frame.hidden = true;
    cover(false);
    var btn = tab && document.querySelector('.cc-tab[data-tab="' + tab + '"]');
    if (btn) btn.click();
    var current = document.querySelector('.opt-switch [aria-current]');
    if (current) current.focus();
  }

  window.__optSwitch = { showOption1: showOption1 };

  Array.prototype.forEach.call(links, function (a) {
    if (a.getAttribute('href').split('#')[0] !== 'option-2.html') return;
    a.addEventListener('click', function (e) { e.preventDefault(); showOption2(); });
  });

  document.addEventListener('keydown', function (e) {
    if (frame && !frame.hidden && isPrintKey(e)) { e.preventDefault(); frame.contentWindow.print(); }
  });
})();
