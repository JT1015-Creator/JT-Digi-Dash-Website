/* Quick offline test — no real token/network needed.
   1) Mocks the X API and checks twitter.js normalises correctly.
   2) Feeds that into buildFromTwitter and checks the dashboard
      shape matches what the front-end expects.
   Run:  node test/mock.js
*/
process.env.X_BEARER_TOKEN = "test-token";
process.env.CURRENCY_SYMBOL = "R";

const assert = require("assert");

// ---- mock global.fetch with canned X API v2 responses ----
const now = new Date();
const daysAgo = n => new Date(now.getTime() - n*86400000).toISOString();
global.fetch = async (url) => {
  if (url.includes("/users/by/username/")) {
    return { ok:true, json: async () => ({ data:{ id:"1", name:"Test Co", username:"testco",
      public_metrics:{ followers_count:18452, following_count:312, tweet_count:4821, listed_count:96 } } }) };
  }
  if (url.includes("/tweets")) {
    return { ok:true, json: async () => ({ data:[
      { id:"a", text:"Big launch today 🚀 grab yours now", created_at:daysAgo(1), public_metrics:{ like_count:340, reply_count:28, retweet_count:75, quote_count:12, impression_count:48210 } },
      { id:"b", text:"Behind the scenes of our shoot", created_at:daysAgo(3), public_metrics:{ like_count:120, reply_count:9, retweet_count:18, quote_count:3, impression_count:15200 } },
      { id:"c", text:"Thanks for 18k followers!", created_at:daysAgo(6), public_metrics:{ like_count:560, reply_count:44, retweet_count:130, quote_count:20, impression_count:90400 } },
      { id:"d", text:"Old post outside window", created_at:daysAgo(45), public_metrics:{ like_count:10, reply_count:1, retweet_count:2, quote_count:0, impression_count:900 } }
    ]}) };
  }
  throw new Error("unexpected url "+url);
};

(async () => {
  const { fetchTwitter } = require("../platforms/twitter");
  const { buildFromTwitter, PLATFORMS } = require("../server");

  // 1) normalisation
  const tw = await fetchTwitter("@testco", 30);
  assert.strictEqual(tw.followers, 18452, "followers parsed");
  assert.strictEqual(tw.tweets.length, 4, "tweets parsed");
  assert.strictEqual(tw.tweets[0].like, 340, "like mapped");

  // 2) dashboard assembly
  const client = { name:"Test Co", handles:{ twitter:"@testco" }, budget:90000 };
  const d = buildFromTwitter(client, 30, tw);

  // shape checks the front-end relies on
  const requiredKeys = ["labels","platforms","platformLabel","followersByPlatform","totalFollowers",
    "reach","totalReach","spend","totalSpend","funnel","networkEngagement","dow","frequency",
    "lastPostGap","spendByPlatform","campaigns","topPosts","growthRate","kpis"];
  requiredKeys.forEach(k => assert.ok(k in d, "missing key: "+k));
  assert.strictEqual(d.labels.length, 30, "30 day labels");
  assert.strictEqual(d.followersByPlatform.twitter.length, 30, "follower series length");
  assert.strictEqual(d.totalFollowers, 18452, "total followers");

  // only the 3 in-window tweets should count
  assert.strictEqual(d.funnel.likes, 340+120+560, "likes summed (in-window only)");
  assert.strictEqual(d.funnel.comments, 28+9+44, "replies->comments");
  assert.strictEqual(d.funnel.shares, (75+12)+(18+3)+(130+20), "retweets+quotes->shares");
  assert.strictEqual(d.kpis.posts.value, "3", "3 posts in window");
  assert.strictEqual(d.topPosts[0].caption.includes("18k") , true, "top post is the highest-engagement one");
  assert.ok(d.kpis.spend.value.startsWith("R"), "currency is ZAR");
  assert.strictEqual(d.kpis.roas.value, "—", "roas N/A for X");
  PLATFORMS.filter(p=>p!=="twitter").forEach(p =>
    assert.strictEqual(d.followersByPlatform[p].every(v=>v===0), true, p+" empty until connected"));

  console.log("✅ All checks passed.");
  console.log("   followers:", d.kpis.followers.value, "| engagement:", d.kpis.engagement.value,
              "| reach:", d.kpis.reach.value, "| engRate:", d.kpis.engRate.value, "| posts:", d.kpis.posts.value);
  console.log("   top post:", JSON.stringify(d.topPosts[0]));
})().catch(e => { console.error("❌ TEST FAILED:", e.message); process.exit(1); });
