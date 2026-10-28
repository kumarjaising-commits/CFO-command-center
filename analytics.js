/*
 * Shared calculations for both designs (index.html and option-2.html), so every number,
 * forecast and sentence is the same whichever design is showing.
 * Pure functions over window.AIB_DATA; no DOM. Also loads in Node for the tests in tests/.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AIBA = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const INCOME = ['Net interest income', 'Fee and commission income', 'FX and trading income', 'Other income'];
  const OPEX = ['Staff costs', 'Technology and IT', 'Premises and administration', 'Other operating costs'];
  const IMP = 'Credit impairment';
  const TAX = 'Tax';
  const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const Z80 = 1.2816; // two-sided 80% interval

  /* ---------- formats ---------- */
  const fmtInt = (v) => Math.round(v).toLocaleString('en-US');
  const money = (k) => {
    const n = k * 1000, a = Math.abs(n), s = n < 0 ? '−' : '';
    if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(2) + 'bn';
    if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(1) + 'm';
    if (a >= 1e3) return s + '$' + (a / 1e3).toFixed(0) + 'k';
    return s + '$' + a.toFixed(0);
  };
  // No sign when the value rounds to zero, so a tiny negative never shows as "−0.0"
  const signed = (v, d) => { const a = Math.abs(v).toFixed(d); return (+a === 0 ? '' : v > 0 ? '+' : '−') + a; };
  const pct = (v, d) => (v == null || isNaN(v) ? '—' : v.toFixed(d == null ? 1 : d) + '%');

  /* ---------- status colours (chips in both designs) ---------- */
  const TONE = {
    ok: ['Closed', 'Complete', 'Submitted', 'Approved', 'Realised', 'Effective', 'On track', 'Done', 'Low'],
    warn: ['In review', 'In progress', 'Drafting', 'Validated', 'Due today', 'Identified', 'Medium', 'Open', 'In preparation', 'Watch'],
    bad: ['Overdue', 'High', 'Late', 'Breach', 'Deficient']
  };
  const toneOf = (s) => (TONE.ok.includes(s) ? 'ok' : TONE.warn.includes(s) ? 'warn' : TONE.bad.includes(s) ? 'bad' : '');

  /* ---------- months and periods ---------- */
  const ym = (m) => m.slice(0, 7);
  const mIdx = (m) => +m.slice(5, 7) - 1;
  const yr = (m) => +m.slice(0, 4);
  const monthKey = (y, i) => y + '-' + String(i + 1).padStart(2, '0') + '-01';
  const monthsOf = (rows) => [...new Set(rows.map((r) => r.month))].sort();
  const monthLong = (m) => LONG[mIdx(m)] + ' ' + yr(m);
  const monthShort = (m) => SHORT[mIdx(m)] + ' ' + yr(m);

  const PERIOD_MODES = [
    { id: 'm', label: 'Month' },
    { id: 'q', label: 'Quarter to date' },
    { id: 'y', label: 'Year to date' },
    { id: 'r', label: 'Custom range' }
  ];

  // p = { mode: 'm' | 'q' | 'y' | 'r', end: 'YYYY-MM', start: 'YYYY-MM' }; unknown values fall back to year to date at the latest month.
  function resolvePeriod(p, all) {
    p = p || {};
    const keys = all.map(ym);
    const mode = PERIOD_MODES.some((x) => x.id === p.mode) ? p.mode : 'y';
    let endKey = keys.indexOf(p.end) >= 0 ? p.end : keys[keys.length - 1];
    let startKey = keys.indexOf(p.start) >= 0 ? p.start : keys[0];
    if (mode === 'r' && startKey > endKey) { const t = startKey; startKey = endKey; endKey = t; }
    const e = all[keys.indexOf(endKey)];
    let months;
    if (mode === 'm') months = [e];
    else if (mode === 'q') { const q0 = Math.floor(mIdx(e) / 3) * 3; months = all.filter((m) => yr(m) === yr(e) && mIdx(m) >= q0 && m <= e); }
    else if (mode === 'y') months = all.filter((m) => yr(m) === yr(e) && m <= e);
    else months = all.filter((m) => ym(m) >= startKey && ym(m) <= endKey);
    const s = months[0];
    const q = 'Q' + (Math.floor(mIdx(e) / 3) + 1);
    const single = months.length === 1;
    let label, short, phrase, tile, priorLabel;
    if (mode === 'm' || (mode === 'r' && single)) {
      label = monthLong(e); short = monthShort(e); phrase = 'In ' + LONG[mIdx(e)]; tile = LONG[mIdx(e)]; priorLabel = 'vs ' + SHORT[mIdx(e)] + ' ' + (yr(e) - 1);
    } else if (mode === 'q') {
      label = q + ' ' + yr(e) + ' to date (' + LONG[mIdx(s)] + ' to ' + LONG[mIdx(e)] + ')'; short = q + ' ' + yr(e) + ' to date';
      phrase = q + ' to date'; tile = q + ' to date'; priorLabel = 'vs ' + q + ' ' + (yr(e) - 1) + ' to date';
    } else if (mode === 'y') {
      label = 'Year to date to ' + monthLong(e); short = 'YTD ' + monthShort(e); phrase = 'Year to date to ' + LONG[mIdx(e)];
      tile = 'year to date'; priorLabel = 'vs ' + SHORT[mIdx(e)] + ' ' + (yr(e) - 1);
    } else {
      label = LONG[mIdx(s)] + ' to ' + monthLong(e); short = SHORT[mIdx(s)] + '–' + monthShort(e);
      phrase = 'From ' + LONG[mIdx(s)] + ' to ' + LONG[mIdx(e)]; tile = SHORT[mIdx(s)] + ' to ' + SHORT[mIdx(e)];
      priorLabel = 'vs ' + SHORT[mIdx(s)] + '–' + SHORT[mIdx(e)] + ' ' + (yr(e) - 1);
    }
    return { mode, end: endKey, start: ym(s), months, endMonth: e, isLatest: e === all[all.length - 1], label, short, phrase, tile, priorLabel };
  }

  /* ---------- P&L ---------- */
  // Same rows as the original year-to-date table, for any set of months. `latest` is the last month's actual.
  function pnlSummary(pnl, months) {
    const set = new Set(months), last = months[months.length - 1];
    const agg = {};
    pnl.forEach((r) => {
      if (!set.has(r.month)) return;
      const o = agg[r.line] || (agg[r.line] = { grp: r.grp, a: 0, b: 0, p: 0, l: 0 });
      o.a += r.actual; o.b += r.budget; o.p += r.prior;
      if (r.month === last) o.l += r.actual;
    });
    const row = (line, kind, grp, a, b, p, l) => {
      const v = grp === 'income' ? a - b : b - a;
      return { line, kind, grp, latest: l, actual: a, budget: b, variance: v, variance_pct: b ? (v / b) * 100 : null, prior: p, yoy_pct: p ? (a / p - 1) * 100 : null };
    };
    const R = (n) => row(n, 'line', agg[n].grp, agg[n].a, agg[n].b, agg[n].p, agg[n].l);
    const S = (names) => ['a', 'b', 'p', 'l'].map((k) => names.reduce((s, n) => s + agg[n][k], 0));
    const ti = S(INCOME), to = S(OPEX);
    const imp = agg[IMP], tax = agg[TAX];
    const pbt = [ti[0] - to[0] - imp.a, ti[1] - to[1] - imp.b, ti[2] - to[2] - imp.p, ti[3] - to[3] - imp.l];
    const net = [pbt[0] - tax.a, pbt[1] - tax.b, pbt[2] - tax.p, pbt[3] - tax.l];
    return [
      ...INCOME.map(R),
      row('Total income', 'total', 'income', ti[0], ti[1], ti[2], ti[3]),
      ...OPEX.map(R),
      row('Total operating costs', 'total', 'expense', to[0], to[1], to[2], to[3]),
      R(IMP),
      row('Profit before tax', 'total', 'income', pbt[0], pbt[1], pbt[2], pbt[3]),
      R(TAX),
      row('Net profit', 'total', 'income', net[0], net[1], net[2], net[3])
    ];
  }

  // Monthly totals used by the income and costs chart.
  function monthlyTotals(pnl) {
    const m = {};
    pnl.forEach((r) => {
      const o = m[r.month] || (m[r.month] = { month: r.month, income: 0, opex: 0, income_b: 0, opex_b: 0, income_p: 0, opex_p: 0, net: 0, net_b: 0, net_p: 0 });
      const s = r.grp === 'income' ? 1 : -1;
      if (r.grp === 'income') { o.income += r.actual; o.income_b += r.budget; o.income_p += r.prior; }
      if (OPEX.indexOf(r.line) >= 0) { o.opex += r.actual; o.opex_b += r.budget; o.opex_p += r.prior; }
      o.net += s * r.actual; o.net_b += s * r.budget; o.net_p += s * r.prior;
    });
    return Object.values(m).sort((a, b) => (a.month < b.month ? -1 : 1));
  }

  /* ---------- tables shared by both designs ---------- */
  // KPI tiles hold the latest close. Net profit follows the period; a ratio with a monthly series shows the
  // period's last month; a tile without a series (return on equity) stays at the latest close.
  function kpiForPeriod(D, r, p) {
    if (r.id === 'net_profit_ytd') {
      const net = pnlSummary(D.pnl_monthly, p.months).find((x) => x.line === 'Net profit');
      return { ...r, label: 'Net profit, ' + p.tile, value: net.actual, prior: net.prior, target: net.budget, prior_label: p.priorLabel };
    }
    if (p.isLatest) return r;
    const rows = D.ratios_monthly.filter((x) => x.metric === r.series).sort((a, b) => (a.month < b.month ? -1 : 1));
    if (!rows.length) return { ...r, label: r.label + ' (' + SHORT[mIdx(monthsOf(D.pnl_monthly).slice(-1)[0])] + ' close)' };
    const i = rows.findIndex((x) => x.month === p.endMonth);
    return { ...r, value: rows[i].value, prior: i > 0 ? rows[i - 1].value : null, prior_label: i > 0 ? 'vs ' + SHORT[mIdx(rows[i - 1].month)] : '' };
  }

  const bsView = (bs) => bs.map((r) => ({
    line: r.line, kind: r.kind, sep26: r.sep26, aug26: r.aug26, dec25: r.dec25,
    chg_month: r.aug26 ? (r.sep26 / r.aug26 - 1) * 100 : null,
    chg_ytd: r.dec25 ? (r.sep26 / r.dec25 - 1) * 100 : null
  }));

  function budgetView(budget2027) {
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

  function reconsView(recons) {
    const rows = recons.map((r) => ({
      account_class: r.account_class, kind: 'line', owner: r.owner,
      items_total: r.items_0_30 + r.items_31_90 + r.items_91_180 + r.items_180_plus,
      items_over_30: r.items_31_90 + r.items_91_180 + r.items_180_plus,
      items_over_180: r.items_180_plus,
      value_total: r.value_0_30 + r.value_31_90 + r.value_91_180 + r.value_180_plus,
      value_over_180: r.value_180_plus, risk: r.risk
    }));
    const t = (k) => rows.reduce((s, r) => s + r[k], 0);
    rows.push({ account_class: 'Total', kind: 'total', owner: '', items_total: t('items_total'), items_over_30: t('items_over_30'), items_over_180: t('items_over_180'), value_total: t('value_total'), value_over_180: t('value_over_180'), risk: '' });
    return rows;
  }

  /* ---------- measures (what a trend chart can show) ---------- */
  const w = (lines, c) => Object.fromEntries(lines.map((l) => [l, c]));
  const ALL_EXP = [...OPEX, IMP, TAX];
  const MEASURES = [
    { id: 'net', label: 'Net profit', weights: { ...w(INCOME, 1), ...w(ALL_EXP, -1) } },
    { id: 'pbt', label: 'Profit before tax', weights: { ...w(INCOME, 1), ...w([...OPEX, IMP], -1) } },
    { id: 'income', label: 'Total income', weights: w(INCOME, 1) },
    { id: 'opex', label: 'Total operating costs', weights: w(OPEX, 1), cost: true },
    { id: 'nii', label: 'Net interest income', weights: w([INCOME[0]], 1) },
    { id: 'fee', label: 'Fee and commission income', weights: w([INCOME[1]], 1) },
    { id: 'fx', label: 'FX and trading income', weights: w([INCOME[2]], 1) },
    { id: 'othinc', label: 'Other income', weights: w([INCOME[3]], 1) },
    { id: 'staff', label: 'Staff costs', weights: w([OPEX[0]], 1), cost: true },
    { id: 'tech', label: 'Technology and IT', weights: w([OPEX[1]], 1), cost: true },
    { id: 'prem', label: 'Premises and administration', weights: w([OPEX[2]], 1), cost: true },
    { id: 'othcost', label: 'Other operating costs', weights: w([OPEX[3]], 1), cost: true },
    { id: 'imp', label: 'Credit impairment', weights: w([IMP], 1), cost: true },
    { id: 'tax', label: 'Tax', weights: w([TAX], 1), cost: true }
  ];
  const measureById = (id) => MEASURES.find((x) => x.id === id) || MEASURES[0];

  function measureSeries(pnl, id) {
    const W = measureById(id).weights;
    const m = {};
    pnl.forEach((r) => {
      const c = W[r.line];
      if (!c) return;
      const o = m[r.month] || (m[r.month] = { month: r.month, actual: 0, budget: 0, prior: 0 });
      o.actual += c * r.actual; o.budget += c * r.budget; o.prior += c * r.prior;
    });
    return Object.values(m).sort((a, b) => (a.month < b.month ? -1 : 1));
  }

  /* ---------- forecasting: Holt's linear trend (exponential smoothing) ---------- */
  function holtRun(y, alpha, beta, phi) {
    const n0 = Math.min(3, y.length - 1);
    let l = y[0], b = n0 > 0 ? (y[n0] - y[0]) / n0 : 0;
    let sse = 0; const errs = [];
    for (let t = 1; t < y.length; t++) {
      const f = l + phi * b, e = y[t] - f;
      errs.push(e); sse += e * e;
      const lp = l;
      l = alpha * y[t] + (1 - alpha) * (lp + phi * b);
      b = beta * (l - lp) + (1 - beta) * phi * b;
    }
    return { l, b, sse, errs };
  }

  // Picks the smoothing weights with the smallest one-step-ahead error. phi < 1 damps the trend.
  function holtFit(y, phi) {
    phi = phi == null ? 1 : phi;
    let best = null;
    for (let a = 0.1; a <= 0.901; a += 0.05) {
      for (let bb = 0.05; bb <= 0.501; bb += 0.05) {
        const r = holtRun(y, a, bb, phi);
        if (!best || r.sse < best.sse - 1e-9) best = { ...r, alpha: a, beta: bb, phi };
      }
    }
    const df = Math.max(1, best.errs.length - 2);
    best.sigma = Math.sqrt(best.sse / df);
    return best;
  }

  // h steps ahead with an 80% interval: var_k = sigma^2 * (1 + sum_{j<k} (alpha * (1 + beta * sum_{i<=j} phi^i))^2)
  function holtForecast(y, h, phi) {
    const f = holtFit(y, phi);
    const out = [];
    let damp = 0, v = 0;
    for (let k = 1; k <= h; k++) {
      damp += Math.pow(f.phi, k);
      if (k > 1) {
        let s = 0; for (let i = 1; i <= k - 1; i++) s += Math.pow(f.phi, i);
        const c = f.alpha * (1 + f.beta * s); v += c * c;
      }
      const mean = f.l + damp * f.b, sd = f.sigma * Math.sqrt(1 + v);
      out.push({ mean, sd, lo: mean - Z80 * sd, hi: mean + Z80 * sd });
    }
    return out;
  }

  function remainingMonths(all) {
    const last = all[all.length - 1], out = [];
    for (let i = mIdx(last) + 1; i < 12; i++) out.push(monthKey(yr(last), i));
    return out;
  }
  function nextMonths(last, h) {
    const out = []; let y = yr(last), i = mIdx(last);
    for (let k = 0; k < h; k++) { i += 1; if (i > 11) { i = 0; y += 1; } out.push(monthKey(y, i)); }
    return out;
  }

  const SCENARIO_KEYS = [
    { id: 'nii', label: 'Net interest income', lines: [INCOME[0]] },
    { id: 'fee', label: 'Fee and commission income', lines: [INCOME[1]] },
    { id: 'opex', label: 'Operating costs', lines: OPEX },
    { id: 'imp', label: 'Credit impairment', lines: [IMP] }
  ];
  const factorFor = (line, sc) => {
    let f = 1;
    SCENARIO_KEYS.forEach((k) => { if (sc && sc[k.id] && k.lines.indexOf(line) >= 0) f *= 1 + sc[k.id] / 100; });
    return f;
  };

  // Forecast of any measure for the rest of the year (or h months): each P&L line is forecast on its own,
  // scenario changes are applied per line, and tax follows the year-to-date effective rate.
  // The 80% range comes from a forecast of the measure's own monthly totals.
  function measureForecast(pnl, id, opts) {
    opts = opts || {};
    const all = monthsOf(pnl);
    const months = opts.h ? nextMonths(all[all.length - 1], opts.h) : remainingMonths(all);
    const h = months.length;
    if (!h) return [];
    const lineMeans = {};
    [...INCOME, ...OPEX, IMP].forEach((line) => {
      const y = pnl.filter((r) => r.line === line).sort((a, b) => (a.month < b.month ? -1 : 1)).map((r) => r.actual);
      const f = factorFor(line, opts.scenario);
      lineMeans[line] = holtForecast(y, h).map((p) => p.mean * f);
    });
    let pbtY = 0, taxY = 0;
    pnl.forEach((r) => { if (r.line === TAX) taxY += r.actual; else pbtY += (r.grp === 'income' ? 1 : -1) * r.actual; });
    const rate = pbtY > 0 ? taxY / pbtY : 0;
    const W = measureById(id).weights;
    const own = holtForecast(measureSeries(pnl, id).map((r) => r.actual), h);
    return months.map((month, k) => {
      const pbt = INCOME.reduce((s, l) => s + lineMeans[l][k], 0) - [...OPEX, IMP].reduce((s, l) => s + lineMeans[l][k], 0);
      const tax = Math.max(0, pbt) * rate;
      let mean = 0;
      Object.keys(W).forEach((line) => { mean += W[line] * (line === TAX ? tax : lineMeans[line][k]); });
      const half = Z80 * own[k].sd;
      return { month, mean, lo: mean - half, hi: mean + half, sd: own[k].sd };
    });
  }

  // Full-year landing: actuals to date plus the forecast, against the full-year budget.
  function yearEnd(D, scenario) {
    const pnl = D.pnl_monthly, rest = D.pnl_budget_rest || [];
    const sumBy = (rows, W, k) => rows.reduce((s, r) => s + (W[r.line] || 0) * r[k], 0);
    const out = {};
    ['net', 'income', 'opex'].forEach((id) => {
      const W = measureById(id).weights;
      const fc = measureForecast(pnl, id, { scenario });
      const ytd = sumBy(pnl, W, 'actual');
      const fcSum = fc.reduce((s, p) => s + p.mean, 0);
      const sdSum = fc.reduce((s, p) => s + p.sd, 0); // months move together, so widths add up
      const budget = sumBy(pnl, W, 'budget') + sumBy(rest, W, 'budget');
      const fy = ytd + fcSum;
      out[id] = { ytd, forecast: fcSum, fy, lo: fy - Z80 * sdSum, hi: fy + Z80 * sdSum, budget, vs_budget_pct: budget ? ((id === 'opex' ? budget - fy : fy - budget) / Math.abs(budget)) * 100 : null, months: fc };
    });
    out.restMonths = remainingMonths(monthsOf(pnl));
    return out;
  }

  // Hides the last `hold` months, forecasts them from the earlier months and compares with what happened.
  function backtest(pnl, id, hold) {
    hold = hold || 3;
    const s = measureSeries(pnl, id);
    const train = s.slice(0, s.length - hold).map((r) => r.actual);
    const fc = holtForecast(train, hold);
    const rows = s.slice(s.length - hold).map((r, i) => ({
      month: r.month, actual: r.actual, forecast: fc[i].mean, lo: fc[i].lo, hi: fc[i].hi,
      error_pct: r.actual ? ((fc[i].mean - r.actual) / Math.abs(r.actual)) * 100 : null,
      inside: r.actual >= fc[i].lo && r.actual <= fc[i].hi
    }));
    const mape = rows.reduce((t, r) => t + Math.abs(r.error_pct), 0) / rows.length;
    return { rows, mape, inside: rows.filter((r) => r.inside).length };
  }

  // Regulatory ratios: damped-trend forecast for 12 months and the first month the limit would be crossed.
  function ratioOutlook(ratios, horizon) {
    horizon = horizon || 12;
    const by = {};
    ratios.forEach((r) => { (by[r.metric] = by[r.metric] || []).push(r); });
    return Object.keys(by).map((metric) => {
      const rows = by[metric].slice().sort((a, b) => (a.month < b.month ? -1 : 1));
      const last = rows[rows.length - 1];
      const lim = last.limit, kind = last.limit_kind;
      const out = (v) => (kind === 'min' ? v < lim : kind === 'max' ? v > lim : false);
      const fc = holtForecast(rows.map((r) => r.value), horizon, 0.9);
      const months = nextMonths(last.month, horizon);
      const firstOut = fc.findIndex((p) => out(p.mean));
      const firstIn = fc.findIndex((p) => !out(p.mean));
      const now = out(last.value);
      const dec = months.indexOf(monthKey(yr(last.month), 11));
      const kindWord = kind === 'min' ? 'minimum' : 'maximum';
      let status, text;
      if (now && firstIn >= 0) { status = 'breach'; text = 'Outside the ' + kindWord + ' now; the trend brings it back inside by ' + monthShort(months[firstIn]) + '.'; }
      else if (now) { status = 'breach'; text = 'Outside the ' + kindWord + ' now, and the trend does not bring it back inside within ' + horizon + ' months.'; }
      else if (firstOut >= 0) { status = 'watch'; text = 'Inside the ' + kindWord + ' now; on the current trend it crosses in ' + monthShort(months[firstOut]) + ' (' + (firstOut + 1) + (firstOut ? ' months' : ' month') + ').'; }
      else { status = 'ok'; text = 'Inside the ' + kindWord + ', with no crossing expected in the next ' + horizon + ' months.'; }
      return {
        metric, latest: last.value, month: last.month, limit: lim, kind,
        dec: dec >= 0 ? fc[dec].mean : null, m12: fc[horizon - 1].mean, months_to_breach: !now && firstOut >= 0 ? firstOut + 1 : null,
        status, text, series: rows.map((r) => ({ month: r.month, value: r.value })), forecast: fc.map((p, i) => ({ month: months[i], ...p }))
      };
    });
  }

  /* ---------- written commentary ---------- */
  const NICE = {
    'Net interest income': 'net interest income', 'Fee and commission income': 'fee income', 'FX and trading income': 'FX and trading income',
    'Other income': 'other income', 'Staff costs': 'staff costs', 'Technology and IT': 'technology costs',
    'Premises and administration': 'premises and administration costs', 'Other operating costs': 'other operating costs',
    'Credit impairment': 'credit impairment', 'Tax': 'tax'
  };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const andList = (a) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  const dirWord = (v) => (v >= 0 ? 'above' : 'below');

  function ratioAt(ratios, metric, month) {
    const r = ratios.find((x) => x.metric === metric && x.month === month);
    return r || null;
  }

  function narrative(D, period) {
    const rows = pnlSummary(D.pnl_monthly, period.months);
    const get = (n) => rows.find((r) => r.line === n);
    const net = get('Net profit'), inc = get('Total income'), opx = get('Total operating costs');
    const lines = rows.filter((r) => r.kind === 'line' && r.line !== TAX);
    const adverse = lines.filter((r) => r.variance < 0).sort((a, b) => a.variance - b.variance);
    const costsOver = adverse.filter((r) => r.grp === 'expense').slice(0, 2).map((r) => NICE[r.line]);
    const opexOver = adverse.filter((r) => OPEX.indexOf(r.line) >= 0).slice(0, 2).map((r) => NICE[r.line]);
    const incomeUnder = adverse.filter((r) => r.grp === 'income').slice(0, 1).map((r) => NICE[r.line]);
    const favourable = lines.filter((r) => r.variance > 0).sort((a, b) => b.variance - a.variance);
    const pre = D.gates.filter((g) => g.category === 'Pre-commencement');
    const open = pre.filter((g) => g.status !== 'Closed').length;
    const varPct = net.variance_pct;

    const headline = period.phrase + ', net profit is ' + money(net.actual) + ', ' + Math.abs(varPct).toFixed(1) + '% ' + dirWord(varPct) + ' budget.';
    const gatesLine = open + ' of ' + pre.length + ' commencement decisions are still open ahead of the 10 November start.';

    let pnlNote;
    const parts = [];
    if (costsOver.length) parts.push(cap(andList(costsOver)) + ' run' + (costsOver.length === 1 && !/s$/.test(costsOver[0]) ? 's' : '') + ' above budget');
    if (incomeUnder.length) parts.push((parts.length ? 'while ' : cap('')) + incomeUnder[0] + ' runs below');
    if (!parts.length) pnlNote = 'Every line is at or better than budget for this period.';
    else {
      const s = parts.join(' ');
      pnlNote = cap(s) + (net.variance < 0 ? ', which is where the profit gap comes from.' : ', but ' + (favourable[0] ? NICE[favourable[0].line] : 'other lines') + ' keeps net profit above budget.');
    }

    const car = ratioAt(D.ratios_monthly, 'Capital adequacy', period.endMonth);
    const lcr = ratioAt(D.ratios_monthly, 'Liquidity coverage', period.endMonth);
    const npl = ratioAt(D.ratios_monthly, 'NPL ratio', period.endMonth);
    const nii = get('Net interest income'), fee = get('Fee and commission income');
    const worstCost = adverse.find((r) => r.grp === 'expense');
    const outside = D.ratios_monthly.filter((r) => r.month === period.endMonth && ((r.limit_kind === 'min' && r.value < r.limit) || (r.limit_kind === 'max' && r.value > r.limit))).map((r) => r.metric);

    const callouts = [
      { tone: inc.variance >= 0 ? 'ok' : 'warn', title: 'Income against budget', text: 'Total income is ' + money(inc.actual) + ', ' + signed(inc.variance_pct, 1) + '% against budget; net interest income ' + signed(nii.variance_pct, 1) + '% and fee income ' + signed(fee.variance_pct, 1) + '%.' },
      worstCost
        ? { tone: 'bad', title: cap(NICE[worstCost.line]) + ' over budget', text: cap(NICE[worstCost.line]) + ' ' + (/s$/.test(NICE[worstCost.line]) ? 'are ' : 'is ') + money(-worstCost.variance) + ' (' + Math.abs(worstCost.variance_pct).toFixed(1) + '%) above budget, the largest adverse line.' }
        : { tone: 'ok', title: 'Costs within budget', text: 'Every cost line is at or below budget for this period.' },
      car
        ? { tone: car.value >= car.limit ? 'ok' : 'bad', title: 'Capital adequacy', text: 'Capital adequacy is ' + pct(car.value) + ' at ' + monthShort(period.endMonth) + ' against a sample minimum of ' + pct(car.limit) + ', ' + Math.round((car.value - car.limit) * 100) + ' bps of headroom.' }
        : null
    ].filter(Boolean);

    const commentary = [
      { title: 'Income', text: 'Total income of ' + money(inc.actual) + ' is ' + money(Math.abs(inc.variance)) + ' ' + dirWord(inc.variance) + ' budget and ' + signed(inc.yoy_pct, 1) + '% on the same period of 2025. ' + (favourable.length ? cap(NICE[favourable[0].line]) + ' is the strongest line against budget (' + signed(favourable[0].variance_pct, 1) + '%).' : '') },
      { title: 'Costs', text: 'Operating costs of ' + money(opx.actual) + ' are ' + money(Math.abs(opx.variance)) + ' ' + (opx.variance < 0 ? 'above' : 'below') + ' budget. ' + (opexOver.length ? cap(andList(opexOver)) + ' ' + (opx.variance < 0 ? 'drive the overrun.' : 'are the lines over budget.') : 'No operating cost line is over budget.') },
      { title: 'Capital, liquidity and asset quality', text: (car && lcr ? 'Capital adequacy is ' + pct(car.value) + ' and liquidity coverage ' + pct(lcr.value, 0) + '. ' : '') + (npl ? 'The NPL ratio is ' + pct(npl.value) + ' against a sample maximum of ' + pct(npl.limit) + '. ' : '') + (outside.length ? andList(outside) + (outside.length === 1 ? ' is outside its sample limit.' : ' are outside their sample limits.') : 'All six ratios are inside their sample limits.') }
    ];

    return { headline, gatesLine, pnlNote, callouts, commentary, open, gates: pre.length };
  }

  /* ---------- AI analytics preview (sample answers, no AI service) ---------- */
  const SUGGESTIONS = [
    'Where will net profit land this year?',
    'Which costs are over budget?',
    'Are any ratios close to their limits?',
    'How is income tracking against budget?',
    'What is in the savings pipeline?',
    'Which decisions are still open?'
  ];

  function askPreview(question, D, period) {
    const q = String(question || '').toLowerCase();
    const rows = pnlSummary(D.pnl_monthly, period.months);
    const get = (n) => rows.find((r) => r.line === n);
    const src = 'Sample data · ' + period.short;
    const has = (re) => re.test(q);
    if (has(/forecast|land|year.?end|full.?year|predict|outlook|project/)) {
      const ye = yearEnd(D);
      return {
        title: 'Full-year net profit forecast', source: 'Sample data · forecast from January to ' + SHORT[mIdx(monthsOf(D.pnl_monthly).slice(-1)[0])] + ' actuals',
        lines: [
          'Before any what-if changes, net profit is forecast to land at ' + money(ye.net.fy) + ' for 2026, with a likely range of ' + money(ye.net.lo) + ' to ' + money(ye.net.hi) + '.',
          'That is ' + Math.abs(ye.net.vs_budget_pct).toFixed(1) + '% ' + dirWord(ye.net.vs_budget_pct) + ' the full-year budget of ' + money(ye.net.budget) + '.',
          'Income is forecast at ' + money(ye.income.fy) + ' and operating costs at ' + money(ye.opex.fy) + '.'
        ]
      };
    }
    if (has(/cost|expense|opex|spend|overrun|technology|staff/)) {
      const over = rows.filter((r) => r.kind === 'line' && r.grp === 'expense' && r.line !== TAX && r.variance < 0).sort((a, b) => a.variance - b.variance);
      const opx = get('Total operating costs');
      return {
        title: 'Costs against budget', source: src,
        lines: ['Operating costs are ' + money(opx.actual) + ', ' + money(Math.abs(opx.variance)) + ' ' + (opx.variance < 0 ? 'above' : 'below') + ' budget' + (over.length ? '. Cost lines over budget, including credit impairment:' : '.')]
          .concat(over.length ? over.map((r) => r.line + ': ' + money(-r.variance) + ' over budget (' + Math.abs(r.variance_pct).toFixed(1) + '%).') : ['No cost line is over budget.'])
      };
    }
    if (has(/ratio|capital|car|liquid|lcr|npl|limit|breach|deposit|margin|regulat/)) {
      const o = ratioOutlook(D.ratios_monthly);
      return {
        title: 'Regulatory ratios and limits', source: 'Sample data and sample limits · ' + monthShort(o[0].month),
        lines: o.map((r) => r.metric + ' ' + pct(r.latest, r.metric === 'Net interest margin' ? 2 : 1) + ': ' + r.text)
      };
    }
    if (has(/income|revenue|interest|fee|nii|trading/)) {
      const inc = get('Total income');
      return {
        title: 'Income against budget', source: src,
        lines: ['Total income is ' + money(inc.actual) + ', ' + signed(inc.variance_pct, 1) + '% against budget and ' + signed(inc.yoy_pct, 1) + '% on last year.']
          .concat(INCOME.map((n) => { const r = get(n); return n + ': ' + money(r.actual) + ' (' + signed(r.variance_pct, 1) + '% vs budget).'; }))
      };
    }
    if (has(/saving|discovery|pipeline/)) {
      const sp = D.savings_pipeline, tot = sp.reduce((s, r) => s + r.annual_saving, 0);
      const by = {}; sp.forEach((r) => { by[r.status] = (by[r.status] || 0) + r.annual_saving; });
      return {
        title: 'Savings pipeline', source: 'Sample data · Discovery pipeline',
        lines: ['The pipeline holds ' + sp.length + ' options worth ' + money(tot) + ' a year.'].concat(Object.keys(by).map((k) => k + ': ' + money(by[k]) + '.'))
      };
    }
    if (has(/decision|gate|commence|risk|open|block/)) {
      const pre = D.gates.filter((g) => g.category === 'Pre-commencement' && g.status !== 'Closed');
      const high = D.risks.filter((r) => r.rating === 'High');
      return {
        title: 'Open decisions and risks', source: 'Operating plan, 25 October',
        lines: [pre.length + ' commencement decisions are open, all needed by 9 November.'].concat(pre.map((g) => g.gate + ' (' + g.owner + ').'), [high.length + ' delivery risks are rated high.'])
      };
    }
    if (has(/profit|net|bottom|earn|result|perform/)) {
      const net = get('Net profit');
      return {
        title: 'Net profit', source: src,
        lines: [period.phrase + ', net profit is ' + money(net.actual) + ', ' + Math.abs(net.variance_pct).toFixed(1) + '% ' + dirWord(net.variance_pct) + ' budget and ' + signed(net.yoy_pct, 1) + '% on the same period of 2025.', narrative(D, period).pnlNote]
      };
    }
    return {
      title: 'Try one of these questions', source: 'Preview',
      lines: ['This preview answers a fixed set of questions about profit, costs, income, ratios, forecasts, savings and open decisions.'], suggestions: SUGGESTIONS
    };
  }

  return {
    INCOME, OPEX, MEASURES, PERIOD_MODES, SCENARIO_KEYS, SUGGESTIONS,
    money, signed, pct, fmtInt, toneOf, monthShort, monthLong, monthsOf, measureById,
    resolvePeriod, pnlSummary, monthlyTotals, measureSeries, kpiForPeriod, bsView, budgetView, reconsView,
    holtFit, holtForecast, measureForecast, yearEnd, backtest, ratioOutlook, narrative, askPreview
  };
});
