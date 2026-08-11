import { TALENTS } from "./talents.js";
import { scrapeTikTok, scrapeInstagram } from "./scrapers.js";
import { getCached, setCached } from "./cache.js";

// Space requests out — hammering both platforms back-to-back for 22 talents
// in a tight loop is the fastest way to get the scraper IP blocked.
const DELAY_BETWEEN_TALENTS_MS = 4000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function refreshOne(slug) {
  const handles = TALENTS[slug];
  const prev = getCached(slug) || {};
  const result = { tiktok: prev.tiktok ?? null, instagram: prev.instagram ?? null };

  try {
    result.tiktok = await scrapeTikTok(handles.tiktok);
  } catch (err) {
    console.warn(`[refresh] ${slug} tiktok failed: ${err.message} — keeping last known value`);
  }

  try {
    result.instagram = await scrapeInstagram(handles.instagram);
  } catch (err) {
    console.warn(`[refresh] ${slug} instagram failed: ${err.message} — keeping last known value`);
  }

  setCached(slug, result);
  console.log(`[refresh] ${slug}: tiktok=${result.tiktok} instagram=${result.instagram}`);
}

export async function refreshAll() {
  console.log(`[refresh] starting run for ${Object.keys(TALENTS).length} talents`);
  for (const slug of Object.keys(TALENTS)) {
    await refreshOne(slug);
    await sleep(DELAY_BETWEEN_TALENTS_MS);
  }
  console.log("[refresh] run complete");
}
