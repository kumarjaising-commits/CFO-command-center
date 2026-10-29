"""
Loads AIB's reporting pack (AIB_Financials_2021-H1_2026.xlsx) into data.js.

Replaces the balance_sheet, ratios and kpis datasets with AIB's reported figures
(Data_Long rows with Is_Latest = Y). Every other dataset in data.js is left as it is.
Ratios are recomputed from Data_Long with the workbook's own definitions and checked against
its Key_Metrics sheet; the script stops if any of them disagree.

    pip install openpyxl
    python3 scripts/import_workbook.py "financial_data/AIB_Financials_2021-H1_2026 (1).xlsx"
"""
import json
import os
import sys

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JS = os.path.join(ROOT, 'data.js')
PREFIX = 'window.AIB_DATA='

FY = ['FY2021', 'FY2022', 'FY2023', 'FY2024', 'FY2025']
LATEST = 'H1-2026'          # latest flow period
LATEST_BS = 'Q2-2026'       # its balance sheet date (30 Jun 2026)
PRIOR_SAME = 'H1-2025'      # same period last year
OPENING = {'FY2022': 'FY2021', 'FY2023': 'FY2022', 'FY2024': 'FY2023', 'FY2025': 'FY2024', LATEST: 'FY2025'}
BS_DATE = {LATEST: LATEST_BS}
LABEL = {'FY2021': 'FY2021', 'FY2022': 'FY2022', 'FY2023': 'FY2023', 'FY2024': 'FY2024', 'FY2025': 'FY2025',
         'H1-2025': 'H1 2025', 'H1-2026': 'H1 2026', 'Q1-2026': '31 Mar 2026', 'Q2-2026': '30 Jun 2026'}
TOTALS = {'BS_TA', 'BS_TL', 'BS_TE', 'BS_TLE'}


def load(path):
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    rows = list(wb['Data_Long'].iter_rows(values_only=True))
    head = rows[0]
    col = {h: i for i, h in enumerate(head)}
    val, meta = {}, {}
    for r in rows[1:]:
        if r[col['Is_Latest']] != 'Y':
            continue
        p, c = r[col['Period_ID']], r[col['Line_Code']]
        val[(p, c)] = r[col['Value']]
        meta[p] = {'end': r[col['Period_End']].date().isoformat(), 'months': r[col['Months_In_Period']], 'status': r[col['Audit_Status']]}
    km = {}
    sheet = list(wb['Key_Metrics'].iter_rows(values_only=True))
    periods = sheet[3][2:]
    for r in sheet[4:]:
        if r[0]:
            km[r[0]] = dict(zip(periods, r[2:]))
    bs_order = [(r[0], r[1]) for r in wb['BalanceSheet'].iter_rows(values_only=True) if r[1]]
    return val, meta, km, bs_order


def main(path):
    val, meta, km, bs_order = load(path)
    v = lambda p, c: val.get((p, c))
    bs = lambda p, c: v(BS_DATE.get(p, p), c)
    ann = lambda p: 12 / meta[p]['months']
    avg = lambda p, f: (f(OPENING[p]) + f(p)) / 2 if p in OPENING else None

    def equity(p): return bs(p, 'BS_TE')
    def earning(p): return sum(bs(p, c) for c in ('BS_BAL_BANKS', 'BS_PLACEMENTS', 'BS_INVEST', 'BS_LOANS'))
    def income(p): return v(p, 'PL_OPINC') + v(p, 'PL_OTHER_INC')

    # metric: (Key_Metrics label, calc(period) as a decimal, DAB minimum code)
    METRICS = {
        'Regulatory capital ratio': ('Regulatory capital ratio (reported)', lambda p: v(p, 'CAP_REG_RATIO'), 'CAP_MIN_REG'),
        'Tier 1 capital ratio': ('Tier 1 capital ratio (reported)', lambda p: v(p, 'CAP_T1_RATIO'), 'CAP_MIN_T1'),
        'Liquid assets to deposits': ('Liquid assets / deposits', lambda p: sum(bs(p, c) for c in ('BS_CASH_DAB', 'BS_BAL_BANKS', 'BS_PLACEMENTS', 'BS_INVEST')) / bs(p, 'BS_DEPOSITS'), None),
        'Loan-to-deposit': ('Loan-to-deposit ratio', lambda p: bs(p, 'BS_LOANS') / bs(p, 'BS_DEPOSITS'), None),
        'Cost-to-income': ('Cost-to-income ratio', lambda p: -v(p, 'PL_GA') / income(p), None),
        'Net interest margin': ('Net interest margin - proxy (annualised)', lambda p: v(p, 'PL_NII') * ann(p) / avg(p, earning) if p in OPENING else None, None),
        'Return on equity': ('Return on average equity (annualised)', lambda p: v(p, 'PL_NP') * ann(p) / avg(p, equity) if p in OPENING else None, None),
        'Non-performing loans': ('Non-performing share of gross loans', lambda p: v(p, 'LOAN_NPL') / v(p, 'LOAN_GROSS') if v(p, 'LOAN_GROSS') else None, None),
    }

    ratios, problems = [], []
    for metric, (label, fn, lim) in METRICS.items():
        for p in FY + [LATEST]:
            try:
                x = fn(p)
            except TypeError:  # a line not disclosed for this period
                x = None
            ref = km[label].get(p)
            ref = ref if isinstance(ref, (int, float)) else None
            if (x is None) != (ref is None) or (x is not None and abs(x - ref) > 1e-6):
                problems.append('%s %s: calculated %s, Key_Metrics %s' % (metric, p, x, ref))
            if x is None:
                continue
            limit = v(p, lim) if lim else None
            ratios.append({'metric': metric, 'period': p, 'label': LABEL[p], 'end': meta[BS_DATE.get(p, p)]['end'], 'value': round(x * 100, 2),
                           'limit': round(limit * 100, 2) if limit is not None else None, 'limit_kind': 'min' if limit is not None else None,
                           'status': meta[p]['status']})
    if problems:
        sys.exit('Ratios do not match the workbook:\n' + '\n'.join(problems))

    balance = []
    section = 'Assets'
    for code, line in bs_order:
        if line in ('ASSETS', 'LIABILITIES', 'EQUITY'):
            section = line.capitalize()
            continue
        if not code or not code.startswith('BS_'):
            continue
        balance.append({'code': code, 'line': line, 'section': section, 'kind': 'total' if code in TOTALS else 'line',
                        'jun26': v('Q2-2026', code), 'mar26': v('Q1-2026', code), 'dec25': v('FY2025', code), 'dec24': v('FY2024', code)})

    def last(metric, want=None):
        rows = [r for r in ratios if r['metric'] == metric and (want is None or r['period'] == want)]
        return rows[-1]

    # Ratios on balance sheet dates are labelled by the date rather than the period
    STOCK = {'Liquid assets to deposits', 'Loan-to-deposit'}
    AT = {'FY2024': '31 Dec 2024', 'FY2025': '31 Dec 2025', LATEST: LABEL[LATEST_BS]}

    def ratio_kpi(id_, group, label, metric, direction, note, prior_period=None):
        cur = last(metric)
        prev = last(metric, prior_period) if prior_period else [r for r in ratios if r['metric'] == metric][-2]
        name = (lambda r: AT[r['period']]) if metric in STOCK else (lambda r: r['label'])
        return {'id': id_, 'group': group, 'label': label + ', ' + name(cur), 'value': cur['value'], 'unit': '%', 'period': cur['period'], 'status': cur['status'],
                'prior': prev['value'], 'prior_label': 'vs ' + name(prev), 'target': cur['limit'], 'target_label': 'DAB minimum' if cur['limit'] is not None else None,
                'direction': direction, 'series': metric, 'note': note}

    np_now, np_prior = v(LATEST, 'PL_NP'), v(PRIOR_SAME, 'PL_NP')
    kpis = [
        {'id': 'net_profit', 'group': 'Profitability', 'label': 'Net profit, ' + LABEL[LATEST], 'value': np_now, 'unit': 'AFNk', 'period': LATEST, 'status': meta[LATEST]['status'],
         'prior': np_prior, 'prior_label': 'vs ' + LABEL[PRIOR_SAME], 'prior_period': PRIOR_SAME, 'target': None, 'target_label': None,
         'ref_label': 'FY2025', 'ref_value': v('FY2025', 'PL_NP'), 'ref_period': 'FY2025', 'direction': 'up', 'series': '',
         'note': 'Profit after tax, January to June 2026, unaudited interim.'},
        ratio_kpi('roe', 'Profitability', 'Return on equity', 'Return on equity', 'up', 'Annualised net profit divided by average equity.'),
        ratio_kpi('cost_income', 'Profitability', 'Cost-to-income', 'Cost-to-income', 'down', 'General and administrative expenses divided by total income.'),
        ratio_kpi('nim', 'Profitability', 'Net interest margin', 'Net interest margin', 'up', 'Annualised net interest income divided by average earning assets (proxy).'),
        ratio_kpi('reg_capital', 'Capital and liquidity', 'Regulatory capital ratio', 'Regulatory capital ratio', 'up', 'Total regulatory capital divided by risk-weighted assets, as reported. Disclosed annually.'),
        ratio_kpi('liquid', 'Capital and liquidity', 'Liquid assets to deposits', 'Liquid assets to deposits', 'up', 'Cash at DAB, bank balances, placements and investments divided by customer deposits.'),
        ratio_kpi('ld', 'Capital and liquidity', 'Loan-to-deposit', 'Loan-to-deposit', None, 'Net loans and financing divided by customer deposits.'),
        ratio_kpi('npl', 'Asset quality', 'Non-performing loans', 'Non-performing loans', 'down', 'Non-performing exposure divided by the gross loan portfolio. Disclosed annually.'),
    ]

    # The first line holds the main object; later lines (such as pnl_budget_rest) are kept as they are
    with open(DATA_JS, encoding='utf-8') as f:
        first, rest = f.read().split('\n', 1)
    assert first.startswith(PREFIX) and first.endswith(';')
    data = json.loads(first[len(PREFIX):-1])
    data.pop('ratios_monthly', None)
    data['balance_sheet'] = balance
    data['ratios'] = ratios
    data['kpis'] = kpis
    with open(DATA_JS, 'w', encoding='utf-8') as f:
        f.write(PREFIX + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n' + rest)
    print('data.js: %d balance sheet lines, %d ratio points, %d KPIs' % (len(balance), len(ratios), len(kpis)))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'financial_data', 'AIB_Financials_2021-H1_2026 (1).xlsx'))
