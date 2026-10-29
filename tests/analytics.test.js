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
  assert.equal(net.actual, 8503);
  assert.equal(net.budget, 9101);
  assert.equal(net.prior, 7377);
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

test('ratio watch reads AIB reported ratios against the DAB minimum', () => {
  const o = Object.fromEntries(A.ratioWatch(D.ratios).map((r) => [r.metric, r]));
  assert.equal(Object.keys(o).length, 8);
  const rc = o['Regulatory capital ratio'];
  assert.equal(rc.latest, 20.48);
  assert.equal(rc.label, 'FY2025');
  assert.equal(rc.limit, 13.5);
  assert.equal(rc.status, 'ok');
  assert.ok(close(rc.headroom, 6.98, 1e-9));
  assert.equal(o['Liquid assets to deposits'].label, 'H1 2026');
  assert.equal(o['Liquid assets to deposits'].status, 'none');
  assert.equal(A.ratioWatch([{ metric: 'X', period: 'FY2025', label: 'FY2025', end: '2025-12-31', value: 12, limit: 13.5, limit_kind: 'min' }])[0].status, 'breach');
  assert.equal(A.ratioWatch([{ metric: 'X', period: 'FY2025', label: 'FY2025', end: '2025-12-31', value: 14, limit: 13.5, limit_kind: 'min' }])[0].status, 'watch');
});

test('KPI tiles agree with the reported ratios', () => {
  D.kpis.filter((k) => k.series).forEach((k) => {
    const s = D.ratios.filter((r) => r.metric === k.series).sort((a, b) => (a.end < b.end ? -1 : 1));
    assert.equal(s[s.length - 1].value, k.value, k.id + ' latest');
    assert.equal(s[s.length - 2].value, k.prior, k.id + ' prior report');
  });
});

test('reported figures match the reporting pack', () => {
  const np = D.kpis.find((k) => k.id === 'net_profit');
  assert.equal(np.value, 46462);
  assert.equal(np.prior, 203859);
  const bs = Object.fromEntries(D.balance_sheet.map((r) => [r.code, r]));
  assert.equal(bs.BS_TA.jun26, 38215386);
  assert.equal(bs.BS_DEPOSITS.dec25, 33750713);
  assert.equal(bs.BS_TE.mar26, 3180136);
});

test('balance sheet foots for every date', () => {
  const sum = (sec, k) => D.balance_sheet.filter((r) => r.section === sec && r.kind === 'line').reduce((s, r) => s + r[k], 0);
  const bs = Object.fromEntries(D.balance_sheet.map((r) => [r.code, r]));
  A.BS_COLS.forEach(({ key }) => {
    // AFN 3k tolerance covers the bank's own rounding, as in the workbook's checks
    assert.ok(close(sum('Assets', key), bs.BS_TA[key], 3), key + ' assets');
    assert.ok(close(sum('Liabilities', key), bs.BS_TL[key], 3), key + ' liabilities');
    assert.ok(close(sum('Equity', key), bs.BS_TE[key], 3), key + ' equity');
    assert.ok(close(bs.BS_TL[key] + bs.BS_TE[key], bs.BS_TLE[key], 3), key + ' liabilities and equity');
  });
});

test('USD view converts at the fixed 65 AFN per USD', () => {
  const usd = A.bsView(D, 'usd').find((r) => r.line === 'Total assets');
  const afn = A.bsView(D, 'afn').find((r) => r.line === 'Total assets');
  assert.equal(afn.jun26, 38215386);
  assert.ok(close(usd.jun26, 38215386 / 65));
  assert.ok(close(usd.dec25, 37537401 / 65));
  const np = A.kpiView(D, D.kpis.find((k) => k.id === 'net_profit'), 'usd');
  assert.ok(close(np.value, 46462 / 65));
  assert.ok(close(np.prior, 203859 / 65));
  assert.equal(np.valueText, '$715k');
  assert.equal(A.kpiView(D, D.kpis.find((k) => k.id === 'reg_capital'), 'usd').value, 20.48, 'ratios do not convert');
  assert.equal(A.kpiView(D, D.kpis.find((k) => k.id === 'net_profit'), 'afn').valueText, 'AFN 46.5m');
});

test('commentary reproduces the original year-to-date wording', () => {
  const n = A.narrative(D, A.resolvePeriod({}, ALL));
  assert.equal(n.headline, 'Year to date to September, net profit is $8.5m, 6.6% below budget.');
  assert.equal(n.gatesLine, '5 of 5 commencement decisions are still open ahead of the 10 November start.');
  assert.equal(n.pnlNote, 'Technology costs and credit impairment run above budget while fee income runs below, which is where the profit gap comes from.');
  assert.equal(n.callouts.length, 3);
  assert.equal(n.reported, 'In H1 2026 (unaudited interim), net profit was AFN 46.5m, 77.2% below H1 2025, and cost-to-income was 87.9%.');
  assert.equal(n.callouts[2].text, 'The regulatory capital ratio was 20.5% at 31 December 2025 against the DAB minimum of 13.5%, 698 bps of headroom (AIB reported, audited).');
});

test('commentary is written for every period', () => {
  ['m', 'q', 'y', 'r'].forEach((mode) => ALL.forEach((m) => {
    const n = A.narrative(D, A.resolvePeriod({ mode, end: m.slice(0, 7), start: '2026-01' }, ALL), mode === 'm' ? 'usd' : 'afn');
    [n.headline, n.reported, n.pnlNote, ...n.callouts.map((c) => c.text), ...n.commentary.map((c) => c.text)].forEach((s) => {
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

test('shared table views add the same totals both designs show', () => {
  const r = A.reconsView(D.recons_aging), tot = r[r.length - 1];
  assert.equal(tot.items_total, D.recons_aging.reduce((s, x) => s + x.items_0_30 + x.items_31_90 + x.items_91_180 + x.items_180_plus, 0));
  const b = A.budgetView(D.budget2027);
  assert.equal(b[b.length - 1].budget_2027, D.budget2027.reduce((s, x) => s + x.budget_2027, 0));
  assert.equal(A.bsView(D, 'afn').length, D.balance_sheet.length);
});
