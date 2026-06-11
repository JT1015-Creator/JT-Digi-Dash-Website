/* ============================================================
   X (Twitter) — X API v2, app-only Bearer token.
   Env:  X_BEARER_TOKEN
   ------------------------------------------------------------
   Returns the unified "raw platform data" shape consumed by
   server/assemble.js. X gives a current follower count only and
   no ad-spend, so reachRows/spendRows are null and campaigns [].
   Reading analytics requires X's paid (pay-per-use) access.
   ============================================================ */
const API = "https://api.twitter.com/2";

function token(){
  const t = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER;
  if(!t) throw new Error("Missing X_BEARER_TOKEN environment variable");
  return t;
}
function cleanHandle(h){ return String(h||"").replace(/^@/,"").replace(/^.*twitter\.com\//,"").replace(/^.*x\.com\//,"").trim(); }

async function getJSON(url){
  const r = await fetch(url, { headers:{ Authorization:`Bearer ${token()}` } });
  if(!r.ok) throw new Error(`X API ${r.status}: ${await r.text()}`);
  return r.json();
}

async function fetchRaw(handle){
  const u = cleanHandle(handle);
  const userJ = await getJSON(`${API}/users/by/username/${u}?user.fields=public_metrics`);
  if(!userJ.data) throw new Error(`X user not found: @${u}`);
  const pm = userJ.data.public_metrics || {};

  const tweetsJ = await getJSON(`${API}/users/${userJ.data.id}/tweets`
    + `?max_results=100&exclude=retweets,replies&tweet.fields=public_metrics,created_at`);
  const tweets = tweetsJ.data || [];

  return {
    platform: "twitter",
    handle: u,
    followers: pm.followers_count || 0,
    reachRows: null,           // X has no account-level reach; derived from posts
    spendRows: null,           // X ad spend is a separate paid API
    campaigns: [],
    posts: tweets.map(t=>{
      const m = t.public_metrics || {};
      return {
        created_at: t.created_at,
        text: t.text || "",
        like: m.like_count||0,
        comment: m.reply_count||0,
        share: (m.retweet_count||0)+(m.quote_count||0),
        impression: m.impression_count||0,
        reach: m.impression_count||0
      };
    })
  };
}

module.exports = { fetchRaw, cleanHandle };
