import express from "express";
import cron from "node-cron";
import { TALENTS } from "./talents.js";
import { getCached } from "./cache.js";
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
  refreshAll();
});

// Every 30 min. With Apify configured, each Instagram call takes ~60-90sec,
// so a full 22-talent cycle takes ~25-30 min — going more frequent than this
// would overlap runs.
cron.schedule("*/30 * * * *", () => {
  refreshAll();
});
