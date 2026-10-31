import express from "express";
import cron from "node-cron";
import { TALENTS } from "./talents.js";
import { getCached, oldestUpdate } from "./cache.js";
import { refreshAll } from "./refresh.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/api/talents/followers", (req, res) => {
  const slug = req.query.talent;
  if (!slug || !TALENTS[slug]) {
    return res.status(404).json({ error: "unknown talent slug" });
  }
  const cached = getCached(slug);
  if (!cached) {
    return res.status(202).json({ error: "not scraped yet, try again shortly" });
  }
  res.json({
    tiktok: cached.tiktok,
    instagram: cached.instagram,
    updatedAt: cached.updatedAt,
  });
});

app.listen(PORT, () => {
  console.log(`[server] listening on :${PORT}`);
  console.log(
    `[server] APIFY_TOKEN present: ${Boolean(process.env.APIFY_TOKEN)}, APIFY_ACTOR_ID: ${process.env.APIFY_ACTOR_ID || "(not set)"}`
  );

  // On boot, only scrape if the saved data is older than 3h (or missing),
  // so restarts/redeploys don't trigger extra scrapes between scheduled runs.
  const age = Date.now() - oldestUpdate(Object.keys(TALENTS));
  if (age > 3 * 60 * 60 * 1000) {
    console.log("[server] cached data missing or older than 3h — scraping now");
    refreshAll();
  } else {
    console.log(`[server] cached data is ${Math.round(age / 60000)} min old — waiting for next scheduled run`);
  }
});

// 2x a day: 09:00 (start of work) and 15:00 (afternoon), Europe/Berlin.
// Override with CRON_SCHEDULE / CRON_TZ, e.g. "0 9,12,15 * * *" for 3 runs.
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "0 9,15 * * *";
const CRON_TZ = process.env.CRON_TZ || "Europe/Berlin";
cron.schedule(CRON_SCHEDULE, () => refreshAll(), { timezone: CRON_TZ });
console.log(`[server] refresh scheduled: "${CRON_SCHEDULE}" (${CRON_TZ})`);
