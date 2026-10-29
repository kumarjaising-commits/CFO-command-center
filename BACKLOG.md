# Backlog

Author: kjaising

## Open
- [ ] Push the latest commits to GitHub and redeploy on Vercel
- [ ] AI analytics: decide with AIB whether to build a live version and where its data may be processed; until then the page gives sample answers only
- [ ] Replace placeholder `--aib-*` colours and `assets/aib-logo-white.png` with AIB's official brand kit
- [ ] Replace the remaining sample rows in `data.js` (monthly P&L, budget, close, regulatory, savings) with live AIB feeds (fetch JSON in `shim.js`); balance sheet, ratios and headline tiles already come from the reporting pack, and programme, gates, risks and close calendar from the 25 October operating plan
- [ ] Cost and efficiency page: decide whether to rebuild it in each design's own style rather than a frame. Both it and the dashboard use a fixed 65 AFN per USD; confirm the rate with AIB Finance
- [ ] Ask AIB for its internal limits (liquidity, loan-to-deposit, cost-to-income, NPL) so the ratio watch can flag more than the two DAB capital minimums
- [ ] When live data is connected, serve it from an authenticated server-side API that returns only what each page needs, instead of shipping every dataset in `data.js`
- [ ] Add a Vercel build step that minifies `app.js`, `shim.js` and `data.js` for deployment, keeping readable source on GitHub (deters casual reading in DevTools; not real protection)

## Analytics section (planned, not started)
A new Analytics page in both designs, with the same numbers in each, for performance reviews, setting quarter targets and budgeting.

Decisions made (29 Oct 2026):
- AI: route B. Insights come from rule-based analysis in the browser, plus a "what would be sent" panel showing the anonymised data a live AI service would receive, for AIB to review. Nothing is sent to an AI service until AIB approves it.
- History: use AIB's reporting pack (`AIB_Financials_2021-H1_2026_Data_Long.csv` and the Five-Year Financial Review), not generated sample data.

To build:
- [ ] Slice and dice builder: measure, breakdown (year, quarter, P&L line, G&A bucket, fee bucket, interest source, deposit currency), period, comparison, chart type, CSV download
- [ ] Performance review view: variance by line for any period, biggest swings, written summary per line
- [ ] Quarter target planner: suggested targets by line with a likely range, editable, year total, download
- [ ] Budget check: 2027 draft against what history implies, flagging lines that look tight or generous
- [ ] Predictive trends from AIB history: driver-based scenarios (deposit balances, yield on placements and sukuk, fee run-rate, dividend policy), with ranges
- [ ] Insight panel (rule-based) and "what would be sent" anonymised-data panel; fold the current AI analytics page into Analytics
- [ ] Tests for the new calculations, as for `analytics.js`

Points to settle before building:
- [ ] Granularity: the pack has five annual years (FY2021 to FY2025) and quarters only for Q1 and Q2 of 2025 and 2026, so no monthly history. Seasonal forecasting (Holt-Winters) is not possible; the review itself advises driver-based scenarios because of three structural breaks (2021 disruption, move to Sharia-compliant reporting, one-off FY2024 gain)
- [ ] Line structure: the pack's P&L (interest income and expense, net fees, FX, securities, ECL, G&A, extraordinary items) differs from the dashboard's lines (staff, technology, premises); G&A and fee detail are annual only
- [ ] Use rows with `Is_Latest = Y`; carry the pack's flags into the page (Q2 2025 OCI does not reconcile, FY2024 ECL allowance printed negative, H1 2025 dividend derived, interim figures unaudited)

## Done
- [x] Balance sheet, eight ratios and headline tiles from AIB's reporting pack in both designs, with an AFN / USD switch; ratio watch replaces the sample-limit early warning (29 Oct 2026). Monthly P&L, forecast and budget stay sample: the pack has no monthly figures or budget
- [x] Cost and efficiency tab (draft review page) in both designs
- [x] Publishing AIB's figures on the public repo and passwordless site cleared by kjaising (29 Oct 2026)
- [x] Option 2 reads the same data as Option 1; both designs share calculations in `analytics.js`
- [x] Period filter, comparison, chart type and measure pickers, with settings kept in the address
- [x] Forecasts with 80% ranges, year-end landing, what-if sliders, accuracy check and ratio early warning
- [x] AI analytics preview page with sample answers (no AI service)
- [x] Remove Anthropic references from the codebase and add author metadata (`d5facbc`)
- [x] Keep `README.md` and `BACKLOG.md` out of the Vercel deployment (`.vercelignore`); they stay on GitHub
