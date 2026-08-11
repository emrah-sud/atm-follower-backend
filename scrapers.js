import fetch from "node-fetch";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Scrape TikTok public profile follower count.
 * TikTok embeds a JSON blob (SIGI_STATE or UNIVERSAL_DATA) in the page HTML
 * containing followerCount. This is unofficial and WILL break if TikTok
 * changes their page structure — treat as best-effort.
 */
export async function scrapeTikTok(handle) {
  const url = `https://www.tiktok.com/@${handle}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!res.ok) throw new Error(`tiktok fetch ${res.status}`);
  const html = await res.text();

  // Try modern embed first
  let match = html.match(/"followerCount":(\d+)/);
  if (match) return parseInt(match[1], 10);

  // Fallback: older SIGI_STATE shape
  match = html.match(/"stats":\{[^}]*"followerCount":(\d+)/);
  if (match) return parseInt(match[1], 10);

  throw new Error("tiktok follower count not found in page (structure may have changed)");
}

/**
 * Scrape Instagram public profile follower count.
 * Instagram aggressively gates this — unauthenticated HTML often shows a
 * login wall instead of profile data. This best-effort tries the meta
 * description tag ("1,234 Followers, ..."), which sometimes survives.
 * Expect this to fail more often than the TikTok scraper.
 */
export async function scrapeInstagram(handle) {
  const url = `https://www.instagram.com/${handle}/`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!res.ok) throw new Error(`instagram fetch ${res.status}`);
  const html = await res.text();

  // og:description usually: "1,234 Followers, 56 Following, 78 Posts - See..."
  const match = html.match(/content="([\d.,]+)\s+Followers/i);
  if (match) {
    const num = parseInt(match[1].replace(/[.,]/g, ""), 10);
    if (!Number.isNaN(num)) return num;
  }

  throw new Error("instagram follower count not found (likely login-walled)");
}
