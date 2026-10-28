# AIB CFO command center (prototype)

Static site, no build step. Sample data only.

## Run locally
Open `index.html` in a browser, or serve the folder: `python3 -m http.server 8000`

## Deploy to Vercel
- CLI: `npm i -g vercel`, then `vercel --prod` from this folder (framework preset: Other, no build command, output directory `.`)
- Or push the folder to a Git repo and import it at vercel.com/new
- The site carries `noindex` headers. It is client-confidential, so turn on Vercel Deployment Protection (password or Vercel Authentication) before sharing the link.

## Files
- `index.html`, `app.css`, `theme.css` page, layout and AIB theme (colours are CSS variables at the top of `theme.css`)
- `app.js` page logic and charts; `shim.js` small data/drawing runtime; `vendor/d3.min.js` d3 v7
- `data.js` all datasets. Rows are sample data except programme, gates, risks and the close calendar, which come from the 25 October operating plan
- `assets/` AIB logo (white, cropped from the engagement letter header) and fonts (DM Sans, DM Serif Display, SIL OFL)

## Making it live
Replace entries in `data.js` (or fetch JSON from AIB feeds in `shim.js`). The Data sources tab lists the intended source system for each page.
