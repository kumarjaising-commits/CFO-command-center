# Backlog

Author: kjaising

## Open
- [ ] Push commits `d5facbc` and `af6fce1` to GitHub and redeploy on Vercel
- [ ] Turn on Vercel Deployment Protection (password or Vercel Authentication) before sharing the link
- [ ] Replace placeholder `--aib-*` colours and `assets/aib-logo-white.png` with AIB's official brand kit
- [ ] Replace sample rows in `data.js` with live AIB feeds (fetch JSON in `shim.js`); programme, gates, risks and close calendar already follow the 25 October operating plan
- [ ] When live data is connected, serve it from an authenticated server-side API that returns only what each page needs, instead of shipping every dataset in `data.js`
- [ ] Add a Vercel build step that minifies `app.js`, `shim.js` and `data.js` for deployment, keeping readable source on GitHub (deters casual reading in DevTools; not real protection)

## Done
- [x] Remove Anthropic references from the codebase and add author metadata (`d5facbc`)
- [x] Keep `README.md` and `BACKLOG.md` out of the Vercel deployment (`.vercelignore`); they stay on GitHub
