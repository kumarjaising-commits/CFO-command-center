/*
 * Option 1 / Option 2 design switch, shared by index.html and option-2.html.
 * On the home page, Option 2 opens in a full-window frame so the address stays the same;
 * Option 2's own "Option 1" button closes the frame. The open page and every setting (period, comparison,
 * chart choices, what-if) carry across through the address, read by state.js on both pages.
 * Opened on its own, option-2.html links back to index.html as a normal page.
 */
(function () {
  'use strict';
  var links = document.querySelectorAll('[data-opt-link]');
  var host = window.parent !== window && window.parent.__optSwitch;

  function isPrintKey(e) { return (e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'p' || e.key === 'P'); }

  // Inside the frame: "Option 1" hands control back to the home page.
  if (host) {
    Array.prototype.forEach.call(links, function (a) {
      if (a.getAttribute('href').split('#')[0] !== 'index.html') return;
      a.addEventListener('click', function (e) { e.preventDefault(); host.showOption1(location.hash); });
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
    if (!frame) {
      frame = document.createElement('iframe');
      frame.className = 'opt-frame';
      frame.title = 'Option 2 design';
      frame.src = 'option-2.html' + location.hash;
      document.body.appendChild(frame);
    } else {
      frame.hidden = false;
      if (frame.contentWindow.AIBState) frame.contentWindow.AIBState.apply(location.hash);
    }
    cover(true);
    frame.focus();
  }

  function showOption1(hash) {
    frame.hidden = true;
    cover(false);
    window.AIBState.apply(hash);
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
