import express from "express";
import cron from "node-cron";
import { TALENTS } from "./talents.js";
import { getCached } from "./cache.js";
import { refreshAll } from "./refresh.js";

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — restrict to your actual Framer domain in production instead of "*".
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// Matches ENDPOINT_BASE in the frontend widget: /api/talents/followers?talent=matilda
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
  // Run once on boot so cache isn't empty, then on schedule.
  refreshAll();
});

// Every 15 min. TikTok/Instagram will rate-limit or block an IP that scrapes
// too often — do not drop this below ~10 min without a rotating-proxy setup.
cron.schedule("*/15 * * * *", () => {
  refreshAll();
});
