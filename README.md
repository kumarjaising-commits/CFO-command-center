# AIB interim CFO office: programme dashboard

Author: kjaising

Static site, no build step. The dashboard we use to run the programme of the interim CFO office at AIB. The headline tiles, balance sheet and ratios show AIB's reported figures; the monthly P&L, forecast, budget and the operational pages use sample data. William Higgins (project lead) is in Kabul 10 to 17 November and Nipun Bhatia (Finance operating lead) starts on 11 November; every other plan date is TBD until AIB confirms it.

## Run locally
Open `index.html` in a browser, or serve the folder: `python3 -m http.server 8000`

## Deploy to Vercel
- CLI: `npm i -g vercel`, then `vercel --prod` from this folder (framework preset: Other, no build command, output directory `.`)
- Or push the folder to a Git repo and import it at vercel.com/new
- The site carries `noindex` headers. It is client-confidential, so turn on Vercel Deployment Protection (password or Vercel Authentication) before sharing the link.

## Files
- `index.html`, `app.css`, `theme.css` page, layout and AIB theme (colours are CSS variables at the top of `theme.css`)
- `app.js` page logic and charts; `shim.js` small data/drawing runtime; `vendor/d3.min.js` d3 v7
- `analytics.js` every calculation both designs show: period totals, forecasts (Holt's trend smoothing with 80% ranges), year-end landing, what-if, AIB reported tiles, balance sheet and ratio watch in AFN or USD, written commentary and the AI analytics preview answers. `state.js` keeps the period, comparison, currency and chart choices in the address so links keep them. `charts.js` the month trend chart both designs use (bar, line, area or table, with forecast)
- `data.js` all datasets. `balance_sheet`, `ratios` and `kpis` are AIB's reported figures, written by `scripts/import_workbook.py`; programme, gates, risks and the close calendar come from the operating plan and the November CEO briefing; the rest is sample data. Plan dates not yet confirmed are stored as `TBD` and shown as TBD
- `cost-efficiency.html` AIB cost base and efficiency review (draft), a self-contained page. Hidden for now: no tab links to it, though it is still deployed. It has its own currency switch and AFN per USD rate (65 by default, the dashboard's fixed rate)
- `scripts/import_workbook.py` loads the reporting pack into `data.js` (see below); `financial_data/` holds the source of `cost-efficiency.html`, and the workbook on the author's machine only (it is git-ignored, not on GitHub). `Artifacts/` holds the client decks (CEO briefing pack, Finance team introduction), also kept off GitHub. None of these folders is deployed
- `assets/` AIB logo (white, cropped from the engagement letter header) and fonts (DM Sans, DM Serif Display, Inter, Newsreader, Cinzel, SIL OFL)
- `option-2.html` Option 2 design (board intelligence layout), inactive for now: the home page no longer shows the Option 1 / Option 2 switch or loads `switch.js`. Option 2 still has the Discovery savings page and older dates and names, and reads `savings_pipeline`, which `data.js` no longer has; see BACKLOG.md before switching it back on
- `option-2.css` Option 2 styles, built with Tailwind v3 from `option-2.src.css` and `tailwind.config.js` (those two are not deployed). After changing classes in `option-2.html`, rebuild:
  `npx tailwindcss@3.4.19 -c tailwind.config.js -i option-2.src.css -o option-2.css --minify`

## Tests
`node --test tests/*.test.js` checks the shared calculations, including that the defaults match the figures shown before the analytics features were added. Tests are not deployed.

## AI analytics
The AI analytics page is a preview: answers come from fixed rules over the sample data in `analytics.js` (`askPreview`), and nothing is sent to an AI service.

## AIB reported figures
Source: `financial_data/AIB_Financials_2021-H1_2026 (1).xlsx`, kept out of the repo; ask kjaising for a copy (audited FY2021 to FY2025, unaudited interims to 30 June 2026), rows with `Is_Latest = Y`. To reload after the workbook changes:
`pip install openpyxl`, then `python3 scripts/import_workbook.py "financial_data/AIB_Financials_2021-H1_2026 (1).xlsx"`

The script recalculates each ratio from `Data_Long` and stops if any differs from the workbook's `Key_Metrics` sheet. Figures are stored in AFN thousands; the USD view converts at one fixed rate of 65 AFN per USD (`AFN_PER_USD` in `analytics.js`), the same as the Cost and efficiency page's default, so both agree. The workbook's per-period market rates (`FX_Rates` sheet) are not used. The pack has no monthly figures or budget, so the monthly P&L, forecast and budget pages stay on sample data.

## Making it live
Replace entries in `data.js` (or fetch JSON from AIB feeds in `shim.js`). The Data sources tab lists the intended source system for each page.
