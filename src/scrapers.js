import fetch from "node-fetch";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export async function scrapeTikTok(handle) {
  const url = `https://www.tiktok.com/@${handle}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!res.ok) throw new Error(`tiktok fetch ${res.status}`);
  const html = await res.text();

  let match = html.match(/"followerCount":(\d+)/);
  if (match) return parseInt(match[1], 10);

  match = html.match(/"stats":\{[^}]*"followerCount":(\d+)/);
  if (match) return parseInt(match[1], 10);

  throw new Error("tiktok follower count not found in page (structure may have changed)");
}

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
    body: JSON.stringify({ usernames: [handle] }),
  });

  if (!res.ok) throw new Error(`apify run failed: ${res.status}`);
  const items = await res.json();
  const item = Array.isArray(items) ? items[0] : null;
  if (!item) throw new Error("apify returned no items");

  const returnedUsername = item.username ?? item.ownerUsername;
  if (returnedUsername && returnedUsername.toLowerCase() !== handle.toLowerCase()) {
    throw new Error(`apify returned mismatched profile (asked for ${handle}, got ${returnedUsername})`);
  }

  const count =
    item.followersCount ?? item.followers_count ?? item.followers ?? item.edge_followed_by?.count;

  if (typeof count !== "number") {
    console.warn(`[instagram] raw item for ${handle} (no follower field found):`, JSON.stringify(item).slice(0, 500));
    throw new Error("apify item had no recognizable follower field");
  }
  return count;
}

async function scrapeInstagramFree(handle) {
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
