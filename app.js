(function () {
  'use strict';

  const D = window.AIB_DATA;
  const ALL = AIBA.monthsOf(D.pnl_monthly);
  const period = () => AIBState.period(ALL);
  const cur = () => AIBState.currency();

  /* ---------- calculations (datasets joined or summed) ---------- */
  // Re-registered when the period changes, which clears the cached result. Sums live in analytics.js,
  // shared with Option 2 so both designs show the same numbers.
  function periodCalcs() {
    dash.calc('pnl_ytd', {
      inputs: ['pnl_monthly'],
      title: 'P&L for the selected period',
      description: 'Sums each P&L line over the selected months and adds subtotals and variances.',
      fn: (pnl_monthly) => AIBA.pnlSummary(pnl_monthly, period().months)
    });
    dash.calc('bs_view', {
      inputs: ['balance_sheet'],
      title: 'Balance sheet with changes',
      description: 'AIB reported balance sheet in the chosen currency, with the change against 31 March and 31 December.',
      fn: () => AIBA.bsView(D, cur())
    });
  }
  periodCalcs();

  dash.calc('monthly', {
    inputs: ['pnl_monthly'],
    title: 'Monthly income, costs and net profit',
    description: 'Per month: total income, operating costs (before impairment and tax) and net profit, for actual, budget and prior year.',
    fn: (pnl_monthly) => {
      const m = {};
      pnl_monthly.forEach((r) => {
        const o = m[r.month] || (m[r.month] = { month: r.month, income: 0, opex: 0, income_b: 0, opex_b: 0, net: 0, net_b: 0, net_p: 0 });
        const s = r.grp === 'income' ? 1 : -1;
        const isOpex = ['Staff costs', 'Technology and IT', 'Premises and administration', 'Other operating costs'].includes(r.line);
        if (r.grp === 'income') { o.income += r.actual; o.income_b += r.budget; }
        if (isOpex) { o.opex += r.actual; o.opex_b += r.budget; }
        o.net += s * r.actual; o.net_b += s * r.budget; o.net_p += s * r.prior;
      });
      return Object.values(m).sort((a, b) => (a.month < b.month ? -1 : 1));
    }
  });

  dash.calc('budget_view', {
    inputs: ['budget2027'],
    title: '2027 budget with total',
    description: 'Adds the change against the 2026 forecast to each function and a total row.',
    fn: (budget2027) => AIBA.budgetView(budget2027)
  });

  dash.calc('recons_view', {
    inputs: ['recons_aging'],
    title: 'Reconciliations with totals',
    description: 'Totals items and value per account class and for items over 30 and over 180 days.',
    fn: (recons_aging) => AIBA.reconsView(recons_aging)
  });

  dash.calc('savings_view', {
    inputs: ['savings_pipeline', 'budget2027'],
    title: 'Savings by function',
    description: 'Totals the saving pipeline per function and divides by the function 2026 operating cost forecast.',
    fn: (savings_pipeline, budget2027) => {
      const cost = {};
      budget2027.forEach((b) => { cost[b.function] = b.fcst_2026; });
      const by = {};
      savings_pipeline.forEach((s) => {
        const o = by[s.function] || (by[s.function] = { function: s.function, kind: 'line', items: 0, annual_saving: 0, one_off_cost: 0 });
        o.items += 1; o.annual_saving += s.annual_saving; o.one_off_cost += s.one_off_cost;
      });
      const rows = Object.values(by).map((o) => ({ ...o, pct_of_cost: cost[o.function] ? (o.annual_saving / cost[o.function]) * 100 : null }));
      rows.sort((a, b) => b.annual_saving - a.annual_saving);
      const sv = rows.reduce((s, r) => s + r.annual_saving, 0);
      const oc = rows.reduce((s, r) => s + r.one_off_cost, 0);
      const it = rows.reduce((s, r) => s + r.items, 0);
      const fc = budget2027.reduce((s, b) => s + b.fcst_2026, 0);
      rows.push({ function: 'Total', kind: 'total', items: it, annual_saving: sv, one_off_cost: oc, pct_of_cost: fc ? (sv / fc) * 100 : null });
      return rows;
    }
  });

  /* ---------- formats ---------- */
  const fmtInt = d3.format(',.0f');
  const money = (k) => {
    const n = k * 1000, a = Math.abs(n), s = n < 0 ? '−' : '';
    if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(2) + 'bn';
    if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(1) + 'm';
    if (a >= 1e3) return s + '$' + (a / 1e3).toFixed(0) + 'k';
    return s + '$' + a.toFixed(0);
  };
  const signed = (v, d) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
  const DATE = d3.utcFormat('%-d %b %Y');
  const MON = d3.utcFormat('%b');
  const MONY = d3.utcFormat('%b %Y');
  const pd = (s) => new Date(s + 'T00:00:00Z');
  const unitFmt = (v, u) => (v == null || isNaN(v) ? '—' : u === 'USDk' ? money(v) : u === '%' ? v.toFixed(1) + '%' : u === 'x' ? v.toFixed(2) + '×' : fmtInt(v));

  const toneOf = AIBA.toneOf;

  const el$ = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function notReady(el, ids) {
    const s = ids.map((i) => dash.data(i).status);
    if (s.every((x) => x === 'ok')) return false;
    el.replaceChildren();
    if (s.some((x) => x === 'error' || x === 'connect' || x === 'declined' || x === 'missing')) el.append(el$('div', 'cc-fail', 'Failed to load'));
    return true;
  }

  function measure(svg, strings, size) {
    const t = svg.append('text').attr('font-size', size).attr('opacity', 0);
    let w = 0;
    strings.forEach((s) => { t.text(s); w = Math.max(w, t.node().getComputedTextLength()); });
    t.remove();
    return w;
  }

  function tipFor(host) {
    const t = el$('div', 'cc-tip');
    host.append(t);
    return {
      show(title, lines, ev) {
        t.replaceChildren();
        t.append(el$('div', 't', title));
        lines.forEach((l) => {
          const d = el$('div');
          if (l.c) { const s = el$('span', 'sw'); s.style.background = l.c; d.append(s); }
          d.append(document.createTextNode(l.t));
          t.append(d);
        });
        t.style.opacity = 1;
        const r = host.getBoundingClientRect();
        let x = ev.clientX - r.left + 12;
        let y = ev.clientY - r.top - t.offsetHeight - 10;
        x = Math.max(0, Math.min(x, host.clientWidth - t.offsetWidth));
        if (y < 0) y = ev.clientY - r.top + 14;
        t.style.left = x + 'px';
        t.style.top = y + 'px';
      },
      hide() { t.style.opacity = 0; }
    };
  }

  function legend(items) {
    const l = el$('div', 'cc-legend');
    items.forEach((s) => {
      const sp = el$('span');
      const sw = el$('span', 'sw');
      sw.style.background = s.color;
      if (s.opacity) sw.style.opacity = s.opacity;
      sp.append(sw, document.createTextNode(s.label));
      l.append(sp);
    });
    return l;
  }

  /* ---------- tabs ---------- */
  const tabs = [...document.querySelectorAll('.cc-tab')];
  const pages = [...document.querySelectorAll('.cc-page')];
  function showTab(name, push) {
    if (!pages.some((p) => p.dataset.page === name)) return;
    tabs.forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === name ? 'true' : 'false'));
    pages.forEach((p) => { p.hidden = p.dataset.page !== name; });
    if (push) AIBState.set({ tab: name });
  }
  tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab, true)));
  showTab(AIBState.get('tab'));

  /* ---------- text figures ---------- */
  dash.draw('t', (el) => {
    const g = dash.data(el.dataset.source);
    if (g.status !== 'ok' || !g.data.length) { el.textContent = '—'; return; }
    const v = g.data[+el.dataset.row || 0][el.dataset.field];
    const f = el.dataset.fmt;
    el.textContent = f === 'money' ? money(v) : f === 'dirpct' ? Math.abs(v).toFixed(1) + '% ' + (v >= 0 ? 'above' : 'below') : fmtInt(v);
  });

  /* ---------- tables ---------- */
  function fillCell(td, v, f) {
    if (v == null || v === '') { td.textContent = '—'; td.classList.add('cc-muted'); if (/^(k|kdash|sk|spct|dpct|pct|int)$/.test(f || '')) td.classList.add('r'); return; }
    switch (f) {
      case 'k': td.textContent = fmtInt(v); td.classList.add('r'); break;
      case 'kdash': td.textContent = v === 0 ? '—' : fmtInt(v); td.classList.add('r'); if (v === 0) td.classList.add('cc-muted'); break;
      case 'sk': td.textContent = (v > 0 ? '+' : v < 0 ? '−' : '') + fmtInt(Math.abs(v)); td.classList.add('r', v > 0 ? 'pos' : v < 0 ? 'neg' : 'x'); break;
      case 'spct': td.textContent = signed(v, 1) + '%'; td.classList.add('r', v > 0 ? 'pos' : v < 0 ? 'neg' : 'x'); break;
      case 'dpct': td.textContent = signed(v, 1) + '%'; td.classList.add('r'); break;
      case 'pct': td.textContent = v.toFixed(1) + '%'; td.classList.add('r'); break;
      case 'int': td.textContent = fmtInt(v); td.classList.add('r'); break;
      case 'date': td.textContent = DATE(pd(v)); td.classList.add('nw'); break;
      case 'wk': td.textContent = 'Week ' + v; td.classList.add('nw'); break;
      case 'chip': { const c = el$('span', 'cc-chip ' + toneOf(v), v); td.append(c); break; }
      case 'bar': {
        const b = el$('div', 'cc-bar'); const i = el$('i'); const f2 = el$('b');
        f2.style.width = Math.max(0, Math.min(100, v)) + '%'; i.append(f2);
        b.append(i, el$('span', '', Math.round(v) + '%')); td.append(b); break;
      }
      default: td.textContent = v;
    }
  }

  dash.draw('tbl', (tb) => {
    const table = tb.closest('table');
    const id = table.dataset.source;
    const g = dash.data(id);
    const ths = [...table.querySelectorAll('thead th[data-field]')].filter((th) => !th.hidden);
    tb.replaceChildren();
    if (g.status !== 'ok') {
      if (g.status === 'error' || g.status === 'connect' || g.status === 'declined' || g.status === 'missing') {
        const tr = el$('tr'); const td = el$('td', 'cc-muted', 'Failed to load'); td.colSpan = ths.length || 1; tr.append(td); tb.append(tr);
      }
      return;
    }
    let rows = g.data;
    if (tb.dataset.filter) { const [c, v] = tb.dataset.filter.split('='); rows = rows.filter((r) => String(r[c]) === v); }
    const keys = (table.dataset.rowKey || '').split(',').filter(Boolean);
    rows.forEach((r) => {
      const tr = el$('tr');
      if (keys.length) tr.dataset.key = keys.length === 1 ? String(r[keys[0]]) : keys.map((k) => encodeURIComponent(r[k])).join(',');
      if (r.kind === 'total') tr.className = 'cc-total';
      ths.forEach((th) => { const td = el$('td'); fillCell(td, r[th.dataset.field], th.dataset.fmt); tr.append(td); });
      tb.append(tr);
    });
  });

  /* ---------- KPI tiles (AIB reported figures) ---------- */
  dash.draw('kpis', (el) => {
    if (notReady(el, ['kpis', 'ratios'])) return;
    el.replaceChildren();
    const groups = el.dataset.group ? el.dataset.group.split(',') : null;
    const rows = dash.data('kpis').data.filter((r) => !groups || groups.indexOf(r.group) >= 0);
    const rat = d3.group(dash.data('ratios').data, (d) => d.metric);
    rows.forEach((r0) => {
      const r = AIBA.kpiView(D, r0, cur());
      const gap = r.target == null ? 0 : Math.abs(r.value - r.target) / Math.abs(r.target);
      const tone = r.met == null ? 'na' : r.met ? '' : gap > 0.1 ? 'bad' : 'warn'; // grey where the pack gives no minimum
      const tile = el$('div', 'cc-tile');
      tile.title = r.note + ' ' + r.status + '.';
      const l = el$('div', 'cc-tile-l'); l.append(el$('span', 'cc-dot ' + tone), document.createTextNode(r.label));
      const v = el$('div', 'cc-tile-v', r.valueText);
      const d = el$('div', 'cc-tile-d');
      if (r.prior != null) {
        d.append(el$('span', r.good == null ? '' : r.good ? 'good' : 'badc', r.diffText), document.createTextNode(' ' + r.prior_label));
      } else d.textContent = 'No earlier figure to compare';
      const t = el$('div', 'cc-tile-d', r.target != null ? r.target_label + ' ' + r.targetText : r.ref_value != null ? r.ref_label + ': ' + r.refText : r.status);
      tile.append(l, v, d, t);
      const s = rat.get(r.series);
      if (s && s.length > 1) {
        const vals = s.slice().sort((a, b) => (a.end < b.end ? -1 : 1)).map((x) => x.value);
        const x = d3.scaleLinear([0, vals.length - 1], [2, 158]);
        const y = d3.scaleLinear(d3.extent(vals), [24, 3]);
        const svg = d3.create('svg').attr('width', '100%').attr('height', 28).attr('viewBox', '0 0 160 28').attr('preserveAspectRatio', 'none');
        svg.append('path').attr('d', d3.line().x((_, i) => x(i)).y((q) => y(q))(vals)).attr('fill', 'none').attr('stroke', dash.colors[0]).attr('stroke-width', 1.75).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('vector-effect', 'non-scaling-stroke');
        tile.append(svg.node());
      }
      el.append(tile);
    });
  });

  /* ---------- trend charts (shared renderer in charts.js) ---------- */
  const CHART_DEFAULT = { profit: 'bar', incexp: 'line', forecast: 'line' };
  const chartType = (id) => AIBState.get('t-' + id) || CHART_DEFAULT[id];
  const cmp = () => AIBState.get('c');
  const THEME = { grid: 'var(--cds-chart-grid)', text: 'var(--color-fg-muted)', highlight: 'rgba(91, 42, 134, 0.07)', forecastBg: 'rgba(47, 165, 143, 0.07)' };
  const UI = {
    legend: (items) => legend(items),
    tip: (host) => tipFor(host),
    table: (head, rows) => {
      const wrap = el$('div', 'cc-scroll');
      const t = el$('table', 'cc-table');
      const hr = el$('tr');
      head.forEach((h, i) => { const th = el$('th', i ? 'r' : '', h); hr.append(th); });
      const th = el$('thead'); th.append(hr);
      const tb = el$('tbody');
      rows.forEach((r) => {
        const tr = el$('tr', r.forecast ? 'cc-fc-row' : r.highlight ? 'cc-hl-row' : '');
        r.cells.forEach((c, i) => tr.append(el$('td', i ? 'r' : 'nw', c || (i ? '' : '—'))));
        tb.append(tr);
      });
      t.append(th, tb); wrap.append(t);
      return wrap;
    }
  };
  const kfmt = (v) => fmtInt(v) + 'k';

  function trendCfg(id, m, opts) {
    const p = period();
    const s = AIBA.measureSeries(D.pnl_monthly, m).filter((r) => r.month <= p.endMonth);
    const series = [{ label: 'Actual', color: dash.colors[0], role: 'main', values: s.map((r) => r.actual) }];
    if (/b/.test(cmp())) series.push({ label: 'Budget', color: dash.colors[1], role: 'line', values: s.map((r) => r.budget) });
    if (/p/.test(cmp())) series.push({ label: 'Same month 2025', color: 'var(--cds-chart-reference)', role: 'dash', values: s.map((r) => r.prior) });
    let forecast = null;
    if (opts.forecast && p.isLatest) {
      const f = AIBA.measureForecast(D.pnl_monthly, m, { scenario: opts.scenario });
      forecast = { label: 'Forecast', color: dash.colors[0], months: f.map((x) => x.month), mean: f.map((x) => x.mean), lo: f.map((x) => x.lo), hi: f.map((x) => x.hi) };
    }
    return { months: s.map((r) => r.month), series, forecast, highlight: p.months, type: chartType(id), fmtY: fmtInt, fmtT: kfmt, theme: THEME, ui: UI };
  }

  dash.draw('chart-profit', (el) => {
    if (notReady(el, ['pnl_monthly'])) return;
    AIBCharts.trend(el, trendCfg('profit', AIBState.get('m'), { forecast: AIBState.get('fc') === '1' }));
  });

  dash.draw('chart-incexp', (el) => {
    if (notReady(el, ['monthly'])) return;
    const p = period();
    const rows = dash.data('monthly').data.filter((r) => r.month <= p.endMonth);
    const lastYearOnly = cmp() === 'p';
    const series = [
      { label: 'Income', color: dash.colors[0], role: 'main', values: rows.map((r) => r.income) },
      { label: 'Operating costs', color: dash.colors[2], role: 'main', values: rows.map((r) => r.opex) }
    ];
    if (/b/.test(cmp())) series.push({ label: 'Income budget', color: dash.colors[0], role: 'dash', values: rows.map((r) => r.income_b) }, { label: 'Cost budget', color: dash.colors[2], role: 'dash', values: rows.map((r) => r.opex_b) });
    else if (lastYearOnly) series.push({ label: 'Income 2025', color: dash.colors[0], role: 'dash', values: rows.map((r) => r.income_p) }, { label: 'Costs 2025', color: dash.colors[2], role: 'dash', values: rows.map((r) => r.opex_p) });
    AIBCharts.trend(el, { months: rows.map((r) => r.month), series, forecast: null, highlight: p.months, type: chartType('incexp'), fmtY: fmtInt, fmtT: kfmt, theme: THEME, ui: UI });
  });

  dash.draw('chart-forecast', (el) => {
    if (notReady(el, ['pnl_monthly'])) return;
    const cfg = trendCfg('forecast', AIBState.get('fm'), { forecast: true, scenario: AIBState.scenario() });
    if (!period().isLatest) {
      el.replaceChildren(el$('p', 'cc-note', 'The forecast starts after the latest month of actuals. Choose a period that ends in ' + AIBA.monthLong(ALL[ALL.length - 1]) + ' to see it.'));
      return;
    }
    AIBCharts.trend(el, cfg);
  });

  /* ---------- ratio small multiples (AIB reported, FY2021 to the latest interim) ---------- */
  dash.draw('chart-ratios', (el) => {
    if (notReady(el, ['ratios'])) return;
    el.replaceChildren();
    const tip = tipFor(el);
    const cells = AIBA.ratioWatch(dash.data('ratios').data).map((w) => {
      const cell = el$('div');
      el.append(cell);
      return [cell, w];
    });
    cells.forEach(([cell, w]) => {
      const rows = w.series, last = rows[rows.length - 1], lim = w.limit, dp = AIBA.ratioDp(w.latest);
      const breach = w.status === 'breach';
      const t = el$('p', 'cc-mini-t'); t.append(el$('span', '', w.metric), el$('span', '', w.latest.toFixed(dp) + '%'));
      cell.append(t);
      const W = Math.max(180, cell.clientWidth || 240), H = 96;
      const svg = d3.select(cell).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
      const vals = rows.map((r) => r.value).concat(lim == null ? [] : [lim]);
      const pad = (d3.max(vals) - d3.min(vals)) * 0.2 || 1;
      const y = d3.scaleLinear([d3.min(vals) - pad, d3.max(vals) + pad], [H - 16, 8]);
      const x = d3.scaleLinear([0, rows.length - 1], [4, W - 8]);
      if (lim != null) {
        svg.append('line').attr('x1', 4).attr('x2', W - 8).attr('y1', y(lim)).attr('y2', y(lim)).attr('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '4 3');
        svg.append('text').attr('x', 4).attr('y', y(lim) - 4).attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text('DAB minimum ' + lim.toFixed(1) + '%');
      }
      svg.append('path').attr('d', d3.line().x((_, i) => x(i)).y((r) => y(r.value))(rows)).attr('fill', 'none').attr('stroke', dash.colors[0]).attr('stroke-width', 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
      svg.append('circle').attr('cx', x(rows.length - 1)).attr('cy', y(last.value)).attr('r', 3.5).attr('fill', breach ? 'var(--cds-chart-status-critical)' : dash.colors[0]);
      svg.append('text').attr('x', 4).attr('y', H - 3).attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(rows[0].label);
      svg.append('text').attr('x', W - 8).attr('y', H - 3).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(last.label);
      svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', (_, i) => x(i) - (W - 12) / rows.length / 2).attr('width', (W - 12) / rows.length).attr('y', 0).attr('height', H - 12).attr('fill', 'transparent')
        .on('mousemove', (ev, r) => tip.show(w.metric, [{ t: r.label + ': ' + r.value.toFixed(dp) + '%' }, { t: r.status }].concat(r.limit != null ? [{ t: 'DAB minimum: ' + r.limit.toFixed(1) + '%' }] : []), ev))
        .on('mouseleave', () => tip.hide());
    });
  });

  /* ---------- horizontal bar helpers ---------- */
  function hBars(el, cfg) {
    el.replaceChildren();
    el.append(legend(cfg.legend));
    const W = Math.max(280, el.clientWidth || 600);
    const rowH = cfg.rowH, H = cfg.rows.length * rowH + 22;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const lw = Math.min(W * 0.38, Math.ceil(measure(svg, cfg.rows.map((r) => r.label), 12)) + 8);
    const endW = Math.ceil(measure(svg, cfg.rows.map((r) => cfg.endLabel(r)), 11)) + 8;
    const x = d3.scaleLinear([0, cfg.max], [lw + 6, W - endW - 4]);
    const trunc = (s) => { const t = svg.append('text').attr('font-size', 12).attr('opacity', 0); let out = s; t.text(out); while (t.node().getComputedTextLength() > lw - 6 && out.length > 4) { out = out.slice(0, -2); t.text(out + '…'); } t.remove(); return out === s ? s : out + '…'; };
    const tip = tipFor(el);
    cfg.rows.forEach((r, i) => {
      const g = svg.append('g').attr('transform', `translate(0,${i * rowH + 4})`);
      g.append('text').attr('x', 0).attr('y', rowH / 2 + 3).attr('font-size', 12).attr('fill', 'var(--color-fg)').text(trunc(r.label));
      cfg.draw(g, r, x, rowH);
      g.append('rect').attr('x', 0).attr('width', W).attr('y', 0).attr('height', rowH).attr('fill', 'transparent')
        .on('mousemove', (ev) => tip.show(r.label, cfg.tip(r), ev)).on('mouseleave', () => tip.hide());
    });
    return svg;
  }

  dash.draw('chart-budget', (el) => {
    if (notReady(el, ['budget2027'])) return;
    const rows = dash.data('budget2027').data.slice().sort((a, b) => b.fcst_2026 - a.fcst_2026).map((r) => ({ ...r, label: r.function }));
    hBars(el, {
      rows, rowH: 36, max: d3.max(rows, (r) => Math.max(r.fcst_2026, r.budget_2027)),
      legend: [{ label: '2026 forecast', color: 'var(--cds-chart-muted)' }, { label: '2027 draft budget', color: dash.colors[0] }],
      endLabel: (r) => money(r.budget_2027),
      draw: (g, r, x, h) => {
        g.append('rect').attr('x', x(0)).attr('y', 4).attr('height', 12).attr('width', Math.max(1, x(r.fcst_2026) - x(0))).attr('rx', 3).attr('fill', 'var(--cds-chart-muted)');
        g.append('rect').attr('x', x(0)).attr('y', 18).attr('height', 12).attr('width', Math.max(1, x(r.budget_2027) - x(0))).attr('rx', 3).attr('fill', dash.colors[0]);
        g.append('text').attr('x', x(r.budget_2027) + 6).attr('y', 28).attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(money(r.budget_2027));
        g.append('text').attr('x', x(r.fcst_2026) + 6).attr('y', 14).attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(money(r.fcst_2026));
      },
      tip: (r) => [{ c: 'var(--cds-chart-muted)', t: '2026 forecast: ' + fmtInt(r.fcst_2026) + 'k' }, { c: dash.colors[0], t: '2027 draft: ' + fmtInt(r.budget_2027) + 'k' }, { t: 'Status: ' + r.status }]
    });
  });

  const AGE = [
    { k: 'value_0_30', label: '0 to 30 days', color: dash.colors[0], opacity: 0.3 },
    { k: 'value_31_90', label: '31 to 90 days', color: dash.colors[0], opacity: 0.55 },
    { k: 'value_91_180', label: '91 to 180 days', color: dash.colors[0], opacity: 0.85 },
    { k: 'value_180_plus', label: 'Over 180 days', color: 'var(--cds-chart-status-critical)', opacity: 1 }
  ];
  dash.draw('chart-aging', (el) => {
    if (notReady(el, ['recons_aging'])) return;
    const rows = dash.data('recons_aging').data.map((r) => ({ ...r, label: r.account_class, total: AGE.reduce((s, a) => s + r[a.k], 0) })).sort((a, b) => b.total - a.total);
    hBars(el, {
      rows, rowH: 34, max: d3.max(rows, (r) => r.total),
      legend: AGE.map((a) => ({ label: a.label, color: a.color, opacity: a.opacity })),
      endLabel: (r) => money(r.total),
      draw: (g, r, x) => {
        let acc = 0;
        AGE.forEach((a) => {
          const w = x(acc + r[a.k]) - x(acc);
          g.append('rect').attr('x', x(acc)).attr('y', 8).attr('height', 16).attr('width', Math.max(0, w)).attr('fill', a.color).attr('fill-opacity', a.opacity);
          acc += r[a.k];
        });
        g.append('text').attr('x', x(r.total) + 6).attr('y', 20).attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(money(r.total));
      },
      tip: (r) => AGE.map((a) => ({ c: a.color, t: a.label + ': ' + fmtInt(r[a.k]) + 'k' }))
    });
  });

  const STAGES = ['Realised', 'Approved', 'Validated', 'Identified'];
  dash.draw('chart-savings', (el) => {
    if (notReady(el, ['savings_pipeline'])) return;
    const by = d3.rollup(dash.data('savings_pipeline').data, (v) => { const o = { total: 0 }; STAGES.forEach((s) => { o[s] = d3.sum(v.filter((x) => x.status === s), (x) => x.annual_saving); }); o.total = d3.sum(v, (x) => x.annual_saving); return o; }, (d) => d.function);
    const rows = [...by].map(([f, o]) => ({ label: f, ...o })).sort((a, b) => b.total - a.total);
    hBars(el, {
      rows, rowH: 32, max: d3.max(rows, (r) => r.total),
      legend: STAGES.map((s, i) => ({ label: s, color: dash.colors[i] })),
      endLabel: (r) => money(r.total),
      draw: (g, r, x) => {
        let acc = 0;
        STAGES.forEach((s, i) => {
          const w = x(acc + r[s]) - x(acc);
          if (r[s] > 0) g.append('rect').attr('x', x(acc)).attr('y', 7).attr('height', 16).attr('width', Math.max(0, w)).attr('fill', dash.colors[i]);
          acc += r[s];
        });
        g.append('text').attr('x', x(r.total) + 6).attr('y', 19).attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(money(r.total));
      },
      tip: (r) => STAGES.map((s, i) => ({ c: dash.colors[i], t: s + ': ' + fmtInt(r[s]) + 'k' }))
    });
  });

  /* ---------- programme timeline ---------- */
  dash.draw('chart-timeline', (el) => {
    if (notReady(el, ['programme_ms'])) return;
    el.replaceChildren();
    const rows = dash.data('programme_ms').data.map((r) => ({ ...r, s: pd(r.start), e: pd(r.end) }));
    const wsNames = [...new Set(rows.map((r) => r.workstream))];
    el.append(legend(wsNames.map((n, i) => ({ label: n, color: dash.colors[i] }))));
    const W = Math.max(300, el.clientWidth || 700);
    const stacked = W < 620;
    const rowH = stacked ? 40 : 28;
    const H = rows.length * rowH + 34;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const lw = stacked ? 0 : Math.min(W * 0.4, Math.ceil(measure(svg, rows.map((r) => r.milestone), 12)) + 8);
    const x = d3.scaleUtc([new Date(Date.UTC(2026, 9, 20)), new Date(Date.UTC(2027, 4, 10))], [lw + (stacked ? 4 : 8), W - 12]);
    const ticks = d3.utcMonth.every(W < 480 ? 2 : 1).range(new Date(Date.UTC(2026, 10, 1)), new Date(Date.UTC(2027, 4, 2)));
    svg.append('g').selectAll('line').data(ticks).join('line').attr('x1', x).attr('x2', x).attr('y1', 18).attr('y2', H).attr('stroke', 'var(--cds-chart-grid)');
    svg.append('g').selectAll('text').data(ticks).join('text').attr('x', x).attr('y', 12).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text((d) => MON(d) + (d.getUTCMonth() === 0 ? ' ' + d.getUTCFullYear() : ''));
    const trunc = (s, maxW) => { const t = svg.append('text').attr('font-size', 12).attr('opacity', 0); let out = s; t.text(out); while (t.node().getComputedTextLength() > maxW && out.length > 4) { out = out.slice(0, -2); t.text(out + '…'); } t.remove(); return out === s ? s : out + '…'; };
    const tip = tipFor(el);
    rows.forEach((r, i) => {
      const g = svg.append('g').attr('transform', `translate(0,${22 + i * rowH})`);
      const ci = wsNames.indexOf(r.workstream);
      const by = stacked ? 22 : rowH / 2 - 6;
      g.append('text').attr('x', 0).attr('y', stacked ? 12 : rowH / 2 + 3).attr('font-size', 12).attr('fill', 'var(--color-fg)').text(trunc(r.milestone, stacked ? W - 4 : lw - 6));
      const op = r.basis === 'Plan' ? 1 : 0.5;
      if (r.start === r.end) {
        g.append('rect').attr('x', x(r.s) - 6).attr('y', by).attr('width', 12).attr('height', 12).attr('transform', `rotate(45 ${x(r.s)} ${by + 6})`).attr('fill', dash.colors[ci]).attr('fill-opacity', op);
      } else {
        g.append('rect').attr('x', x(r.s)).attr('y', by).attr('width', Math.max(4, x(r.e) - x(r.s))).attr('height', 12).attr('rx', 3).attr('fill', dash.colors[ci]).attr('fill-opacity', op);
      }
      g.append('rect').attr('x', 0).attr('width', W).attr('y', 0).attr('height', rowH).attr('fill', 'transparent')
        .on('mousemove', (ev) => tip.show(r.milestone, [{ t: r.start === r.end ? DATE(r.s) : DATE(r.s) + ' to ' + DATE(r.e) }, { t: r.workstream + ' · ' + r.owner }, { t: r.basis === 'Plan' ? 'Date in the operating plan' : 'Indicative date' }], ev))
        .on('mouseleave', () => tip.hide());
    });
    const now = new Date();
    const dom = x.domain();
    if (now >= dom[0] && now <= dom[1]) {
      svg.append('line').attr('x1', x(now)).attr('x2', x(now)).attr('y1', 16).attr('y2', H).attr('stroke', 'var(--cds-chart-status-critical)').attr('stroke-dasharray', '3 3');
      svg.append('text').attr('x', x(now) + 4).attr('y', H - 4).attr('font-size', 11).attr('fill', 'var(--cds-chart-status-critical)').text('Today');
    }
  });

  /* ---------- scorecard ---------- */
  dash.draw('scorecard', (el) => {
    if (notReady(el, ['value_scorecard'])) return;
    el.replaceChildren();
    const uf = (v, u) => (u === '%' ? v + '%' : u === 'USDk' ? money(v) : u === 'WD' ? 'WD ' + v : fmtInt(v));
    dash.data('value_scorecard').data.forEach((r) => {
      const lower = r.direction === 'lower';
      const span = lower ? r.baseline - r.target : r.target - r.baseline;
      const done = lower ? r.baseline - r.current : r.current - r.baseline;
      const p = span ? Math.max(0, Math.min(1, done / span)) : 0;
      const row = el$('div', 'cc-srow');
      const l = el$('div', 'cc-srow-l', r.measure); l.append(el$('small', '', r.area));
      const bar = el$('div', 'cc-bar'); const i = el$('i'); const f = el$('b');
      f.style.width = Math.round(p * 100) + '%';
      f.style.background = p >= 1 ? 'var(--color-ok)' : p >= 0.5 ? dash.colors[0] : 'var(--color-warn)';
      i.append(f); bar.append(i, el$('span', 'cc-muted', Math.round(p * 100) + '%'));
      const v = el$('div', 'cc-srow-v', 'Baseline ' + uf(r.baseline, r.unit) + ' · Now ' + uf(r.current, r.unit) + ' · Target ' + uf(r.target, r.unit));
      row.append(l, bar, v);
      el.append(row);
    });
  });

  /* ---------- period, comparison and chart controls ---------- */
  const CMP = [['bp', 'Budget and last year'], ['b', 'Budget'], ['p', 'Last year'], ['n', 'No comparison']];
  const TYPES = [['bar', 'Bar'], ['line', 'Line'], ['area', 'Area'], ['table', 'Table']];
  const MONTH_OPTS = ALL.map((m) => [m.slice(0, 7), AIBA.monthShort(m)]);

  function field(label, options) {
    const wrap = el$('label', 'cc-field');
    const l = el$('span', '', label);
    const select = document.createElement('select');
    options.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; select.append(o); });
    wrap.append(l, select);
    return { wrap, select, label: l };
  }

  dash.draw('filters', (el) => {
    if (!el.__f) {
      const mode = field('Period', AIBA.PERIOD_MODES.map((m) => [m.id, m.label]));
      const from = field('From', MONTH_OPTS);
      const to = field('Month', MONTH_OPTS);
      const c = field('Compare with', CMP);
      const cu = field('Currency', AIBA.CURRENCIES.map((x) => [x.id, x.label]));
      cu.wrap.title = "AIB's reported figures (tiles, balance sheet and capital). The sample monthly P&L stays in USD.";
      cu.select.addEventListener('change', () => AIBState.set({ cur: cu.select.value }));
      mode.select.addEventListener('change', () => AIBState.set({ p: mode.select.value }));
      from.select.addEventListener('change', () => AIBState.set({ s: from.select.value }));
      to.select.addEventListener('change', () => AIBState.set({ e: to.select.value }));
      c.select.addEventListener('change', () => AIBState.set({ c: c.select.value }));
      const lbl = el$('p', 'cc-filters-l');
      const ai = el$('a', 'cc-ai-link', 'AI analytics');
      ai.href = '#tab-ai';
      ai.addEventListener('click', (e) => { e.preventDefault(); showTab('ai', true); });
      el.append(mode.wrap, from.wrap, to.wrap, c.wrap, cu.wrap, lbl, ai);
      el.__f = { mode, from, to, c, cu, lbl };
    }
    const f = el.__f, p = period();
    f.mode.select.value = p.mode; f.from.select.value = p.start; f.to.select.value = p.end; f.c.select.value = cmp(); f.cu.select.value = cur();
    f.from.wrap.hidden = p.mode !== 'r';
    f.to.label.textContent = p.mode === 'm' ? 'Month' : p.mode === 'r' ? 'To' : 'Up to';
    f.lbl.textContent = 'Sample P&L: ' + p.label;
  });

  dash.draw('tools', (el) => {
    const id = el.dataset.chart, opts = (el.dataset.opts || '').split(','), key = el.dataset.key || 'm';
    if (!el.__seg) {
      const seg = el$('div', 'cc-seg');
      seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Chart type');
      TYPES.forEach(([v, l]) => {
        const b = el$('button', '', l); b.type = 'button'; b.dataset.v = v;
        b.addEventListener('click', () => AIBState.set({ ['t-' + id]: v }));
        seg.append(b);
      });
      el.append(seg);
      el.__seg = seg;
      if (opts.indexOf('measure') >= 0) {
        const f = field('Show', AIBA.MEASURES.map((x) => [x.id, x.label]));
        f.select.addEventListener('change', () => AIBState.set({ [key]: f.select.value }));
        el.append(f.wrap); el.__m = f;
      }
      if (opts.indexOf('forecast') >= 0) {
        const lab = el$('label', 'cc-check'); const cb = document.createElement('input'); cb.type = 'checkbox';
        cb.addEventListener('change', () => AIBState.set({ fc: cb.checked ? '1' : '0' }));
        lab.append(cb, document.createTextNode('Forecast to December'));
        el.append(lab); el.__fc = cb; el.__fcl = lab;
      }
    }
    [...el.__seg.children].forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === chartType(id) ? 'true' : 'false'));
    if (el.__m) el.__m.select.value = AIBState.get(key);
    if (el.__fc) {
      const latest = period().isLatest;
      el.__fc.checked = AIBState.get('fc') === '1';
      el.__fc.disabled = !latest;
      el.__fcl.title = latest ? '' : 'The forecast starts after ' + AIBA.monthLong(ALL[ALL.length - 1]) + '; choose a period ending then.';
    }
  });

  /* ---------- text that follows the period ---------- */
  dash.draw('takeaway', (el) => {
    const n = AIBA.narrative(D, period(), cur());
    const np = AIBA.kpiView(D, D.kpis.find((r) => r.id === 'net_profit'), cur());
    const b = (t) => el$('span', 'cc-n', t);
    el.replaceChildren('In ' + np.label.replace('Net profit, ', '') + ', AIB reported net profit of ', b(np.valueText), ', ', b(Math.abs(np.diff).toFixed(1) + '% ' + (np.diff >= 0 ? 'above' : 'below')), ' ' + np.prior_label.replace('vs ', '') + '. ',
      b(String(n.open)), ' of ', b(String(n.gates)), ' commencement decisions are still open ahead of the 10 November start.');
  });

  const CMP_PHRASE = { bp: ' against budget and last year', b: ' against budget', p: ' against last year', n: '' };
  const LONGM = (m) => AIBA.monthLong(m).split(' ')[0];
  dash.draw('ptext', (el) => {
    const p = period(), c = cmp(), type = chartType(el.dataset.chart || 'profit');
    const range = p.months.length === 1 ? AIBA.monthLong(p.months[0]) : LONGM(p.months[0]) + ' to ' + AIBA.monthLong(p.endMonth);
    const T = {
      label: () => p.label,
      kpinote: () => 'AIB reported figures: H1 2026 unaudited interims; capital and asset quality from the FY2025 audited accounts. ' + (cur() === 'usd' ? 'USD at a fixed ' + AIBA.AFN_PER_USD + ' AFN per USD. ' : '') + 'These tiles do not follow the period filter.',
      bsnote: () => "AIB reported, " + AIBA.unitLabel(cur()) + '. 31 March and 30 June 2026 are unaudited.',
      range: () => range,
      pnltitle: () => p.label + CMP_PHRASE[c],
      pnlnote: () => AIBA.narrative(D, p, cur()).pnlNote,
      mtitle: () => AIBA.measureById(AIBState.get('m')).label + ' by month',
      fmtitle: () => AIBA.measureById(AIBState.get('fm')).label + ': actual and forecast',
      ovnote: () => 'Actual' + { bp: ' against budget and the same month last year', b: ' against budget', p: ' against the same month last year', n: '' }[c] + ', USD thousands.',
      profitnote: () => [type === 'bar' ? 'Bars are actual' : type === 'table' ? 'Actual' : 'The thicker line is actual', /b/.test(c) ? 'the line is budget' : '', /p/.test(c) ? 'the dashed line is last year' : ''].filter(Boolean).join('; ') + '.',
      incnote: () => 'Solid lines are actual' + (/b/.test(c) ? '; dashed lines are budget' : c === 'p' ? '; dashed lines are 2025' : '') + '. Costs exclude credit impairment and tax.'
    };
    el.textContent = (T[el.dataset.v] || T.label)();
  });

  /* ---------- forecast page ---------- */
  const scenarioOn = (sc) => Object.keys(sc).some((k) => sc[k]);
  dash.draw('landing', (el) => {
    el.replaceChildren();
    const sc = AIBState.scenario(), ye = AIBA.yearEnd(D, sc), base = scenarioOn(sc) ? AIBA.yearEnd(D) : null;
    const tile = (label, o, cost, baseO) => {
      const t = el$('div', 'cc-tile');
      const good = o.vs_budget_pct >= 0;
      const l = el$('div', 'cc-tile-l'); l.append(el$('span', 'cc-dot ' + (good ? '' : Math.abs(o.vs_budget_pct) > 5 ? 'bad' : 'warn')), document.createTextNode(label));
      const d = el$('div', 'cc-tile-d');
      d.append(el$('span', good ? 'good' : 'badc', Math.abs(o.vs_budget_pct).toFixed(1) + '% ' + (cost ? (good ? 'below' : 'above') : (good ? 'above' : 'below'))), document.createTextNode(' budget of ' + money(o.budget)));
      t.append(l, el$('div', 'cc-tile-v', money(o.fy)), d, el$('div', 'cc-tile-d', '80% range ' + money(o.lo) + ' to ' + money(o.hi)));
      if (baseO) t.append(el$('div', 'cc-tile-d', 'Before what-if changes: ' + money(baseO.fy)));
      return t;
    };
    el.append(tile('Net profit, full-year 2026', ye.net, false, base && base.net), tile('Total income, full-year 2026', ye.income, false, base && base.income), tile('Operating costs, full-year 2026', ye.opex, true, base && base.opex));
    const q = el$('div', 'cc-tile');
    const ql = el$('div', 'cc-tile-l'); ql.append(el$('span', 'cc-dot'), document.createTextNode('Net profit, October to December'));
    q.append(ql, el$('div', 'cc-tile-v', money(ye.net.forecast)), el$('div', 'cc-tile-d', 'January to September actual ' + money(ye.net.ytd)), el$('div', 'cc-tile-d', 'Monthly ' + ye.net.months.map((m) => money(m.mean)).join(', ')));
    el.append(q);
  });

  dash.draw('whatif', (el) => {
    if (!el.__s) {
      el.__s = AIBA.SCENARIO_KEYS.map((k, i) => {
        const row = el$('label', 'cc-range');
        const name = el$('span', 'cc-range-l', k.label);
        const input = document.createElement('input'); input.type = 'range'; input.min = -20; input.max = 20; input.step = 1;
        const out = el$('output', 'cc-range-v');
        input.addEventListener('input', () => {
          out.textContent = signed(+input.value, 0) + '%';
          const v = el.__s.map((s) => s.input.value); v[i] = input.value;
          AIBState.set({ w: v.join(',') });
        });
        row.append(name, input, out);
        el.append(row);
        return { input, out, id: k.id };
      });
      const reset = el$('button', 'cc-btn', 'Reset'); reset.type = 'button';
      reset.addEventListener('click', () => AIBState.set({ w: '0,0,0,0' }));
      el.append(reset);
    }
    const sc = AIBState.scenario();
    el.__s.forEach((s) => { s.input.value = sc[s.id]; s.out.textContent = signed(sc[s.id], 0) + '%'; });
  });

  dash.draw('backtest', (el) => {
    el.replaceChildren();
    const m = AIBState.get('fm'), bt = AIBA.backtest(D.pnl_monthly, m, 3);
    const first = bt.rows[0].month, last = bt.rows[bt.rows.length - 1].month;
    el.append(el$('p', 'cc-note', 'Forecasting ' + LONGM(first) + ' to ' + LONGM(last) + ' from the six months before missed the actual ' + AIBA.measureById(m).label.toLowerCase() + ' by ' + bt.mape.toFixed(1) + '% on average; ' + bt.inside + ' of ' + bt.rows.length + ' months fell inside the 80% range.'));
    const rows = bt.rows.map((r) => ({ cells: [AIBCharts.monthLabel(r.month), kfmt(r.actual), kfmt(r.forecast), signed(r.error_pct, 1) + '%', r.inside ? 'Yes' : 'No'] }));
    el.append(UI.table(['Month', 'Actual', 'Forecast', 'Error', 'Inside range'], rows));
  });

  const WATCH_LABEL = { breach: 'Below minimum', watch: 'Watch', ok: 'Above minimum', none: 'No limit' };
  dash.draw('outlook', (el) => {
    el.replaceChildren();
    const wrap = el$('div', 'cc-scroll'), t = el$('table', 'cc-table'), th = el$('thead'), hr = el$('tr'), tb = el$('tbody');
    [['Ratio', ''], ['Latest', 'r'], ['As at', ''], ['DAB minimum', 'r'], ['Status', ''], ['Reading', '']].forEach(([h, c]) => hr.append(el$('th', c, h)));
    th.append(hr);
    AIBA.ratioWatch(D.ratios).forEach((r) => {
      const tr = el$('tr');
      const chip = el$('td'); chip.append(el$('span', 'cc-chip ' + toneOf(WATCH_LABEL[r.status]), WATCH_LABEL[r.status]));
      tr.append(el$('td', '', r.metric), el$('td', 'r', r.latest.toFixed(AIBA.ratioDp(r.latest)) + '%'), el$('td', 'nw', r.label), el$('td', 'r', r.limit == null ? '—' : r.limit.toFixed(1) + '%'), chip, el$('td', 'cc-muted', r.text));
      tb.append(tr);
    });
    t.append(th, tb); wrap.append(t); el.append(wrap);
  });

  /* ---------- Cost and efficiency (the reporting-pack cost review, shown in a frame) ---------- */
  // Sizes the frame to its page so there is one scroll bar. Opened from disk (file://) the frame
  // cannot be measured, so it keeps its CSS height and scrolls on its own.
  function fitFrame(f) {
    const doc = f.contentDocument; // null when opened from disk
    if (!doc || doc.URL === 'about:blank' || f.__doc === doc) return;
    f.__doc = doc;
    const fit = () => requestAnimationFrame(() => {
      const h = Math.ceil(doc.documentElement.getBoundingClientRect().height);
      if (h > 0 && f.offsetParent && Math.abs(h - f.clientHeight) > 2) f.style.height = h + f.offsetHeight - f.clientHeight + 'px'; // plus the frame's border
    });
    if (window.ResizeObserver) new ResizeObserver(fit).observe(doc.body);
    fit();
  }
  document.querySelectorAll('.cc-frame').forEach((f) => {
    f.addEventListener('load', () => fitFrame(f));
    if (f.contentDocument && f.contentDocument.readyState === 'complete') fitFrame(f);
  });

  /* ---------- AI analytics preview (sample answers from analytics.js; no AI service) ---------- */
  dash.draw('ai', (el) => {
    if (el.__built) return;
    el.__built = true;
    const form = el$('form', 'cc-ai-form');
    const input = document.createElement('input');
    input.type = 'text'; input.maxLength = 200; input.placeholder = 'Ask about profit, costs, income, ratios, forecasts or savings';
    input.setAttribute('aria-label', 'Question');
    const btn = el$('button', 'cc-btn cc-btn-primary', 'Ask'); btn.type = 'submit';
    form.append(input, btn);
    const chips = el$('div', 'cc-ai-chips');
    const out = el$('div', 'cc-ai-out'); out.setAttribute('aria-live', 'polite');
    const ask = (q) => {
      q = q.trim(); if (!q) return;
      const a = AIBA.askPreview(q, D, period(), cur());
      const card = el$('div', 'cc-ai-ans');
      const h = el$('h4', '', a.title); h.append(el$('span', 'cc-tag cc-tag-sample', 'Sample answer'));
      const ul = el$('ul'); a.lines.forEach((l) => ul.append(el$('li', '', l)));
      card.append(el$('p', 'cc-ai-q', q), h, ul);
      if (a.suggestions) { const s = el$('div', 'cc-ai-chips'); a.suggestions.forEach((x) => { const b = el$('button', 'cc-ai-chip', x); b.type = 'button'; b.addEventListener('click', () => ask(x)); s.append(b); }); card.append(s); }
      card.append(el$('p', 'cc-ai-src', a.source + ' · Preview answer written from the dashboard data, not by an AI service'));
      out.prepend(card);
      input.value = '';
    };
    AIBA.SUGGESTIONS.forEach((q) => { const b = el$('button', 'cc-ai-chip', q); b.type = 'button'; b.addEventListener('click', () => ask(q)); chips.append(b); });
    form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
    el.append(form, chips, out);
  });

  /* ---------- react to setting changes (filters, chart controls, design switch, back button) ---------- */
  function applyCompare() {
    document.querySelectorAll('th[data-cmp]').forEach((th) => { th.hidden = cmp().indexOf(th.dataset.cmp) < 0; });
  }
  applyCompare();
  AIBState.on((keys) => {
    if (keys.indexOf('*') >= 0 || keys.indexOf('tab') >= 0) showTab(AIBState.get('tab'));
    const rest = keys.filter((k) => k !== 'tab');
    if (!rest.length) return;
    if (rest.length === 1 && rest[0] === 'w') { dash.redraw('landing'); dash.redraw('chart-forecast'); return; }
    applyCompare();
    periodCalcs();
    dash.refresh();
  });
})();
