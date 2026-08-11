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
 * Instagram aggressively gates plain HTML scraping (login wall). This tries
 * the internal endpoint the IG web client itself calls first (works longer
 * before getting blocked, since it's a real API path rather than the HTML
 * shell), then falls back to parsing the og:description meta tag.
 * Still unofficial — expect this to need occasional maintenance.
 */
export async function scrapeInstagram(handle) {
  // Attempt 1: IG's own web_profile_info endpoint (used by instagram.com's web app).
  // The x-ig-app-id value below is IG's public web client app id, not a secret.
  try {
    const apiUrl = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`;
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
        "x-ig-app-id": "936619743392459",
        "Accept": "*/*",
      },
    });
    if (res.ok) {
      const data = await res.json();
      const count = data?.data?.user?.edge_followed_by?.count;
      if (typeof count === "number") return count;
    }
  } catch {
    // fall through to HTML fallback
  }

  // Attempt 2: plain HTML og:description ("1,234 Followers, ...")
  const url = `https://www.instagram.com/${handle}/`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!res.ok) throw new Error(`instagram fetch ${res.status}`);
  const html = await res.text();

  const match = html.match(/content="([\d.,]+)\s+Followers/i);
  if (match) {
    const num = parseInt(match[1].replace(/[.,]/g, ""), 10);
    if (!Number.isNaN(num)) return num;
  }

  throw new Error("instagram follower count not found (API + HTML both failed)");
}
