# Backlog

Author: kjaising

## Open
- [ ] Push the latest commits to GitHub and redeploy on Vercel
- [ ] AI analytics: decide with AIB whether to build a live version and where its data may be processed; until then the page gives sample answers only
- [ ] Replace placeholder `--aib-*` colours and `assets/aib-logo-white.png` with AIB's official brand kit
- [ ] Replace sample rows in `data.js` with live AIB feeds (fetch JSON in `shim.js`); programme, gates, risks and close calendar already follow the 25 October operating plan
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
- [ ] Currency and scale: the pack is in AFN '000 (FY2025 net profit AFN 391m); the dashboard's sample data is in USD '000 (YTD net profit $8.5m) and does not match AIB's results. Decide whether the pack replaces the sample P&L, or the two sit side by side clearly labelled
- [ ] Granularity: the pack has five annual years (FY2021 to FY2025) and quarters only for Q1 and Q2 of 2025 and 2026, so no monthly history. Seasonal forecasting (Holt-Winters) is not possible; the review itself advises driver-based scenarios because of three structural breaks (2021 disruption, move to Sharia-compliant reporting, one-off FY2024 gain)
- [ ] Line structure: the pack's P&L (interest income and expense, net fees, FX, securities, ECL, G&A, extraordinary items) differs from the dashboard's lines (staff, technology, premises); G&A and fee detail are annual only
- [ ] Use rows with `Is_Latest = Y`; carry the pack's flags into the page (Q2 2025 OCI does not reconcile, FY2024 ECL allowance printed negative, H1 2025 dividend derived, interim figures unaudited)
- [ ] Confidentiality: these are AIB's actual figures. Agree where the CSV lives (it is not in the repo yet) and whether the GitHub repo is private before adding it; the site has no password, so the data reaches every browser that opens the link

## Done
- [x] Option 2 reads the same data as Option 1; both designs share calculations in `analytics.js`
- [x] Period filter, comparison, chart type and measure pickers, with settings kept in the address
- [x] Forecasts with 80% ranges, year-end landing, what-if sliders, accuracy check and ratio early warning
- [x] AI analytics preview page with sample answers (no AI service)
- [x] Remove Anthropic references from the codebase and add author metadata (`d5facbc`)
- [x] Keep `README.md` and `BACKLOG.md` out of the Vercel deployment (`.vercelignore`); they stay on GitHub
