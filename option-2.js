/*
 * Option 2 (board intelligence design). Every number, sentence and forecast comes from analytics.js,
 * the same source as Option 1; this file only renders it in Option 2's design language.
 * Classes here are Tailwind classes: rebuild option-2.css after changing them (see README).
 */
(function () {
  'use strict';
  const D = window.AIB_DATA, A = window.AIBA, S = window.AIBState;
  const ALL = A.monthsOf(D.pnl_monthly);
  const LATEST = ALL[ALL.length - 1];
  const period = () => S.period(ALL);
  const $ = (id) => document.getElementById(id);
  const set = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const k = (v) => A.fmtInt(v);
  const sk = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + k(Math.abs(v));
  const sp = (v, d) => (v == null || isNaN(v) ? '—' : A.signed(v, d == null ? 1 : d) + '%');
  const tone = (v) => (v > 0 ? 'text-brand-green' : v < 0 ? 'text-brand-rose' : 'text-navy-500');
  const date = (s) => { const d = new Date(s + 'T00:00:00Z'); return String(d.getUTCDate()).padStart(2, '0') + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
  const monthName = (m) => A.monthLong(m).split(' ')[0];
  const CHIP = {
    ok: 'bg-brand-greenLight text-brand-green border border-brand-green/30',
    warn: 'bg-brand-amberLight text-brand-amber border border-brand-amber/30',
    bad: 'bg-brand-roseLight text-brand-rose border border-brand-rose/30',
    '': 'bg-navy-100 text-navy-600 border border-navy-200'
  };
  const chip = (s) => (s ? '<span class="' + CHIP[A.toneOf(s)] + ' px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase whitespace-nowrap">' + esc(s) + '</span>' : '');
  const TH = 'p-3.5';
  const thead = (cols) => '<thead><tr class="bg-navy-900 text-white uppercase text-[11px] font-semibold tracking-wider">' + cols.map((c) => '<th class="' + TH + (c[1] ? ' text-' + c[1] : '') + '">' + esc(c[0]) + '</th>').join('') + '</tr></thead>';
  const td = (html, cls) => '<td class="p-3.5' + (cls ? ' ' + cls : '') + '">' + html + '</td>';
  const table = (cols, body, id) => '<table' + (id ? ' id="' + id + '"' : '') + ' class="w-full text-left font-sans text-xs">' + thead(cols) + '<tbody class="divide-y divide-navy-100 tabular-nums text-[13px]">' + body + '</tbody></table>';
  const CMP_PHRASE = { bp: ' vs budget and 2025', b: ' vs budget', p: ' vs 2025', n: '' };
  const cmp = () => S.get('c');

  /* ---------- charts (shared renderer in charts.js, Option 2 colours) ---------- */
  const THEME = { grid: '#E2E8F0', text: '#64748B', highlight: 'rgba(37, 99, 235, 0.06)', forecastBg: 'rgba(15, 23, 42, 0.035)', font: 'Inter, sans-serif' };
  const COL = { actual: '#2563EB', budget: '#94A3B8', prior: '#D97706', forecast: '#1D4ED8', income: '#2563EB', opex: '#D97706' };
  const UI = {
    legend(items) {
      const d = document.createElement('div');
      d.className = 'flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-navy-600 mb-2';
      d.innerHTML = items.map((i) => '<span class="flex items-center"><span class="w-3 h-3 rounded-sm mr-1.5" style="background:' + i.color + ';opacity:' + (i.opacity || 1) + '"></span>' + esc(i.label) + '</span>').join('');
      return d;
    },
    tip(host) {
      const t = document.createElement('div');
      t.className = 'absolute z-10 pointer-events-none bg-white border border-navy-200 rounded-lg shadow-lg px-3 py-2 text-xs text-navy-800 opacity-0 transition-opacity';
      host.append(t);
      return {
        show(title, lines, ev) {
          t.innerHTML = '<div class="font-semibold text-navy-900 mb-0.5">' + esc(title) + '</div>' + lines.map((l) => '<div class="flex items-center tabular-nums">' + (l.c ? '<span class="w-2 h-2 rounded-sm mr-1.5" style="background:' + l.c + '"></span>' : '') + esc(l.t) + '</div>').join('');
          t.style.opacity = 1;
          const r = host.getBoundingClientRect();
          let x = ev.clientX - r.left + 12, y = ev.clientY - r.top - t.offsetHeight - 10;
          x = Math.max(0, Math.min(x, host.clientWidth - t.offsetWidth));
          if (y < 0) y = ev.clientY - r.top + 14;
          t.style.left = x + 'px'; t.style.top = y + 'px';
        },
        hide() { t.style.opacity = 0; }
      };
    },
    table(head, rows) {
      const d = document.createElement('div');
      d.className = 'overflow-x-auto border border-navy-200 rounded-lg';
      d.innerHTML = '<table class="w-full text-left text-xs">' +
        '<thead><tr class="bg-navy-50 text-navy-600 uppercase text-[11px] font-semibold tracking-wider">' + head.map((h, i) => '<th class="p-2.5' + (i ? ' text-right' : '') + '">' + esc(h) + '</th>').join('') + '</tr></thead>' +
        '<tbody class="divide-y divide-navy-100 tabular-nums">' + rows.map((r) => '<tr class="' + (r.forecast ? 'italic text-navy-500' : r.highlight ? 'bg-brand-blueLight/50' : '') + '">' + r.cells.map((c, i) => '<td class="p-2.5' + (i ? ' text-right' : ' whitespace-nowrap') + '">' + esc(c || (i ? '' : '—')) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
      return d;
    }
  };
  const CHART_DEFAULT = { profit: 'bar', incexp: 'line', forecast: 'line' };
  const chartType = (id) => S.get('t-' + id) || CHART_DEFAULT[id];
  const kt = (v) => k(v) + 'k';

  function trendCfg(id, measure, forecastOn, scenario) {
    const p = period();
    const s = A.measureSeries(D.pnl_monthly, measure).filter((r) => r.month <= p.endMonth);
    const series = [{ label: 'Actual', color: COL.actual, role: 'main', values: s.map((r) => r.actual) }];
    if (/b/.test(cmp())) series.push({ label: 'Budget', color: COL.budget, role: 'dash', values: s.map((r) => r.budget) });
    if (/p/.test(cmp())) series.push({ label: 'Same month 2025', color: COL.prior, role: 'line', values: s.map((r) => r.prior) });
    let forecast = null;
    if (forecastOn && p.isLatest) {
      const f = A.measureForecast(D.pnl_monthly, measure, { scenario });
      forecast = { label: 'Forecast', color: COL.forecast, months: f.map((x) => x.month), mean: f.map((x) => x.mean), lo: f.map((x) => x.lo), hi: f.map((x) => x.hi) };
    }
    return { months: s.map((r) => r.month), series, forecast, highlight: p.months, type: chartType(id), fmtY: k, fmtT: kt, theme: THEME, ui: UI };
  }

  const visible = (el) => el && !el.closest('.hidden');
  function drawCharts() {
    const p = period();
    [['o2-chart-profit', 'profit'], ['o2-chart-profit-pnl', 'profit']].forEach(([id, c]) => {
      const el = $(id);
      if (visible(el)) AIBCharts.trend(el, trendCfg(c, S.get('m'), S.get('fc') === '1'));
    });
    const ie = $('o2-chart-incexp');
    if (visible(ie)) {
      const rows = A.monthlyTotals(D.pnl_monthly).filter((r) => r.month <= p.endMonth);
      const series = [
        { label: 'Income', color: COL.income, role: 'main', values: rows.map((r) => r.income) },
        { label: 'Operating costs', color: COL.opex, role: 'main', values: rows.map((r) => r.opex) }
      ];
      if (/b/.test(cmp())) series.push({ label: 'Income budget', color: COL.income, role: 'dash', values: rows.map((r) => r.income_b) }, { label: 'Cost budget', color: COL.opex, role: 'dash', values: rows.map((r) => r.opex_b) });
      else if (cmp() === 'p') series.push({ label: 'Income 2025', color: COL.income, role: 'dash', values: rows.map((r) => r.income_p) }, { label: 'Costs 2025', color: COL.opex, role: 'dash', values: rows.map((r) => r.opex_p) });
      AIBCharts.trend(ie, { months: rows.map((r) => r.month), series, forecast: null, highlight: p.months, type: chartType('incexp'), fmtY: k, fmtT: kt, theme: THEME, ui: UI });
    }
    const fe = $('o2-chart-forecast');
    if (visible(fe)) {
      if (!p.isLatest) fe.innerHTML = '<p class="text-xs text-navy-500 py-8 text-center">The forecast starts after the latest month of actuals. Choose a period that ends in ' + esc(A.monthLong(LATEST)) + ' to see it.</p>';
      else AIBCharts.trend(fe, trendCfg('forecast', S.get('fm'), true, S.scenario()));
    }
    document.querySelectorAll('[data-o2-spark]').forEach((el) => { if (visible(el)) spark(el); });
  }

  function spark(el) {
    const rows = D.ratios_monthly.filter((r) => r.metric === el.dataset.o2Spark && r.month <= period().endMonth).sort((a, b) => (a.month < b.month ? -1 : 1));
    if (rows.length < 2) { el.innerHTML = ''; return; }
    const W = Math.max(160, el.clientWidth || 220), H = 56, lim = rows[0].limit;
    const vals = rows.map((r) => r.value).concat([lim]);
    const pad = (d3.max(vals) - d3.min(vals)) * 0.2 || 1;
    const y = d3.scaleLinear([d3.min(vals) - pad, d3.max(vals) + pad], [H - 4, 4]);
    const x = d3.scaleLinear([0, rows.length - 1], [2, W - 4]);
    el.innerHTML = '';
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', '0 0 ' + W + ' ' + H);
    svg.append('line').attr('x1', 2).attr('x2', W - 4).attr('y1', y(lim)).attr('y2', y(lim)).attr('stroke', '#94A3B8').attr('stroke-dasharray', '4 3');
    svg.append('path').attr('d', d3.line().x((_, i) => x(i)).y((r) => y(r.value))(rows)).attr('fill', 'none').attr('stroke', COL.actual).attr('stroke-width', 2).attr('stroke-linejoin', 'round');
    svg.append('circle').attr('cx', x(rows.length - 1)).attr('cy', y(rows[rows.length - 1].value)).attr('r', 3).attr('fill', COL.actual);
  }

  /* ---------- toolbars ---------- */
  const TYPES = [['bar', 'Bar'], ['line', 'Line'], ['area', 'Area'], ['table', 'Table']];
  const selectHtml = (key, opts, value, label) => '<label class="flex items-center gap-1.5 text-[11px] font-semibold text-navy-500 uppercase tracking-wider">' + esc(label) +
    '<select data-o2-set="' + key + '" class="bg-white border border-navy-300 text-xs text-navy-900 normal-case tracking-normal font-medium rounded-md px-2 py-1 outline-none focus:border-brand-blue">' +
    opts.map(([v, t]) => '<option value="' + esc(v) + '"' + (v === value ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></label>';
  function toolbar(id, chart, o) {
    const p = period();
    let h = '<div class="inline-flex bg-navy-100 rounded-md p-0.5" role="group" aria-label="Chart type">' +
      TYPES.map(([v, t]) => '<button type="button" data-o2-type="' + chart + '" data-v="' + v + '" aria-pressed="' + (chartType(chart) === v) + '" class="px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ' + (chartType(chart) === v ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-500 hover:text-navy-900') + '">' + t + '</button>').join('') + '</div>';
    if (o.measure) h += selectHtml(o.measure, A.MEASURES.map((m) => [m.id, m.label]), S.get(o.measure), 'Measure');
    if (o.forecast) h += '<label class="flex items-center gap-1.5 text-xs font-medium ' + (p.isLatest ? 'text-navy-700 cursor-pointer' : 'text-navy-400 cursor-not-allowed') + '"' + (p.isLatest ? '' : ' title="The forecast starts after ' + esc(A.monthLong(LATEST)) + '; choose a period ending then."') + '><input type="checkbox" data-o2-set="fc" class="accent-brand-blue w-3.5 h-3.5"' + (S.get('fc') === '1' ? ' checked' : '') + (p.isLatest ? '' : ' disabled') + '> Forecast to December</label>';
    set(id, h);
  }

  /* ---------- header controls ---------- */
  function headerControls() {
    const p = period();
    const fill = (id, opts, v) => {
      const el = $(id); if (!el) return;
      if (!el.options.length) opts.forEach(([val, t]) => { const o = document.createElement('option'); o.value = val; o.textContent = t; o.className = 'bg-navy-900 text-white'; el.append(o); });
      el.value = v;
    };
    const months = ALL.map((m) => [m.slice(0, 7), A.monthShort(m)]);
    fill('o2-period-mode', A.PERIOD_MODES.map((m) => [m.id, m.label]), p.mode);
    fill('o2-period-start', months, p.start);
    fill('o2-period-end', months, p.end);
    fill('o2-compare', [['bp', 'Budget and 2025'], ['b', 'Budget'], ['p', '2025'], ['n', 'None']], cmp());
    $('o2-period-from').classList.toggle('hidden', p.mode !== 'r');
    $('o2-period-end-label').textContent = p.mode === 'm' ? 'Month' : p.mode === 'r' ? 'To' : 'Up to';
  }

  /* ---------- KPI card (same values as Option 1's tiles) ---------- */
  function kpiCard(r0) {
    const p = period(), r = A.kpiForPeriod(D, r0, p);
    const up = r.direction === 'up', money = r.unit === 'USDk';
    const met = up ? r.value >= r.target : r.value <= r.target;
    const val = money ? A.money(r.value) : r.value.toFixed(r.id === 'nim' ? 2 : 1) + '%';
    const tgt = money ? A.money(r.target) : r.target.toFixed(1) + '%';
    const badge = money
      ? '<span class="' + (met ? 'bg-brand-greenLight text-brand-green' : 'bg-brand-roseLight text-brand-rose') + ' font-bold px-2 py-0.5 rounded text-[11px] normal-case">' + sp((r.value / r.target - 1) * 100) + ' vs budget</span>'
      : '<span class="' + (met ? 'bg-brand-greenLight text-brand-green' : 'bg-brand-roseLight text-brand-rose') + ' font-bold px-2 py-0.5 rounded text-[11px] normal-case">' + (met ? 'Within target' : 'Outside target') + '</span>';
    let foot = 'No earlier month to compare';
    if (r.prior != null) {
      const diff = r.unit === '%' ? r.value - r.prior : (r.value / r.prior - 1) * 100;
      const good = up ? diff >= 0 : diff <= 0;
      foot = '<span>' + esc(r.prior_label) + '</span><strong class="' + (good ? 'text-brand-green' : 'text-brand-rose') + ' font-semibold tabular-nums">' + (r.unit === '%' ? A.signed(diff, r.id === 'nim' ? 2 : 1) + ' pp' : A.signed(diff, 1) + '%') + '</strong>';
    }
    return '<div class="bg-white border border-navy-200 rounded-xl p-5 card-shadow space-y-3">' +
      '<div class="flex items-center justify-between gap-2 text-xs font-medium text-navy-500 uppercase tracking-wider"><span>' + esc(r.label) + '</span>' + badge + '</div>' +
      '<div class="flex items-baseline space-x-2"><span class="text-3xl font-sans font-bold text-navy-900 tabular-nums">' + val + '</span><span class="text-xs text-navy-500">' + (money ? 'Budget: ' : up ? 'Target ≥ ' : 'Target ≤ ') + tgt + '</span></div>' +
      '<div class="pt-2 border-t border-navy-100 flex items-center justify-between text-xs text-navy-600">' + foot + '</div></div>';
  }

  /* ---------- pages ---------- */
  const ICON = {
    ok: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>',
    warn: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
    shield: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>'
  };
  const TONE_BOX = { ok: 'bg-brand-greenLight text-brand-green', warn: 'bg-brand-amberLight text-brand-amber', bad: 'bg-brand-roseLight text-brand-rose' };
  const DOT = ['bg-brand-blue', 'bg-brand-amber', 'bg-brand-green'];

  function overview() {
    const p = period(), n = A.narrative(D, p);
    const net = A.pnlSummary(D.pnl_monthly, p.months).find((r) => r.line === 'Net profit');
    set('o2-narrative-title', 'Executive Narrative: ' + esc(p.short) + ' Financial Trajectory &amp; Operating Model Handover');
    set('o2-narrative', esc(p.phrase) + ', net profit is <strong class="text-navy-900 font-semibold">' + A.money(net.actual) + '</strong>, <strong class="' + (net.variance >= 0 ? 'text-brand-green' : 'text-brand-rose') + ' font-semibold">' + Math.abs(net.variance_pct).toFixed(1) + '% ' + (net.variance >= 0 ? 'above' : 'below') + '</strong> budget. ' + esc(n.pnlNote));
    const closed = n.gates - n.open;
    set('o2-gates-count', closed + ' of ' + n.gates + ' <span class="text-xs font-normal text-navy-500">Gates Closed</span>');
    $('o2-gates-bar').style.width = (n.gates ? (closed / n.gates) * 100 : 0) + '%';
    set('o2-gates-note', n.open + ' decision gate' + (n.open === 1 ? '' : 's') + ' pending written CEO confirmation.');
    set('o2-callouts', n.callouts.map((c, i) => '<div class="flex items-start space-x-3 bg-white p-3 rounded-lg border border-navy-100"><div class="p-1.5 ' + TONE_BOX[c.tone] + ' rounded shrink-0">' + (i === 2 ? ICON.shield : c.tone === 'ok' ? ICON.ok : ICON.warn) + '</div><div><strong class="text-navy-900 block font-semibold mb-0.5">' + esc(c.title) + '</strong><span class="text-navy-600">' + esc(c.text) + '</span></div></div>').join(''));
    set('o2-kpis', ['net_profit_ytd', 'car', 'cost_income', 'lcr'].map((id) => kpiCard(D.kpis.find((r) => r.id === id))).join(''));
    const M = A.measureById(S.get('m'));
    set('o2-profit-title', esc(M.label) + " Trajectory (USD '000)");
    set('o2-profit-sub', esc(p.label) + esc(CMP_PHRASE[cmp()]) + '. Shaded months are the selected period.');
    toolbar('o2-tools-profit', 'profit', { measure: 'm', forecast: true });
    const s = A.measureSeries(D.pnl_monthly, M.id).filter((r) => p.months.indexOf(r.month) >= 0);
    const peak = s.reduce((a, b) => ((M.cost ? b.actual < a.actual : b.actual > a.actual) ? b : a));
    set('o2-insight', '<strong>Analytical Insight:</strong> ' + (s.length > 1 ? esc(M.label) + ' was ' + (M.cost ? 'lowest' : 'highest') + ' in ' + esc(monthName(peak.month)) + ' (' + A.money(peak.actual) + ') within ' + esc(p.label.charAt(0).toLowerCase() + p.label.slice(1)) + '.' : esc(M.label) + ' was ' + A.money(peak.actual) + ' in ' + esc(A.monthLong(peak.month)) + ', ' + sp(peak.budget ? ((M.cost ? peak.budget - peak.actual : peak.actual - peak.budget) / Math.abs(peak.budget)) * 100 : null) + ' against budget.'));
    const pre = D.gates.filter((g) => g.category === 'Pre-commencement');
    set('o2-gate-list', pre.map((g, i) => '<div class="p-2.5 bg-navy-50 rounded-lg border border-navy-200 flex items-center justify-between gap-3"><div><div class="font-semibold text-navy-900">' + (i + 1) + '. ' + esc(g.gate) + '</div><div class="text-navy-500 text-[11px]">Owner: ' + esc(g.owner) + ' | Due: ' + esc(date(g.required_by)) + '</div></div>' + chip(g.status) + '</div>').join(''));
    set('o2-commentary', n.commentary.map((c, i) => '<div class="space-y-2"><h4 class="font-semibold text-navy-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5"><span class="w-2 h-2 rounded-full ' + DOT[i] + '"></span><span>' + (i + 1) + '. ' + esc(c.title) + '</span></h4><p class="leading-relaxed">' + esc(c.text) + '</p></div>').join(''));
  }

  function pnl() {
    const p = period(), c = cmp(), rows = A.pnlSummary(D.pnl_monthly, p.months);
    const range = p.months.length === 1 ? A.monthLong(p.months[0]) : monthName(p.months[0]) + ' to ' + A.monthLong(p.endMonth);
    set('o2-pnl-sub', esc(range) + ' performance breakdown (USD thousands). Favourable variances indicated in green.');
    const multi = p.months.length > 1;
    const cols = [['Financial line item']];
    if (multi) cols.push([MON[+p.end.slice(5, 7) - 1] + ' ' + p.end.slice(0, 4) + ' actual', 'right']);
    cols.push([p.short + ' actual', 'right']);
    if (/b/.test(c)) cols.push(['Budget', 'right'], ['Variance', 'right'], ['Var %', 'right']);
    if (/p/.test(c)) cols.push(['Same period 2025', 'right'], ['Change vs 2025', 'right']);
    const paren = (r, v) => (r.grp === 'expense' && r.line !== 'Total income' ? '(' + k(v) + ')' : k(v));
    const body = rows.map((r) => {
      const isNet = r.line === 'Net profit', total = r.kind === 'total';
      const cls = isNet ? 'bg-brand-blueLight/50 font-bold text-navy-900 border-t-2 border-brand-blue' : total ? 'bg-navy-50/80 font-bold text-navy-900' : 'hover:bg-navy-50';
      let h = td(esc(total ? r.line.toUpperCase() : r.line), total ? '' : 'font-semibold text-navy-900');
      if (multi) h += td(paren(r, r.latest), 'text-right');
      h += td(paren(r, r.actual), 'text-right font-bold ' + (total ? 'text-brand-blue' : 'text-navy-900') + (isNet ? ' text-base' : ''));
      if (/b/.test(c)) h += td(paren(r, r.budget), 'text-right text-navy-600') + td(sk(r.variance), 'text-right font-semibold ' + tone(r.variance)) + td(sp(r.variance_pct), 'text-right font-semibold ' + tone(r.variance));
      if (/p/.test(c)) h += td(paren(r, r.prior), 'text-right text-navy-500') + td(sp(r.yoy_pct), 'text-right text-navy-600');
      return '<tr class="' + cls + '">' + h + '</tr>';
    }).join('');
    set('o2-pnl-table', table(cols, body, 'pnlExecutiveTable'));
    const q = $('o2-pnl-search'); if (q && q.value) filterTable('pnlExecutiveTable', q.value);
    set('o2-pnl-profit-title', esc(A.measureById(S.get('m')).label) + ' by month');
    toolbar('o2-tools-profit-pnl', 'profit', { measure: 'm', forecast: true });
    toolbar('o2-tools-incexp', 'incexp', {});
  }

  function balance() {
    const p = period();
    const car = A.kpiForPeriod(D, D.kpis.find((r) => r.id === 'car'), p);
    const ok = car.value >= car.target;
    $('o2-car-badge').className = (ok ? 'bg-brand-greenLight text-brand-green border-brand-green/30' : 'bg-brand-roseLight text-brand-rose border-brand-rose/30') + ' border text-xs font-semibold px-3 py-1 rounded-full';
    set('o2-car-badge', 'Capital Adequacy at ' + esc(A.monthShort(p.endMonth)) + ': ' + (ok ? 'Above minimum' : 'Below minimum') + ' (' + car.value.toFixed(1) + '%)');
    set('o2-bs-kpis', D.kpis.filter((r) => r.group === 'Capital and liquidity' || r.group === 'Asset quality').map(kpiCard).join(''));
    const metrics = [...new Set(D.ratios_monthly.map((r) => r.metric))];
    set('o2-ratios', metrics.map((m) => {
      const rows = D.ratios_monthly.filter((r) => r.metric === m && r.month <= p.endMonth).sort((a, b) => (a.month < b.month ? -1 : 1));
      const last = rows[rows.length - 1], d = m === 'Net interest margin' ? 2 : 1;
      const out = last.limit_kind === 'min' ? last.value < last.limit : last.value > last.limit;
      return '<div class="border border-navy-200 rounded-lg p-3"><div class="flex justify-between text-xs"><span class="font-semibold text-navy-700">' + esc(m) + '</span><span class="font-bold tabular-nums ' + (out ? 'text-brand-rose' : 'text-navy-900') + '">' + last.value.toFixed(d) + '%</span></div><div class="text-[11px] text-navy-500">' + (last.limit_kind === 'min' ? 'Minimum ' : 'Maximum ') + last.limit.toFixed(d) + '% (sample)</div><div data-o2-spark="' + esc(m) + '" class="mt-1"></div></div>';
    }).join(''));
    const rows = A.bsView(D.balance_sheet);
    set('o2-bs-table', table([['Balance sheet line item'], ['30 Sep 2026', 'right'], ['31 Aug 2026', 'right'], ['31 Dec 2025', 'right'], ['Change vs Aug', 'right'], ['Change vs Dec', 'right']],
      rows.map((r) => { const t = r.kind === 'total'; return '<tr class="' + (t ? 'bg-navy-50 font-bold text-navy-900' : 'hover:bg-navy-50') + '">' + td(esc(t ? r.line.toUpperCase() : r.line), t ? '' : 'text-navy-800') + td(k(r.sep26), 'text-right font-bold ' + (t ? 'text-brand-blue' : 'text-navy-900')) + td(k(r.aug26), 'text-right text-navy-600') + td(k(r.dec25), 'text-right text-navy-600') + td(sp(r.chg_month), 'text-right font-semibold ' + tone(r.chg_month)) + td(sp(r.chg_ytd), 'text-right font-semibold ' + tone(r.chg_ytd)) + '</tr>'; }).join('')));
  }

  function budget() {
    const rows = A.budgetView(D.budget2027);
    set('o2-budget-table', table([['Function / department'], ['Budget owner'], ['2026 forecast', 'right'], ['2027 draft', 'right'], ['Change', 'right'], ['Status', 'center'], ['Complete', 'right'], ['Due', 'right']],
      rows.map((r) => { const t = r.kind === 'total'; return '<tr class="' + (t ? 'bg-navy-50 font-bold text-navy-900' : 'hover:bg-navy-50') + '">' + td(esc(t ? r.function.toUpperCase() : r.function), 'font-semibold text-navy-900') + td(esc(r.owner), 'text-navy-600') + td(k(r.fcst_2026), 'text-right') + td(k(r.budget_2027), 'text-right font-bold text-navy-900') + td(sp(r.change_pct), 'text-right font-semibold ' + tone(-r.change_pct)) + td(chip(r.status), 'text-center') + td(r.pct_complete + '%', 'text-right') + td(r.due ? esc(date(r.due)) : '—', 'text-right whitespace-nowrap') + '</tr>'; }).join('')));
  }

  function close() {
    const rows = A.reconsView(D.recons_aging);
    set('o2-recons-table', '<table class="w-full text-left font-sans text-xs"><thead><tr class="text-navy-500 border-b border-navy-100 text-[11px] font-semibold uppercase"><th class="pb-2">Account class</th><th class="pb-2 text-right">Items</th><th class="pb-2 text-right">&gt;30 days</th><th class="pb-2 text-right">&gt;180 days</th><th class="pb-2 text-right">Value</th><th class="pb-2 text-right">Value &gt;180</th><th class="pb-2 text-center">Risk</th></tr></thead><tbody class="divide-y divide-navy-100 tabular-nums text-[12px]">' +
      rows.map((r) => { const t = r.kind === 'total'; return '<tr class="' + (t ? 'font-bold bg-navy-50' : '') + '"><td class="py-2.5 pr-2 text-navy-900 font-medium">' + esc(r.account_class) + (r.owner ? '<div class="text-[11px] text-navy-500 font-normal">' + esc(r.owner) + '</div>' : '') + '</td><td class="text-right text-navy-900 font-bold">' + k(r.items_total) + '</td><td class="text-right text-brand-amber font-bold">' + k(r.items_over_30) + '</td><td class="text-right ' + (r.items_over_180 ? 'text-brand-rose' : 'text-brand-green') + ' font-bold">' + k(r.items_over_180) + '</td><td class="text-right">' + k(r.value_total) + '</td><td class="text-right text-brand-rose">' + k(r.value_over_180) + '</td><td class="text-center">' + chip(r.risk) + '</td></tr>'; }).join('') + '</tbody></table>');
    set('o2-close-list', D.close_calendar.map((r) => '<li class="flex justify-between items-center gap-3 p-2 bg-navy-50 rounded border border-navy-100"><span class="text-navy-900"><span class="font-semibold">' + esc(r.wd) + ' · ' + esc(date(r.due_date)) + ':</span> ' + esc(r.activity) + '<span class="block text-[11px] text-navy-500">' + esc(r.owner) + '</span></span>' + chip(r.status) + '</li>').join(''));
  }

  function reg() {
    set('o2-dab-table', table([['Regulatory return'], ['Frequency'], ['Period'], ['Due date', 'right'], ['Prepared by'], ['Signatory'], ['Status', 'center']],
      D.dab_returns.map((r) => '<tr>' + td(esc(r.return_name), 'font-semibold text-navy-900') + td(esc(r.frequency), 'text-navy-600') + td(esc(r.period), 'text-navy-600') + td(esc(date(r.due_date)), 'text-right font-bold text-navy-900 whitespace-nowrap') + td(esc(r.preparer), 'text-navy-800') + td(esc(r.signatory), 'text-navy-800') + td(chip(r.status), 'text-center') + '</tr>').join('')));
    set('o2-audit-table', table([['Ref'], ['Source'], ['Finding'], ['Rating', 'center'], ['Owner'], ['Due', 'right'], ['Status', 'center']],
      D.audit_points.map((r) => '<tr>' + td(esc(r.id), 'font-semibold text-navy-900') + td(esc(r.source), 'text-navy-600') + td(esc(r.finding), 'text-navy-900') + td(chip(r.rating), 'text-center') + td(esc(r.owner), 'text-navy-800') + td(esc(date(r.due_date)), 'text-right whitespace-nowrap') + td(chip(r.status), 'text-center') + '</tr>').join('')));
  }

  function savings() {
    const sp2 = D.savings_pipeline, tot = sp2.reduce((s, r) => s + r.annual_saving, 0);
    set('o2-savings-badge', 'Pipeline Total: ' + A.money(tot) + ' a year');
    set('o2-savings-table', table([['Ref'], ['Saving option'], ['Function'], ['Lever'], ["Annual saving ($'000)", 'right'], ["One-off cost ($'000)", 'right'], ['Stage', 'center'], ['Owner'], ['Decision by', 'right']],
      sp2.map((r) => '<tr>' + td(esc(r.id), 'text-navy-500') + td(esc(r.item), 'font-semibold text-navy-900') + td(esc(r.function), 'text-navy-600') + td(esc(r.lever), 'text-navy-600') + td(k(r.annual_saving), 'text-right text-brand-green font-bold') + td(r.one_off_cost ? k(r.one_off_cost) : '—', 'text-right text-navy-600') + td(chip(r.status), 'text-center') + td(esc(r.owner), 'text-navy-800') + td(esc(date(r.decision_date)), 'text-right whitespace-nowrap') + '</tr>').join('') +
      '<tr class="bg-navy-50 font-bold text-navy-900">' + td('') + td('TOTAL') + td('') + td('') + td(k(tot), 'text-right text-brand-green') + td(k(sp2.reduce((s, r) => s + r.one_off_cost, 0)), 'text-right') + td('') + td('') + td('') + '</tr>'));
  }

  function programme() {
    const hp = D.handover_pack, avg = Math.round(hp.reduce((s, r) => s + r.pct_ready, 0) / hp.length);
    set('o2-readiness', 'Readiness Score: ' + avg + '%');
    set('o2-handover', hp.map((r) => '<div><div class="flex justify-between gap-3 text-navy-900 font-semibold mb-1"><span>' + esc(r.item) + ' <span class="font-normal text-navy-500">· ' + esc(r.owner) + '</span></span><span class="' + (r.pct_ready >= 80 ? 'text-brand-green' : 'text-brand-blue') + ' whitespace-nowrap">' + r.pct_ready + '% Ready</span></div><div class="w-full bg-navy-100 h-2 rounded-full overflow-hidden"><div class="' + (r.pct_ready >= 80 ? 'bg-brand-green' : 'bg-brand-blue') + ' h-full" style="width:' + r.pct_ready + '%"></div></div><div class="text-[11px] text-navy-500 mt-1">' + esc(r.status) + ' · ' + esc(r.note) + '</div></div>').join(''));
    set('o2-risks-table', table([['Risk'], ['Rating', 'center'], ['Mitigation'], ['Owner']],
      D.risks.map((r) => '<tr>' + td(esc(r.risk), 'font-semibold text-navy-900') + td(chip(r.rating), 'text-center') + td(esc(r.mitigation), 'text-navy-700') + td(esc(r.owner), 'text-navy-600') + '</tr>').join('')));
  }

  /* ---------- forecast page ---------- */
  function landing() {
    const sc = S.scenario(), ye = A.yearEnd(D, sc), on = Object.keys(sc).some((x) => sc[x]), base = on ? A.yearEnd(D) : null;
    const card = (label, o, cost, b) => {
      const good = o.vs_budget_pct >= 0;
      return '<div class="bg-white border border-navy-200 rounded-xl p-5 card-shadow space-y-3"><div class="flex items-center justify-between gap-2 text-xs font-medium text-navy-500 uppercase tracking-wider"><span>' + esc(label) + '</span><span class="' + (good ? 'bg-brand-greenLight text-brand-green' : 'bg-brand-roseLight text-brand-rose') + ' font-bold px-2 py-0.5 rounded text-[11px] normal-case whitespace-nowrap">' + Math.abs(o.vs_budget_pct).toFixed(1) + '% ' + (cost ? (good ? 'below' : 'above') : (good ? 'above' : 'below')) + ' budget</span></div>' +
        '<div class="flex items-baseline space-x-2"><span class="text-3xl font-bold text-navy-900 tabular-nums">' + A.money(o.fy) + '</span><span class="text-xs text-navy-500">Budget: ' + A.money(o.budget) + '</span></div>' +
        '<div class="pt-2 border-t border-navy-100 text-xs text-navy-600 space-y-0.5"><div class="flex justify-between"><span>80% likely range</span><strong class="text-navy-900 tabular-nums">' + A.money(o.lo) + ' – ' + A.money(o.hi) + '</strong></div>' + (b ? '<div class="flex justify-between"><span>Before what-if</span><strong class="text-navy-900 tabular-nums">' + A.money(b.fy) + '</strong></div>' : '') + '</div></div>';
    };
    set('o2-landing', card('Net profit FY 2026', ye.net, false, base && base.net) + card('Total income FY 2026', ye.income, false, base && base.income) + card('Operating costs FY 2026', ye.opex, true, base && base.opex) +
      '<div class="bg-white border border-navy-200 rounded-xl p-5 card-shadow space-y-3"><div class="text-xs font-medium text-navy-500 uppercase tracking-wider">Net profit, Oct to Dec</div><div class="text-3xl font-bold text-navy-900 tabular-nums">' + A.money(ye.net.forecast) + '</div><div class="pt-2 border-t border-navy-100 text-xs text-navy-600 space-y-0.5"><div class="flex justify-between"><span>Jan to Sep actual</span><strong class="text-navy-900 tabular-nums">' + A.money(ye.net.ytd) + '</strong></div><div class="flex justify-between"><span>By month</span><strong class="text-navy-900 tabular-nums">' + ye.net.months.map((m) => A.money(m.mean)).join(' · ') + '</strong></div></div></div>');
  }

  function whatif() {
    const el = $('o2-whatif'); if (!el) return;
    const sc = S.scenario();
    if (!el.__built) {
      el.__built = true;
      el.innerHTML = A.SCENARIO_KEYS.map((x, i) => '<label class="grid grid-cols-[minmax(8rem,1fr)_minmax(7rem,2fr)_3rem] items-center gap-3 text-xs text-navy-800"><span class="font-semibold">' + esc(x.label) + '</span><input type="range" min="-20" max="20" step="1" data-o2-w="' + i + '" class="w-full accent-brand-blue"><output class="text-right font-bold tabular-nums" data-o2-wv="' + i + '"></output></label>').join('') +
        '<button type="button" data-o2-wreset class="self-start mt-1 bg-navy-50 hover:bg-navy-100 border border-navy-200 rounded-md px-3 py-1.5 text-xs font-semibold text-navy-800">Reset</button>';
      el.addEventListener('input', (e) => {
        const t = e.target.closest('[data-o2-w]'); if (!t) return;
        const v = [...el.querySelectorAll('[data-o2-w]')].map((x) => x.value);
        el.querySelector('[data-o2-wv="' + t.dataset.o2W + '"]').textContent = A.signed(+t.value, 0) + '%';
        S.set({ w: v.join(',') });
      });
      el.addEventListener('click', (e) => { if (e.target.closest('[data-o2-wreset]')) S.set({ w: '0,0,0,0' }); });
    }
    A.SCENARIO_KEYS.forEach((x, i) => { el.querySelector('[data-o2-w="' + i + '"]').value = sc[x.id]; el.querySelector('[data-o2-wv="' + i + '"]').textContent = A.signed(sc[x.id], 0) + '%'; });
  }

  function forecastPage() {
    landing();
    whatif();
    const m = S.get('fm'), bt = A.backtest(D.pnl_monthly, m, 3);
    set('o2-fc-title', esc(A.measureById(m).label) + ': Actual &amp; Forecast');
    toolbar('o2-tools-forecast', 'forecast', { measure: 'fm' });
    set('o2-backtest-note', 'Forecasting ' + esc(monthName(bt.rows[0].month)) + ' to ' + esc(monthName(bt.rows[bt.rows.length - 1].month)) + ' from the six months before missed the actual ' + esc(A.measureById(m).label.toLowerCase()) + ' by <strong class="text-navy-900">' + bt.mape.toFixed(1) + '%</strong> on average; ' + bt.inside + ' of ' + bt.rows.length + ' months fell inside the 80% range.');
    set('o2-backtest', table([['Month'], ['Actual', 'right'], ['Forecast', 'right'], ['Error', 'right'], ['Inside range', 'center']],
      bt.rows.map((r) => '<tr>' + td(esc(AIBCharts.monthLabel(r.month)), 'font-semibold text-navy-900') + td(kt(r.actual), 'text-right') + td(kt(r.forecast), 'text-right text-navy-600') + td(sp(r.error_pct), 'text-right font-semibold') + td(chip(r.inside ? 'Yes' : 'No'), 'text-center') + '</tr>').join('')));
    const LABEL = { breach: 'Breach', watch: 'Watch', ok: 'On track' };
    set('o2-outlook', table([['Ratio'], ['Latest', 'right'], ['Limit', 'right'], ['Dec 2026 forecast', 'right'], ['Outlook', 'center'], ['Reading']],
      A.ratioOutlook(D.ratios_monthly).map((r) => { const d = r.metric === 'Net interest margin' ? 2 : 1; return '<tr>' + td(esc(r.metric), 'font-semibold text-navy-900') + td(r.latest.toFixed(d) + '%', 'text-right font-bold') + td((r.kind === 'min' ? 'Min ' : 'Max ') + r.limit.toFixed(d) + '%', 'text-right text-navy-600') + td(r.dec == null ? '—' : r.dec.toFixed(d) + '%', 'text-right') + td(chip(LABEL[r.status]), 'text-center') + td(esc(r.text), 'text-navy-600') + '</tr>'; }).join('')));
  }

  /* ---------- AI analytics preview (sample answers from analytics.js; no AI service) ---------- */
  function ai() {
    const el = $('o2-ai'); if (!el || el.__built) return;
    el.__built = true;
    const chips = (qs) => qs.map((q) => '<button type="button" data-o2-ask="' + esc(q) + '" class="px-3 py-1.5 rounded-full border border-navy-200 bg-navy-50 hover:border-brand-blue hover:text-brand-blue text-xs font-medium text-navy-700 transition-colors">' + esc(q) + '</button>').join('');
    el.innerHTML = '<form data-o2-askform class="flex gap-2"><input type="text" maxlength="200" aria-label="Question" placeholder="Ask about profit, costs, income, ratios, forecasts or savings" class="flex-1 min-w-0 bg-white border border-navy-300 text-sm text-navy-900 px-3 py-2 rounded-lg outline-none focus:border-brand-blue shadow-sm"><button type="submit" class="bg-brand-blue hover:bg-brand-blueHover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm">Ask</button></form>' +
      '<div class="flex flex-wrap gap-2 my-3">' + chips(A.SUGGESTIONS) + '</div><div data-o2-answers class="space-y-3" aria-live="polite"></div>';
    const out = el.querySelector('[data-o2-answers]'), input = el.querySelector('input');
    const ask = (q) => {
      q = q.trim(); if (!q) return;
      const a = A.askPreview(q, D, period());
      const card = document.createElement('div');
      card.className = 'bg-navy-50 border border-navy-200 border-l-4 border-l-brand-blue rounded-lg p-4 text-xs text-navy-700';
      card.innerHTML = '<p class="text-navy-500 mb-1"><strong>Q:</strong> ' + esc(q) + '</p><h4 class="text-sm font-semibold text-navy-900 mb-1.5 flex items-center gap-2 flex-wrap">' + esc(a.title) + '<span class="bg-brand-amberLight text-brand-amber border border-brand-amber/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Sample answer</span></h4><ul class="list-disc pl-4 space-y-0.5 leading-relaxed">' + a.lines.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul>' +
        (a.suggestions ? '<div class="flex flex-wrap gap-2 mt-2">' + chips(a.suggestions) + '</div>' : '') + '<p class="text-[11px] text-navy-500 mt-2">' + esc(a.source) + ' · Preview answer written from the dashboard data, not by an AI service</p>';
      out.prepend(card);
      input.value = '';
    };
    el.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-o2-ask]'); if (b) ask(b.dataset.o2Ask); });
  }

  /* ---------- render, tabs and events ---------- */
  function renderAll() {
    headerControls();
    overview(); pnl(); balance(); budget(); close(); reg(); savings(); programme(); forecastPage(); ai();
    drawCharts();
  }

  window.switchTab = function (tabId, fromState) {
    if (!$('page-' + tabId)) return;
    document.querySelectorAll('.page-content').forEach((el) => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.remove('text-brand-blue', 'border-brand-blue', 'font-semibold', 'active');
      btn.classList.add('text-navy-500', 'border-transparent', 'font-medium');
      btn.removeAttribute('aria-current');
    });
    $('page-' + tabId).classList.remove('hidden');
    const b = $('tab-btn-' + tabId);
    if (b) { b.classList.remove('text-navy-500', 'border-transparent', 'font-medium'); b.classList.add('text-brand-blue', 'border-brand-blue', 'font-semibold', 'active'); b.setAttribute('aria-current', 'page'); }
    if (!fromState) S.set({ tab: tabId });
    drawCharts();
  };

  window.filterTable = function (tableId, query) {
    const t = $(tableId); if (!t) return;
    query = query.toLowerCase();
    t.querySelectorAll('tbody tr').forEach((row) => { row.style.display = row.innerText.toLowerCase().includes(query) ? '' : 'none'; });
  };

  document.addEventListener('change', (e) => {
    const t = e.target.closest('[data-o2-set]'); if (!t) return;
    S.set({ [t.dataset.o2Set]: t.type === 'checkbox' ? (t.checked ? '1' : '0') : t.value });
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-o2-type]'); if (b) S.set({ ['t-' + b.dataset.o2Type]: b.dataset.v });
    const l = e.target.closest('[data-o2-tab]'); if (l) { e.preventDefault(); window.switchTab(l.dataset.o2Tab); window.scrollTo(0, 0); }
  });

  S.on((keys) => {
    if (keys.length === 1 && keys[0] === 'w') { landing(); drawCharts(); return; }
    if (keys.indexOf('*') >= 0 || keys.indexOf('tab') >= 0) window.switchTab(S.get('tab'), true);
    if (keys.some((x) => x !== 'tab')) renderAll();
  });

  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawCharts, 120); });
  window.switchTab($('page-' + S.get('tab')) ? S.get('tab') : 'overview', true);
  renderAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawCharts);
})();
