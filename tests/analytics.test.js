// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

global.window = {};
require(path.join(__dirname, '..', 'data.js'));
const D = global.window.AIB_DATA;
const A = require(path.join(__dirname, '..', 'analytics.js'));
const ALL = A.monthsOf(D.pnl_monthly);
const close = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);

test('year to date matches the figures the site already shows', () => {
  const p = A.resolvePeriod({}, ALL);
  assert.equal(p.mode, 'y');
  assert.equal(p.months.length, 9);
  const net = A.pnlSummary(D.pnl_monthly, p.months).find((r) => r.line === 'Net profit');
  const kpi = D.kpis.find((k) => k.id === 'net_profit_ytd');
  assert.equal(net.actual, kpi.value);
  assert.equal(net.budget, kpi.target);
  assert.equal(net.prior, kpi.prior);
});

test('periods resolve to the right months and labels', () => {
  const m = A.resolvePeriod({ mode: 'm', end: '2026-05' }, ALL);
  assert.deepEqual(m.months, ['2026-05-01']);
  assert.equal(m.label, 'May 2026');
  const q = A.resolvePeriod({ mode: 'q', end: '2026-08' }, ALL);
  assert.deepEqual(q.months, ['2026-07-01', '2026-08-01']);
  assert.equal(q.short, 'Q3 2026 to date');
  const r = A.resolvePeriod({ mode: 'r', start: '2026-07', end: '2026-03' }, ALL);
  assert.equal(r.months.length, 5, 'a reversed range is swapped');
  assert.equal(r.start, '2026-03');
  const bad = A.resolvePeriod({ mode: 'zz', end: '1999-01' }, ALL);
  assert.equal(bad.mode, 'y');
  assert.equal(bad.end, '2026-09');
});

test('period totals add up to the monthly lines', () => {
  const p = A.resolvePeriod({ mode: 'r', start: '2026-02', end: '2026-04' }, ALL);
  const rows = A.pnlSummary(D.pnl_monthly, p.months);
  const want = D.pnl_monthly.filter((r) => p.months.includes(r.month) && r.line === 'Staff costs').reduce((s, r) => s + r.actual, 0);
  assert.equal(rows.find((r) => r.line === 'Staff costs').actual, want);
  const get = (n) => rows.find((r) => r.line === n).actual;
  assert.ok(close(get('Net profit'), get('Total income') - get('Total operating costs') - get('Credit impairment') - get('Tax')));
  assert.equal(rows.find((r) => r.line === 'Net profit').latest, A.measureSeries(D.pnl_monthly, 'net').find((r) => r.month === '2026-04-01').actual);
});

test('Holt forecast continues a straight line exactly', () => {
  const y = [10, 12, 14, 16, 18, 20, 22, 24, 26];
  const f = A.holtForecast(y, 3);
  [28, 30, 32].forEach((v, i) => assert.ok(close(f[i].mean, v, 1e-6), 'step ' + (i + 1)));
  assert.ok(f[0].sd < 1e-6);
});

test('forecast ranges widen with the horizon', () => {
  const f = A.holtForecast(A.measureSeries(D.pnl_monthly, 'net').map((r) => r.actual), 6);
  for (let i = 1; i < f.length; i++) assert.ok(f[i].sd >= f[i - 1].sd);
  f.forEach((p) => assert.ok(p.lo < p.mean && p.mean < p.hi));
});

test('net profit forecast equals income less costs, impairment and tax', () => {
  const fc = (id) => A.measureForecast(D.pnl_monthly, id);
  const net = fc('net'), inc = fc('income'), opx = fc('opex'), imp = fc('imp'), tax = fc('tax');
  assert.deepEqual(net.map((r) => r.month), ['2026-10-01', '2026-11-01', '2026-12-01']);
  net.forEach((r, i) => assert.ok(close(r.mean, inc[i].mean - opx[i].mean - imp[i].mean - tax[i].mean, 1e-6)));
});

test('year-end landing is actuals plus forecast against the full-year budget', () => {
  const ye = A.yearEnd(D);
  const fy = A.pnlSummary(D.pnl_monthly, ALL).find((r) => r.line === 'Net profit');
  assert.equal(ye.net.ytd, fy.actual);
  assert.ok(close(ye.net.fy, ye.net.ytd + ye.net.forecast));
  const restNet = D.pnl_budget_rest.reduce((s, r) => s + (r.grp === 'income' ? 1 : -1) * r.budget, 0);
  assert.equal(ye.net.budget, fy.budget + restNet);
  assert.ok(ye.net.lo < ye.net.fy && ye.net.fy < ye.net.hi);
});

test('what-if changes move the landing the right way', () => {
  const base = A.yearEnd(D).net.fy;
  assert.ok(A.yearEnd(D, { opex: 10 }).net.fy < base);
  assert.ok(A.yearEnd(D, { nii: 5 }).net.fy > base);
  assert.ok(A.yearEnd(D, { imp: -20 }).net.fy > base);
  assert.ok(close(A.yearEnd(D, { nii: 0, fee: 0, opex: 0, imp: 0 }).net.fy, base));
});

test('accuracy check forecasts the last three months from the earlier six', () => {
  const bt = A.backtest(D.pnl_monthly, 'net', 3);
  assert.deepEqual(bt.rows.map((r) => r.month), ['2026-07-01', '2026-08-01', '2026-09-01']);
  assert.ok(isFinite(bt.mape) && bt.mape >= 0);
});

test('ratio outlook flags the sample breaches', () => {
  const o = Object.fromEntries(A.ratioOutlook(D.ratios_monthly).map((r) => [r.metric, r]));
  assert.equal(o['NPL ratio'].status, 'breach');
  assert.equal(o['Cost-to-income'].status, 'breach');
  assert.equal(o['Capital adequacy'].status, 'ok');
  assert.equal(o['Capital adequacy'].forecast.length, 12);
});

test('KPI tiles agree with the monthly ratios', () => {
  D.kpis.filter((k) => k.series).forEach((k) => {
    const s = D.ratios_monthly.filter((r) => r.metric === k.series).sort((a, b) => (a.month < b.month ? -1 : 1));
    assert.equal(s[s.length - 1].value, k.value, k.id + ' latest');
    assert.equal(s[s.length - 2].value, k.prior, k.id + ' prior month');
  });
});

test('commentary reproduces the original year-to-date wording', () => {
  const n = A.narrative(D, A.resolvePeriod({}, ALL));
  assert.equal(n.headline, 'Year to date to September, net profit is $8.5m, 6.6% below budget.');
  assert.equal(n.gatesLine, '5 of 5 commencement decisions are still open ahead of the 10 November start.');
  assert.equal(n.pnlNote, 'Technology costs and credit impairment run above budget while fee income runs below, which is where the profit gap comes from.');
  assert.equal(n.callouts.length, 3);
});

test('commentary is written for every period', () => {
  ['m', 'q', 'y', 'r'].forEach((mode) => ALL.forEach((m) => {
    const n = A.narrative(D, A.resolvePeriod({ mode, end: m.slice(0, 7), start: '2026-01' }, ALL));
    [n.headline, n.pnlNote, ...n.callouts.map((c) => c.text), ...n.commentary.map((c) => c.text)].forEach((s) => {
      assert.ok(s && !/undefined|NaN/.test(s), mode + ' ' + m + ': ' + s);
    });
  }));
});

test('preview answers route by topic and never invent a service', () => {
  const p = A.resolvePeriod({}, ALL);
  const t = (q) => A.askPreview(q, D, p).title;
  assert.equal(t('Where will net profit land this year?'), 'Full-year net profit forecast');
  assert.equal(t('Which costs are over budget?'), 'Costs against budget');
  assert.equal(t('Are any ratios close to their limits?'), 'Regulatory ratios and limits');
  assert.equal(t('How is income tracking?'), 'Income against budget');
  assert.equal(t('savings'), 'Savings pipeline');
  assert.equal(t('open decisions'), 'Open decisions and risks');
  assert.equal(t('net profit'), 'Net profit');
  assert.equal(t('hello'), 'Try one of these questions');
  A.SUGGESTIONS.forEach((q) => A.askPreview(q, D, p).lines.forEach((l) => assert.ok(!/undefined|NaN/.test(l), q + ': ' + l)));
});

test('KPI tiles follow the period and keep the September values by default', () => {
  const ytd = A.resolvePeriod({}, ALL), jun = A.resolvePeriod({ mode: 'm', end: '2026-06' }, ALL);
  const car = D.kpis.find((k) => k.id === 'car'), roe = D.kpis.find((k) => k.id === 'roe');
  assert.deepEqual(A.kpiForPeriod(D, car, ytd), car);
  const j = A.kpiForPeriod(D, car, jun);
  const rat = (m) => D.ratios_monthly.find((r) => r.metric === 'Capital adequacy' && r.month === m).value;
  assert.equal(j.value, rat('2026-06-01'));
  assert.equal(j.prior, rat('2026-05-01'));
  assert.equal(A.kpiForPeriod(D, roe, jun).label, 'Return on equity, annualised (Sep close)');
  const np = A.kpiForPeriod(D, D.kpis[0], jun);
  assert.equal(np.label, 'Net profit, June');
  assert.equal(np.value, A.measureSeries(D.pnl_monthly, 'net').find((r) => r.month === '2026-06-01').actual);
});

test('shared table views add the same totals both designs show', () => {
  const r = A.reconsView(D.recons_aging), tot = r[r.length - 1];
  assert.equal(tot.items_total, D.recons_aging.reduce((s, x) => s + x.items_0_30 + x.items_31_90 + x.items_91_180 + x.items_180_plus, 0));
  const b = A.budgetView(D.budget2027);
  assert.equal(b[b.length - 1].budget_2027, D.budget2027.reduce((s, x) => s + x.budget_2027, 0));
  assert.equal(A.bsView(D.balance_sheet).length, D.balance_sheet.length);
});
