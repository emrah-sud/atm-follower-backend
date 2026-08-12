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
 * Instagram follower count via Apify's Instagram Followers Count Scraper API.
 * Paid, pay-per-result — sidesteps the login-wall/IP-block problem that makes
 * direct scraping from a cloud host unreliable. Requires two env vars:
 *   APIFY_TOKEN      — your Apify API token (Apify console → Settings → Integrations)
 *   APIFY_ACTOR_ID   — actor id, e.g. "api-empire~instagram-followers-count-scraper"
 * Falls back to the free unofficial scrape below if those aren't set, so this
 * still works (best-effort) without an Apify account configured.
 */
export async function scrapeInstagram(handle) {
  if (process.env.APIFY_TOKEN && process.env.APIFY_ACTOR_ID) {
    try {
      console.log(`[instagram] trying Apify for ${handle}...`);
      const count = await fetchInstagramViaApify(handle);
      console.log(`[instagram] Apify succeeded for ${handle}: ${count}`);
      return count;
    } catch (err) {
      console.warn(`[instagram] Apify call failed for ${handle}: ${err.message} — falling back to free scrape`);
    }
  } else {
    console.warn(`[instagram] Apify NOT configured (APIFY_TOKEN/APIFY_ACTOR_ID missing) — using free scrape for ${handle}`);
  }
  return await scrapeInstagramFree(handle);
}

async function fetchInstagramViaApify(handle) {
  const actorId = encodeURIComponent(process.env.APIFY_ACTOR_ID);
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Most Apify IG actors accept either "usernames" (array) or "username" (single).
    // Sending both covers common input-schema variants without needing to know
    // the exact one in advance.
    body: JSON.stringify({ usernames: [handle], username: handle }),
  });

  if (!res.ok) throw new Error(`apify run failed: ${res.status}`);
  const items = await res.json();
  const item = Array.isArray(items) ? items[0] : null;
  if (!item) throw new Error("apify returned no items");

  // Different Apify IG actors name the field differently — check common variants.
  const count =
    item.followersCount ?? item.followers_count ?? item.followers ?? item.edge_followed_by?.count;

  if (typeof count !== "number") throw new Error("apify item had no recognizable follower field");
  return count;
}

/**
 * Free/unofficial fallback (used only if Apify isn't configured, or its call fails).
 * Instagram aggressively gates plain HTML scraping (login wall) — expect this
 * to fail often from a cloud IP. See README for details.
 */
async function scrapeInstagramFree(handle) {
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
