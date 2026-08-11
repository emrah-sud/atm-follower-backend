// Simple in-memory cache. Swap for Redis/file if you need it to survive restarts.
const store = new Map(); // slug -> { tiktok, instagram, updatedAt }

export function getCached(slug) {
  return store.get(slug) || null;
}

export function setCached(slug, data) {
  const prev = store.get(slug) || {};
  store.set(slug, { ...prev, ...data, updatedAt: Date.now() });
}

export function allCached() {
  return Object.fromEntries(store.entries());
}
