# AIB CFO command center (prototype)

Author: kjaising

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
- `assets/` AIB logo (white, cropped from the engagement letter header) and fonts (DM Sans, DM Serif Display, Inter, Newsreader, Cinzel, SIL OFL)
- `option-2.html` Option 2 design (board intelligence layout); `switch.js` the Option 1 / Option 2 switch in both headers. On the home page Option 2 opens in place (in a full-window frame), so the address stays the same; the open page carries across
- `option-2.css` Option 2 styles, built with Tailwind v3 from `option-2.src.css` and `tailwind.config.js` (those two are not deployed). After changing classes in `option-2.html`, rebuild:
  `npx tailwindcss@3.4.19 -c tailwind.config.js -i option-2.src.css -o option-2.css --minify`

## Making it live
Replace entries in `data.js` (or fetch JSON from AIB feeds in `shim.js`). The Data sources tab lists the intended source system for each page.
