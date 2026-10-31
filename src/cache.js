// In-memory cache, persisted to a JSON file so a restart doesn't wipe the
// last good counts (important now that we only scrape once a day).
// Set CACHE_FILE to a path on a persistent disk if your host has one.
import fs from "node:fs";

const CACHE_FILE = process.env.CACHE_FILE || "./cache.json";
const store = new Map(); // slug -> { tiktok, instagram, updatedAt }

try {
  const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  for (const [slug, data] of Object.entries(raw)) store.set(slug, data);
  console.log(`[cache] loaded ${store.size} talents from ${CACHE_FILE}`);
} catch {
  console.log(`[cache] no cache file at ${CACHE_FILE}, starting empty`);
}

function persist() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(allCached(), null, 2));
  } catch (err) {
    console.warn(`[cache] could not write ${CACHE_FILE}: ${err.message}`);
  }
}

export function getCached(slug) {
  return store.get(slug) || null;
}

export function setCached(slug, data) {
  const prev = store.get(slug) || {};
  store.set(slug, { ...prev, ...data, updatedAt: Date.now() });
  persist();
}

export function allCached() {
  return Object.fromEntries(store.entries());
}

// Oldest updatedAt across all talents (0 if any talent is missing).
export function oldestUpdate(slugs) {
  let oldest = Infinity;
  for (const s of slugs) {
    const c = store.get(s);
    if (!c?.updatedAt) return 0;
    oldest = Math.min(oldest, c.updatedAt);
  }
  return oldest === Infinity ? 0 : oldest;
}
