/*
 * Month trend chart shared by both designs: one or more series as bars, lines or areas,
 * an optional forecast with its 80% range, a highlight for the selected period, and a table view.
 * Each design passes its own theme (colours) and ui (legend, tooltip and table builders), so the
 * chart reads in that design's language while the drawing logic stays the same.
 *
 * cfg = {
 *   months: ['2026-01-01', ...], type: 'bar' | 'line' | 'area' | 'table',
 *   series: [{ label, color, values, role: 'main' | 'line' | 'dash' }],   main follows `type`
 *   forecast: { label, color, months, mean, lo, hi } | null,
 *   highlight: [months in the selected period] | null,
 *   fmtY, fmtT, height, theme: { grid, text, highlight, forecastBg, font }, ui: { legend, tip, table }
 * }
 */
(function () {
  'use strict';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var mon = function (m) { return MON[+m.slice(5, 7) - 1]; };
  var monY = function (m) { return mon(m) + ' ' + m.slice(0, 4); };

  function measure(svg, strings, size) {
    var t = svg.append('text').attr('font-size', size).attr('opacity', 0);
    var w = 0;
    strings.forEach(function (s) { t.text(s); w = Math.max(w, t.node().getComputedTextLength()); });
    t.remove();
    return w;
  }

  function table(el, cfg) {
    var fc = cfg.forecast;
    var head = ['Month'].concat(cfg.series.map(function (s) { return s.label; }));
    if (fc) head.push(fc.label, '80% range');
    var rows = cfg.months.map(function (m, i) {
      var r = [monY(m)].concat(cfg.series.map(function (s) { return cfg.fmtT(s.values[i]); }));
      if (fc) r.push('', '');
      return { cells: r, highlight: cfg.highlight && cfg.highlight.indexOf(m) >= 0 };
    });
    if (fc) fc.months.forEach(function (m, i) {
      var r = [monY(m)].concat(cfg.series.map(function () { return ''; }));
      r.push(cfg.fmtT(fc.mean[i]), cfg.fmtT(fc.lo[i]) + ' to ' + cfg.fmtT(fc.hi[i]));
      rows.push({ cells: r, forecast: true });
    });
    el.append(cfg.ui.table(head, rows));
  }

  function trend(el, cfg) {
    var T = cfg.theme, fc = cfg.forecast;
    el.replaceChildren();
    var items = cfg.series.map(function (s) { return { label: s.label, color: s.color, dash: s.role === 'dash' }; });
    if (fc) items.push({ label: fc.label, color: fc.color, dash: true }, { label: '80% likely range', color: fc.color, opacity: 0.2 });
    el.append(cfg.ui.legend(items));
    if (cfg.type === 'table') { table(el, cfg); return; }

    var months = cfg.months.concat(fc ? fc.months : []);
    var n = cfg.months.length;
    var W = Math.max(280, el.clientWidth || 600), H = cfg.height || 250;
    var svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', '0 0 ' + W + ' ' + H).attr('role', 'img');
    if (T.font) svg.style('font-family', T.font);
    var vals = [];
    cfg.series.forEach(function (s) { vals = vals.concat(s.values); });
    if (fc) vals = vals.concat(fc.lo, fc.hi);
    var lo = Math.min(0, d3.min(vals)), hi = d3.max(vals) * 1.08;
    var y = d3.scaleLinear([lo, hi], [H - 26, 14]).nice(5);
    var left = Math.ceil(measure(svg, y.ticks(5).map(cfg.fmtY), 11)) + 10;
    var x = d3.scaleBand(months, [left, W - 8]).paddingInner(0.3).paddingOuter(0.15);
    var cx = function (m) { return x(m) + x.bandwidth() / 2; };

    // selected period and forecast backgrounds
    if (cfg.highlight && cfg.highlight.length < n) {
      svg.append('g').selectAll('rect').data(cfg.highlight).join('rect')
        .attr('x', function (m) { return x(m) - (x.step() - x.bandwidth()) / 2; }).attr('width', x.step())
        .attr('y', 10).attr('height', H - 34).attr('fill', T.highlight);
    }
    if (fc) {
      var fx = x(fc.months[0]) - (x.step() - x.bandwidth()) / 2;
      svg.append('rect').attr('x', fx).attr('width', W - 8 - fx).attr('y', 10).attr('height', H - 34).attr('fill', T.forecastBg);
      svg.append('text').attr('x', fx + 4).attr('y', 9).attr('font-size', 10).attr('fill', T.text).text('Forecast');
    }

    svg.append('g').selectAll('line').data(y.ticks(5)).join('line').attr('x1', left).attr('x2', W - 8).attr('y1', y).attr('y2', y).attr('stroke', T.grid);
    svg.append('g').selectAll('text').data(y.ticks(5)).join('text').attr('x', left - 6).attr('y', function (d) { return y(d) + 4; }).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', T.text).text(cfg.fmtY);
    var every = W < 420 && months.length > 9 ? 2 : 1;
    svg.append('g').selectAll('text').data(months.filter(function (_, i) { return i % every === 0; })).join('text').attr('x', cx).attr('y', H - 8).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', T.text).text(mon);

    var actual = cfg.months;
    var mains = cfg.series.filter(function (s) { return s.role === 'main'; });
    if (cfg.type === 'bar') {
      var bw = Math.min(32, x.bandwidth()) / Math.max(1, mains.length);
      var off = (x.bandwidth() - bw * mains.length) / 2;
      mains.forEach(function (s, si) {
        svg.append('g').selectAll('rect').data(actual).join('rect')
          .attr('x', function (m) { return x(m) + off + si * bw; }).attr('width', Math.max(1, bw - (mains.length > 1 ? 2 : 0)))
          .attr('y', function (m, i) { return y(Math.max(0, s.values[i])); }).attr('height', function (m, i) { return Math.abs(y(s.values[i]) - y(0)); })
          .attr('rx', 3).attr('fill', s.color);
      });
      if (fc) {
        var fw = Math.min(32, x.bandwidth());
        var g = svg.append('g');
        fc.months.forEach(function (m, i) {
          g.append('rect').attr('x', cx(m) - fw / 2).attr('width', fw).attr('y', y(Math.max(0, fc.mean[i]))).attr('height', Math.abs(y(fc.mean[i]) - y(0))).attr('rx', 3)
            .attr('fill', fc.color).attr('fill-opacity', 0.3).attr('stroke', fc.color).attr('stroke-dasharray', '4 3');
          g.append('line').attr('x1', cx(m)).attr('x2', cx(m)).attr('y1', y(fc.lo[i])).attr('y2', y(fc.hi[i])).attr('stroke', fc.color).attr('stroke-width', 1.5);
          [fc.lo[i], fc.hi[i]].forEach(function (v) { g.append('line').attr('x1', cx(m) - 5).attr('x2', cx(m) + 5).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', fc.color).attr('stroke-width', 1.5); });
        });
      }
    } else {
      mains.forEach(function (s) {
        var pts = actual.map(function (m, i) { return [cx(m), y(s.values[i])]; });
        if (cfg.type === 'area') svg.append('path').attr('d', d3.area().x(function (p) { return p[0]; }).y0(y(Math.max(lo, 0))).y1(function (p) { return p[1]; })(pts)).attr('fill', s.color).attr('fill-opacity', mains.length > 1 ? 0.12 : 0.18);
        svg.append('path').attr('d', d3.line()(pts)).attr('fill', 'none').attr('stroke', s.color).attr('stroke-width', 2.25).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
        svg.append('g').selectAll('circle').data(pts).join('circle').attr('cx', function (p) { return p[0]; }).attr('cy', function (p) { return p[1]; }).attr('r', 3).attr('fill', s.color);
      });
      if (fc && mains.length) {
        var lastM = actual[n - 1], lastV = mains[0].values[n - 1];
        var band = [[cx(lastM), y(lastV), y(lastV)]].concat(fc.months.map(function (m, i) { return [cx(m), y(fc.lo[i]), y(fc.hi[i])]; }));
        svg.append('path').attr('d', d3.area().x(function (p) { return p[0]; }).y0(function (p) { return p[1]; }).y1(function (p) { return p[2]; })(band)).attr('fill', fc.color).attr('fill-opacity', 0.2);
        var fl = [[cx(lastM), y(lastV)]].concat(fc.months.map(function (m, i) { return [cx(m), y(fc.mean[i])]; }));
        svg.append('path').attr('d', d3.line()(fl)).attr('fill', 'none').attr('stroke', fc.color).attr('stroke-width', 2).attr('stroke-dasharray', '5 4');
        svg.append('g').selectAll('circle').data(fl.slice(1)).join('circle').attr('cx', function (p) { return p[0]; }).attr('cy', function (p) { return p[1]; }).attr('r', 3).attr('fill', '#fff').attr('stroke', fc.color).attr('stroke-width', 1.5);
      }
    }
    cfg.series.filter(function (s) { return s.role !== 'main'; }).forEach(function (s) {
      var pts = actual.map(function (m, i) { return [cx(m), y(s.values[i])]; });
      svg.append('path').attr('d', d3.line()(pts)).attr('fill', 'none').attr('stroke', s.color).attr('stroke-width', 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('stroke-dasharray', s.role === 'dash' ? '4 3' : null);
      if (s.role === 'line') svg.append('g').selectAll('circle').data(pts).join('circle').attr('cx', function (p) { return p[0]; }).attr('cy', function (p) { return p[1]; }).attr('r', 3).attr('fill', s.color);
    });

    var tip = cfg.ui.tip(el);
    svg.append('g').selectAll('rect').data(months).join('rect').attr('x', function (m) { return x(m) - (x.step() - x.bandwidth()) / 2; }).attr('width', x.step()).attr('y', 0).attr('height', H - 20).attr('fill', 'transparent')
      .on('mousemove', function (ev, m) {
        var i = actual.indexOf(m), lines;
        if (i >= 0) lines = cfg.series.map(function (s) { return { c: s.color, t: s.label + ': ' + cfg.fmtT(s.values[i]) }; });
        else { var k = fc.months.indexOf(m); lines = [{ c: fc.color, t: fc.label + ': ' + cfg.fmtT(fc.mean[k]) }, { t: '80% range: ' + cfg.fmtT(fc.lo[k]) + ' to ' + cfg.fmtT(fc.hi[k]) }]; }
        tip.show(monY(m), lines, ev);
      })
      .on('mouseleave', function () { tip.hide(); });
  }

  window.AIBCharts = { trend: trend, monthLabel: monY };
})();
