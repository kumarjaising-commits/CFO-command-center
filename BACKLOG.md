# Backlog

Author: kjaising

## Open
- [ ] Push the latest commits to GitHub and redeploy on Vercel, once `cfocommandcenter.vercel.app` requires a login
- [ ] Set `SITE_PASSWORD` in Vercel, push, and confirm `cfocommandcenter.vercel.app` asks for the password (`middleware.js`)
- [ ] AI analytics: decide with AIB whether to build a live version and where its data may be processed; until then the page gives sample answers only
- [ ] Replace placeholder `--aib-*` colours and `assets/aib-logo-white.png` with AIB's official brand kit
- [ ] Replace sample rows in `data.js` with live AIB feeds (fetch JSON in `shim.js`); programme, gates, risks and close calendar already follow the 25 October operating plan
- [ ] When live data is connected, serve it from an authenticated server-side API that returns only what each page needs, instead of shipping every dataset in `data.js`
- [ ] Add a Vercel build step that minifies `app.js`, `shim.js` and `data.js` for deployment, keeping readable source on GitHub (deters casual reading in DevTools; not real protection)

## Done
- [x] Option 2 reads the same data as Option 1; both designs share calculations in `analytics.js`
- [x] Period filter, comparison, chart type and measure pickers, with settings kept in the address
- [x] Forecasts with 80% ranges, year-end landing, what-if sliders, accuracy check and ratio early warning
- [x] AI analytics preview page with sample answers (no AI service)
- [x] Remove Anthropic references from the codebase and add author metadata (`d5facbc`)
- [x] Keep `README.md` and `BACKLOG.md` out of the Vercel deployment (`.vercelignore`); they stay on GitHub
