# AIB CFO command center (prototype)

Author: kjaising

Static site, no build step. Sample data only.

## Run locally
Open `index.html` in a browser, or serve the folder: `python3 -m http.server 8000`

## Deploy to Vercel
- CLI: `npm i -g vercel`, then `vercel --prod` from this folder (framework preset: Other, no build command, output directory `.`)
- Or push the folder to a Git repo and import it at vercel.com/new
- `middleware.js` asks for a password before Vercel serves any page. Set it as the environment variable `SITE_PASSWORD` in Vercel (Production and Preview); without it the site stays closed. Any username works.
- The site carries `noindex` headers. It is client-confidential, so turn on Vercel Deployment Protection (password or Vercel Authentication) before sharing the link.

## Files
- `index.html`, `app.css`, `theme.css` page, layout and AIB theme (colours are CSS variables at the top of `theme.css`)
- `app.js` page logic and charts; `shim.js` small data/drawing runtime; `vendor/d3.min.js` d3 v7
- `analytics.js` every calculation both designs show: period totals, forecasts (Holt's trend smoothing with 80% ranges), year-end landing, what-if, ratio early warning, written commentary and the AI analytics preview answers. `state.js` keeps the period, comparison and chart choices in the address so links and the design switch keep them. `charts.js` the month trend chart both designs use (bar, line, area or table, with forecast)
- `data.js` all datasets. Rows are sample data except programme, gates, risks and the close calendar, which come from the 25 October operating plan
- `assets/` AIB logo (white, cropped from the engagement letter header) and fonts (DM Sans, DM Serif Display, Inter, Newsreader, Cinzel, SIL OFL)
- `option-2.html` Option 2 design (board intelligence layout); `switch.js` the Option 1 / Option 2 switch in both headers. On the home page Option 2 opens in place (in a full-window frame), so the address stays the same; the open page carries across
- `option-2.css` Option 2 styles, built with Tailwind v3 from `option-2.src.css` and `tailwind.config.js` (those two are not deployed). After changing classes in `option-2.html`, rebuild:
  `npx tailwindcss@3.4.19 -c tailwind.config.js -i option-2.src.css -o option-2.css --minify`

## Tests
`node --test tests/*.test.js` checks the shared calculations, including that the defaults match the figures shown before the analytics features were added. Tests are not deployed.

## AI analytics
The AI analytics page is a preview: answers come from fixed rules over the sample data in `analytics.js` (`askPreview`), and nothing is sent to an AI service.

## Making it live
Replace entries in `data.js` (or fetch JSON from AIB feeds in `shim.js`). The Data sources tab lists the intended source system for each page.
