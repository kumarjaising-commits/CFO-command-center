(function () {
  'use strict';

  /* ---------- calculations (datasets joined or summed) ---------- */
  dash.calc('pnl_ytd', {
    inputs: ['pnl_monthly'],
    title: 'P&L year to date',
    description: 'Sums each P&L line from January to September and adds subtotals and variances.',
    fn: (pnl_monthly) => {
      const agg = {};
      pnl_monthly.forEach((r) => {
        const o = agg[r.line] || (agg[r.line] = { grp: r.grp, a: 0, b: 0, p: 0 });
        o.a += r.actual; o.b += r.budget; o.p += r.prior;
      });
      const row = (line, kind, grp, a, b, p) => {
        const v = grp === 'income' ? a - b : b - a;
        return { line, kind, actual: a, budget: b, variance: v, variance_pct: b ? (v / b) * 100 : null, prior: p, yoy_pct: p ? (a / p - 1) * 100 : null };
      };
      const R = (n) => row(n, 'line', agg[n].grp, agg[n].a, agg[n].b, agg[n].p);
      const S = (names) => ['a', 'b', 'p'].map((k) => names.reduce((s, n) => s + agg[n][k], 0));
      const inc = ['Net interest income', 'Fee and commission income', 'FX and trading income', 'Other income'];
      const opx = ['Staff costs', 'Technology and IT', 'Premises and administration', 'Other operating costs'];
      const ti = S(inc), to = S(opx);
      const imp = agg['Credit impairment'], tax = agg['Tax'];
      const pbt = [ti[0] - to[0] - imp.a, ti[1] - to[1] - imp.b, ti[2] - to[2] - imp.p];
      const net = [pbt[0] - tax.a, pbt[1] - tax.b, pbt[2] - tax.p];
      return [
        ...inc.map(R),
        row('Total income', 'total', 'income', ti[0], ti[1], ti[2]),
        ...opx.map(R),
        row('Total operating costs', 'total', 'expense', to[0], to[1], to[2]),
        R('Credit impairment'),
        row('Profit before tax', 'total', 'income', pbt[0], pbt[1], pbt[2]),
        R('Tax'),
        row('Net profit', 'total', 'income', net[0], net[1], net[2])
      ];
    }
  });

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

  dash.calc('headline', {
    inputs: ['pnl_monthly', 'gates'],
    title: 'Headline figures',
    description: 'Year-to-date net profit against budget, and how many pre-commencement gates are still open.',
    fn: (pnl_monthly, gates) => {
      let a = 0, b = 0;
      pnl_monthly.forEach((r) => { const s = r.grp === 'income' ? 1 : -1; a += s * r.actual; b += s * r.budget; });
      const pre = gates.filter((g) => g.category === 'Pre-commencement');
      return [{ ytd_net: a, ytd_budget: b, var_pct: (a / b - 1) * 100, open_gates: pre.filter((g) => g.status !== 'Closed').length, total_gates: pre.length }];
    }
  });

  dash.calc('bs_view', {
    inputs: ['balance_sheet'],
    title: 'Balance sheet with changes',
    description: 'Adds the change against the prior month and against the year start to each balance sheet line.',
    fn: (balance_sheet) => balance_sheet.map((r) => ({
      line: r.line, kind: r.kind, sep26: r.sep26, aug26: r.aug26, dec25: r.dec25,
      chg_month: r.aug26 ? (r.sep26 / r.aug26 - 1) * 100 : null,
      chg_ytd: r.dec25 ? (r.sep26 / r.dec25 - 1) * 100 : null
    }))
  });

  dash.calc('budget_view', {
    inputs: ['budget2027'],
    title: '2027 budget with total',
    description: 'Adds the change against the 2026 forecast to each function and a total row.',
    fn: (budget2027) => {
      const rows = budget2027.map((r) => ({
        function: r.function, kind: 'line', owner: r.owner, fcst_2026: r.fcst_2026, budget_2027: r.budget_2027,
        change_pct: (r.budget_2027 / r.fcst_2026 - 1) * 100, status: r.status, pct_complete: r.pct_complete, due: r.due
      }));
      const f = rows.reduce((s, r) => s + r.fcst_2026, 0);
      const b = rows.reduce((s, r) => s + r.budget_2027, 0);
      const avg = rows.reduce((s, r) => s + r.pct_complete, 0) / rows.length;
      rows.push({ function: 'Total operating costs', kind: 'total', owner: '', fcst_2026: f, budget_2027: b, change_pct: (b / f - 1) * 100, status: '', pct_complete: Math.round(avg), due: null });
      return rows;
    }
  });

  dash.calc('recons_view', {
    inputs: ['recons_aging'],
    title: 'Reconciliations with totals',
    description: 'Totals items and value per account class and for items over 30 and over 180 days.',
    fn: (recons_aging) => {
      const rows = recons_aging.map((r) => ({
        account_class: r.account_class, kind: 'line', owner: r.owner,
        items_total: r.items_0_30 + r.items_31_90 + r.items_91_180 + r.items_180_plus,
        items_over_30: r.items_31_90 + r.items_91_180 + r.items_180_plus,
        value_total: r.value_0_30 + r.value_31_90 + r.value_91_180 + r.value_180_plus,
        value_over_180: r.value_180_plus, risk: r.risk
      }));
      const t = (k) => rows.reduce((s, r) => s + r[k], 0);
      rows.push({ account_class: 'Total', kind: 'total', owner: '', items_total: t('items_total'), items_over_30: t('items_over_30'), value_total: t('value_total'), value_over_180: t('value_over_180'), risk: '' });
      return rows;
    }
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

  const TONE = {
    ok: ['Closed', 'Complete', 'Submitted', 'Approved', 'Realised', 'Effective', 'On track', 'Done', 'Low'],
    warn: ['In review', 'In progress', 'Drafting', 'Validated', 'Due today', 'Identified', 'Medium', 'Open', 'In preparation'],
    bad: ['Overdue', 'High', 'Late', 'Breach', 'Deficient']
  };
  const toneOf = (s) => (TONE.ok.includes(s) ? 'ok' : TONE.warn.includes(s) ? 'warn' : TONE.bad.includes(s) ? 'bad' : '');

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
    if (push) dash.setLink('tab-' + name);
  }
  tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab, true)));
  const h0 = location.hash.slice(1);
  if (h0.indexOf('tab-') === 0) showTab(h0.slice(4));

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
    const ths = [...table.querySelectorAll('thead th[data-field]')];
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

  /* ---------- KPI tiles ---------- */
  dash.draw('kpis', (el) => {
    if (notReady(el, ['kpis', 'ratios_monthly'])) return;
    el.replaceChildren();
    const groups = el.dataset.group ? el.dataset.group.split(',') : null;
    const rows = dash.data('kpis').data.filter((r) => !groups || groups.indexOf(r.group) >= 0);
    const rat = d3.group(dash.data('ratios_monthly').data, (d) => d.metric);
    rows.forEach((r) => {
      const up = r.direction === 'up';
      const met = up ? r.value >= r.target : r.value <= r.target;
      const gap = Math.abs(r.value - r.target) / Math.abs(r.target);
      const tone = met ? '' : gap > 0.1 ? 'bad' : 'warn';
      const tile = el$('div', 'cc-tile');
      const l = el$('div', 'cc-tile-l'); l.append(el$('span', 'cc-dot ' + tone), document.createTextNode(r.label));
      const v = el$('div', 'cc-tile-v', unitFmt(r.value, r.unit));
      const d = el$('div', 'cc-tile-d');
      const diff = r.unit === '%' ? r.value - r.prior : (r.value / r.prior - 1) * 100;
      const goodMove = up ? diff >= 0 : diff <= 0;
      const dt = el$('span', goodMove ? 'good' : 'badc', r.unit === '%' ? signed(diff, 1) + ' pp' : signed(diff, 1) + '%');
      d.append(dt, document.createTextNode(' ' + r.prior_label));
      const t = el$('div', 'cc-tile-d', (r.unit === 'USDk' ? 'Budget ' : up ? 'Target ≥ ' : 'Target ≤ ') + unitFmt(r.target, r.unit));
      tile.append(l, v, d, t);
      const s = rat.get(r.series);
      if (s && s.length > 1) {
        const vals = s.slice().sort((a, b) => (a.month < b.month ? -1 : 1)).map((x) => x.value);
        const x = d3.scaleLinear([0, vals.length - 1], [2, 158]);
        const y = d3.scaleLinear(d3.extent(vals), [24, 3]);
        const svg = d3.create('svg').attr('width', '100%').attr('height', 28).attr('viewBox', '0 0 160 28').attr('preserveAspectRatio', 'none');
        svg.append('path').attr('d', d3.line().x((_, i) => x(i)).y((q) => y(q))(vals)).attr('fill', 'none').attr('stroke', dash.colors[0]).attr('stroke-width', 1.75).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('vector-effect', 'non-scaling-stroke');
        tile.append(svg.node());
      }
      el.append(tile);
    });
  });

  /* ---------- month charts (bars and lines) ---------- */
  function monthChart(el, rows, o) {
    el.replaceChildren();
    const series = [...(o.bars || []), ...o.lines];
    el.append(legend(series.map((s) => ({ label: s.label, color: s.color }))));
    const W = Math.max(280, el.clientWidth || 600), H = 250;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const vals = rows.flatMap((r) => series.map((s) => r[s.k]));
    const lo = Math.min(0, d3.min(vals)), hi = d3.max(vals) * 1.08;
    const y = d3.scaleLinear([lo, hi], [H - 26, 8]).nice(5);
    const tickLabels = y.ticks(5).map(o.fmtY);
    const left = Math.ceil(measure(svg, tickLabels, 11)) + 10;
    const x = d3.scaleBand(rows.map((r) => r.month), [left, W - 8]).paddingInner(0.3).paddingOuter(0.15);
    svg.append('g').selectAll('line').data(y.ticks(5)).join('line').attr('x1', left).attr('x2', W - 8).attr('y1', y).attr('y2', y).attr('stroke', 'var(--cds-chart-grid)');
    svg.append('g').selectAll('text').data(y.ticks(5)).join('text').attr('x', left - 6).attr('y', (d) => y(d) + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(o.fmtY);
    svg.append('g').selectAll('text').data(rows).join('text').attr('x', (r) => x(r.month) + x.bandwidth() / 2).attr('y', H - 8).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text((r) => MON(pd(r.month)));
    (o.bars || []).forEach((b) => {
      svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.month)).attr('width', Math.min(32, x.bandwidth())).attr('y', (r) => y(Math.max(0, r[b.k]))).attr('height', (r) => Math.abs(y(r[b.k]) - y(0))).attr('rx', 3).attr('fill', b.color).attr('transform', (r) => `translate(${(x.bandwidth() - Math.min(32, x.bandwidth())) / 2},0)`);
    });
    o.lines.forEach((s) => {
      const pts = rows.map((r) => [x(r.month) + x.bandwidth() / 2, y(r[s.k])]);
      svg.append('path').attr('d', d3.line()(pts)).attr('fill', 'none').attr('stroke', s.color).attr('stroke-width', 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round').attr('stroke-dasharray', s.dash || null);
      if (!s.dash) svg.append('g').selectAll('circle').data(pts).join('circle').attr('cx', (p) => p[0]).attr('cy', (p) => p[1]).attr('r', 3).attr('fill', s.color);
    });
    const tip = tipFor(el);
    svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.month) - x.step() * 0.1).attr('width', x.step()).attr('y', 0).attr('height', H - 20).attr('fill', 'transparent')
      .on('mousemove', (ev, r) => tip.show(MONY(pd(r.month)), series.map((s) => ({ c: s.color, t: s.label + ': ' + o.fmtT(r[s.k]) })), ev))
      .on('mouseleave', () => tip.hide());
  }

  dash.draw('chart-profit', (el) => {
    if (notReady(el, ['monthly'])) return;
    monthChart(el, dash.data('monthly').data, {
      bars: [{ k: 'net', label: 'Actual', color: dash.colors[0] }],
      lines: [{ k: 'net_b', label: 'Budget', color: dash.colors[1] }, { k: 'net_p', label: 'Same month 2025', color: 'var(--cds-chart-reference)', dash: '4 3' }],
      fmtY: (v) => fmtInt(v), fmtT: (v) => fmtInt(v) + 'k'
    });
  });

  dash.draw('chart-incexp', (el) => {
    if (notReady(el, ['monthly'])) return;
    monthChart(el, dash.data('monthly').data, {
      lines: [
        { k: 'income', label: 'Income', color: dash.colors[0] },
        { k: 'opex', label: 'Operating costs', color: dash.colors[2] },
        { k: 'income_b', label: 'Income budget', color: dash.colors[0], dash: '4 3' },
        { k: 'opex_b', label: 'Cost budget', color: dash.colors[2], dash: '4 3' }
      ],
      fmtY: (v) => fmtInt(v), fmtT: (v) => fmtInt(v) + 'k'
    });
  });

  /* ---------- ratio small multiples ---------- */
  dash.draw('chart-ratios', (el) => {
    if (notReady(el, ['ratios_monthly'])) return;
    el.replaceChildren();
    const groups = d3.group(dash.data('ratios_monthly').data, (d) => d.metric);
    const kindWord = { min: 'Minimum', max: 'Maximum', target: 'Target' };
    const tip = tipFor(el);
    const cells = [];
    groups.forEach((rows, name) => {
      const cell = el$('div');
      el.append(cell);
      cells.push([cell, rows, name]);
    });
    cells.forEach(([cell, rows, name]) => {
      rows = rows.slice().sort((a, b) => (a.month < b.month ? -1 : 1));
      const last = rows[rows.length - 1];
      const lim = last.limit, kind = last.limit_kind;
      const breach = kind === 'min' ? last.value < lim : kind === 'max' ? last.value > lim : false;
      const t = el$('p', 'cc-mini-t'); t.append(el$('span', '', name), el$('span', '', last.value.toFixed(1) + '%'));
      cell.append(t);
      const W = Math.max(180, cell.clientWidth || 240), H = 96;
      const svg = d3.select(cell).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
      const vals = rows.map((r) => r.value).concat([lim]);
      const pad = (d3.max(vals) - d3.min(vals)) * 0.2 || 1;
      const y = d3.scaleLinear([d3.min(vals) - pad, d3.max(vals) + pad], [H - 16, 8]);
      const x = d3.scaleLinear([0, rows.length - 1], [4, W - 8]);
      svg.append('line').attr('x1', 4).attr('x2', W - 8).attr('y1', y(lim)).attr('y2', y(lim)).attr('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '4 3');
      svg.append('text').attr('x', 4).attr('y', y(lim) - 4).attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(kindWord[kind] + ' ' + lim.toFixed(1) + '%');
      svg.append('path').attr('d', d3.line().x((_, i) => x(i)).y((r) => y(r.value))(rows)).attr('fill', 'none').attr('stroke', dash.colors[0]).attr('stroke-width', 2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
      svg.append('circle').attr('cx', x(rows.length - 1)).attr('cy', y(last.value)).attr('r', 3.5).attr('fill', breach ? 'var(--cds-chart-status-critical)' : dash.colors[0]);
      svg.append('text').attr('x', 4).attr('y', H - 3).attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(MON(pd(rows[0].month)));
      svg.append('text').attr('x', W - 8).attr('y', H - 3).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(MON(pd(last.month)));
      svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', (_, i) => x(i) - (W - 12) / rows.length / 2).attr('width', (W - 12) / rows.length).attr('y', 0).attr('height', H - 12).attr('fill', 'transparent')
        .on('mousemove', (ev, r) => tip.show(name, [{ t: MONY(pd(r.month)) + ': ' + r.value.toFixed(1) + '%' }, { t: kindWord[kind] + ': ' + lim.toFixed(1) + '%' }], ev))
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
})();
