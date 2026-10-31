# ATM Follower Backend

Scrapes public TikTok/Instagram profile pages 2x a day (09:00 and 15:00), caches result,
serves via one endpoint. Pairs with `live-follower-count-all-talents.html`
widget — its `ENDPOINT_BASE` should point at where you deploy this.

## Run

```
npm install
npm start
```

Server starts on `:3000` (set `PORT` env var to change). Results are saved to
`cache.json` (set `CACHE_FILE` to change — use a persistent disk on your host).
On boot it only scrapes if saved data is missing or older than 3h, then
re-scrapes at 09:00 and 15:00 Europe/Berlin.

Optional env vars:
- `CRON_SCHEDULE` — default `0 9,15 * * *` (use `0 9,12,15 * * *` to add a noon run)
- `CRON_TZ` — default `Europe/Berlin`
- `CACHE_FILE` — default `./cache.json`

## Endpoint

```
GET /api/talents/followers?talent=matilda
-> { "tiktok": 293800, "instagram": 18800, "updatedAt": 1234567890 }
```

`talent` must match a slug in `src/talents.js` (same as the URL path on
your site, e.g. `/matilda`, `/brina-und`).

## Wiring to the frontend widget

In `live-follower-count-all-talents.html`, set:

```js
const ENDPOINT_BASE = "https://your-backend-domain.com/api/talents/followers";
```

## Known limitations — read before relying on this

- **Unofficial scraping.** Neither platform provides a free public API for
  follower counts. This parses HTML/embedded JSON from public profile pages.
  Both platforms change their page structure periodically — when they do,
  `scrapeTikTok` / `scrapeInstagram` in `src/scrapers.js` will need updating.
- **Instagram is the weak link.** IG increasingly serves a login wall to
  unauthenticated requests, so `scrapeInstagram` fails more often than the
  TikTok side. On failure the endpoint keeps serving the last known good
  value rather than erroring, so the widget doesn't go blank — but numbers
  can go stale.
- **Rate limits / IP blocks.** Scraping 23 profiles 2x a day is light load. If you see failures spike, first move is slow the
  cron down (`src/server.js`) and the per-talent delay (`src/refresh.js`),
  next move is a rotating proxy or paid API.
- **ToS.** Scraping TikTok/Instagram outside their official APIs isn't
  something either platform sanctions. This is offered as the
  free/unofficial option you picked — if it becomes unreliable or you want
  something contractually stable, a paid provider (Social Blade API,
  EnsembleData, Phyllo) drops into `src/scrapers.js` in place of the fetch
  calls with no changes needed elsewhere.
- **Handles assumed identical across platforms** in `src/talents.js` (same
  @handle used for TikTok and Instagram guess). Verify each talent's actual
  IG handle — some creators use a different one there.

## Deploy

Any Node host works (Railway, Render, Fly.io, a VPS). Just needs:
- Node 18+
- Outbound HTTPS to tiktok.com / instagram.com
- The `PORT` your host expects, read from `process.env.PORT`
