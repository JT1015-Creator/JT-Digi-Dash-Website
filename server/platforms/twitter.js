/* ============================================================
   X (Twitter) integration — X API v2, app-only Bearer token.
   ------------------------------------------------------------
   Needs env var:  X_BEARER_TOKEN   (from your X developer app)
   IMPORTANT: reading this data requires the X API **Basic tier**
   (paid). The free tier will return 403/limited responses.

   What X gives us:
     • current follower/following/tweet counts  (snapshot only)
     • recent tweets with public_metrics
         (likes, replies, retweets, quotes, impressions)
   What X does NOT give us:
     • historical follower counts  -> we snapshot daily ourselves
     • organic "reach"             -> we use impressions as proxy
     • ad spend                    -> separate paid X Ads API
   ============================================================ */
const API = "https://api.twitter.com/2";

function authHeaders(){
  const token = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER;
  if(!token) throw new Error("Missing X_BEARER_TOKEN environment variable");
  return { Authorization: `Bearer ${token}` };
}

function cleanHandle(h){ return String(h||"").replace(/^@/,"").replace(/^.*twitter\.com\//,"").replace(/^.*x\.com\//,"").trim(); }

async function getUser(handle){
  const u = cleanHandle(handle);
  const r = await fetch(`${API}/users/by/username/${u}?user.fields=public_metrics,name,username`, { headers: authHeaders() });
  if(!r.ok) throw new Error(`X user lookup failed (${r.status}): ${await r.text()}`);
  const j = await r.json();
  if(!j.data) throw new Error(`X user not found: @${u}`);
  return j.data; // { id, name, username, public_metrics:{followers_count,...} }
}

async function getRecentTweets(userId, max=100){
  const url = `${API}/users/${userId}/tweets`
    + `?max_results=${Math.min(max,100)}`
    + `&exclude=retweets,replies`
    + `&tweet.fields=public_metrics,created_at`;
  const r = await fetch(url, { headers: authHeaders() });
  if(!r.ok) throw new Error(`X tweets fetch failed (${r.status}): ${await r.text()}`);
  const j = await r.json();
  return j.data || [];
}

/* Returns normalised X data the assembler in server.js turns into
   the dashboard JSON shape. */
async function fetchTwitter(handle, days){
  const user = await getUser(handle);
  const tweets = await getRecentTweets(user.id, 100);
  const pm = user.public_metrics || {};
  return {
    handle: cleanHandle(handle),
    followers: pm.followers_count || 0,
    following: pm.following_count || 0,
    tweetCount: pm.tweet_count || 0,
    listed: pm.listed_count || 0,
    tweets: tweets.map(t=>({
      id: t.id,
      text: t.text,
      created_at: t.created_at,
      like: t.public_metrics?.like_count || 0,
      reply: t.public_metrics?.reply_count || 0,
      retweet: t.public_metrics?.retweet_count || 0,
      quote: t.public_metrics?.quote_count || 0,
      impression: t.public_metrics?.impression_count || 0
    }))
  };
}

module.exports = { fetchTwitter, cleanHandle };
