/*
 * Option 1 / Option 2 design switch, shared by index.html and option-2.html.
 * Carries the open page (#tab-<name>) across so the reader stays on the same section.
 */
(function () {
  'use strict';
  Array.prototype.forEach.call(document.querySelectorAll('[data-opt-link]'), function (a) {
    a.addEventListener('click', function () {
      a.href = a.getAttribute('href').split('#')[0] + location.hash;
    });
  });
})();
