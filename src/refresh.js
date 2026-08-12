import { TALENTS } from "./talents.js";
import { scrapeTikTok, scrapeInstagram } from "./scrapers.js";
import { getCached, setCached } from "./cache.js";

// Space requests out — hammering both platforms back-to-back for 22 talents
// in a tight loop is the fastest way to get the scraper IP blocked.
const DELAY_BETWEEN_TALENTS_MS = 4000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry once after a short pause — catches transient blips (rate-limit,
// momentary bad response) without hammering the platform on real failures.
async function withRetry(fn, label) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[refresh] ${label} first attempt failed (${err.message}), retrying once...`);
    await sleep(2000);
    return await fn();
  }
}

async function refreshOne(slug) {
  const handles = TALENTS[slug];
  const prev = getCached(slug) || {};
  const result = { tiktok: prev.tiktok ?? null, instagram: prev.instagram ?? null };

  try {
    result.tiktok = await withRetry(() => scrapeTikTok(handles.tiktok), `${slug} tiktok`);
  } catch (err) {
    console.warn(`[refresh] ${slug} tiktok failed: ${err.message} — keeping last known value`);
  }

  // No retry here — Apify calls already take 30-90sec each, doubling that
  // per-talent risks overlapping into the next scheduled run. A failure here
  // just gets picked up on the next cron cycle instead.
  try {
    result.instagram = await scrapeInstagram(handles.instagram);
  } catch (err) {
    console.warn(`[refresh] ${slug} instagram failed: ${err.message} — keeping last known value`);
  }

  setCached(slug, result);
  console.log(`[refresh] ${slug}: tiktok=${result.tiktok} instagram=${result.instagram}`);
}

let isRunning = false;

export async function refreshAll() {
  if (isRunning) {
    console.warn("[refresh] skipping run — previous cycle still in progress");
    return;
  }
  isRunning = true;
  try {
    console.log(`[refresh] starting run for ${Object.keys(TALENTS).length} talents`);
    for (const slug of Object.keys(TALENTS)) {
      await refreshOne(slug);
      await sleep(DELAY_BETWEEN_TALENTS_MS);
    }
    console.log("[refresh] run complete");
  } finally {
    isRunning = false;
  }
}
