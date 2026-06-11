/* Offline tests — no real tokens/network needed.
   Covers: X normalisation, Meta (IG+FB+Ads) normalisation,
   multi-platform assembly into the dashboard shape, and the cache.
   Run:  node test/mock.js   (or: npm test)
*/
process.env.X_BEARER_TOKEN = "x-test";
process.env.META_TOKEN = "meta-test";
process.env.CURRENCY_SYMBOL = "R";
process.env.CACHE_TTL_HOURS = "12";

const assert = require("assert");
const path = require("path");
const fs = require("fs");
// start from a clean cache/snapshots so assertions are deterministic
try { fs.rmSync(path.join(__dirname,"..","data"), {recursive:true, force:true}); } catch(e){}

const iso = n => new Date(Date.now()-n*86400000).toISOString();

// ---- mock global.fetch for both X and Meta ----
global.fetch = async (url) => {
  const J = obj => ({ ok:true, json: async()=>obj });

  // ---------- X (Twitter) ----------
  if(url.includes("/users/by/username/"))
    return J({ data:{ id:"X1", username:"testco", public_metrics:{ followers_count:18452, following_count:300, tweet_count:4800, listed_count:90 } } });
  if(url.includes("/users/X1/tweets"))
    return J({ data:[
      { id:"t1", text:"Launch day 🚀", created_at:iso(1), public_metrics:{ like_count:300, reply_count:20, retweet_count:60, quote_count:10, impression_count:40000 } },
      { id:"t2", text:"BTS shoot", created_at:iso(4), public_metrics:{ like_count:90, reply_count:6, retweet_count:12, quote_count:2, impression_count:12000 } }
    ]});

  // ---------- Meta discovery ----------
  if(url.includes("me/accounts"))
    return J({ data:[{ id:"PAGE1", name:"Test Co", instagram_business_account:{ id:"IG1" } }] });

  // ---------- Instagram ----------
  if(url.includes("IG1?fields=followers_count"))
    return J({ followers_count:24500, media_count:310 });
  if(url.includes("IG1/insights"))
    return J({ data:[{ values:[ {end_time:iso(2),value:9000}, {end_time:iso(1),value:11000} ] }] });
  if(url.includes("IG1/media"))
    return J({ data:[
      { caption:"New drop ✨ shop now", timestamp:iso(1), like_count:1200, comments_count:85, media_type:"IMAGE" },
      { caption:"Reel: how we make it", timestamp:iso(5), like_count:2300, comments_count:140, media_type:"VIDEO" }
    ]});

  // ---------- Facebook ----------
  if(url.includes("PAGE1?fields=fan_count"))
    return J({ followers_count:51000, fan_count:50000, name:"Test Co" });
  if(url.includes("PAGE1/insights"))
    return J({ data:[{ values:[ {end_time:iso(2),value:14000}, {end_time:iso(1),value:16000} ] }] });
  if(url.includes("PAGE1/posts"))
    return J({ data:[
      { message:"Weekend special 🎉", created_time:iso(2), shares:{count:14}, reactions:{summary:{total_count:210}}, comments:{summary:{total_count:33}} }
    ]});

  // ---------- Meta Ads ----------
  if(url.includes("/insights?level=account"))
    return J({ data:[
      { date_start: new Date(Date.now()-1*86400000).toISOString().slice(0,10), publisher_platform:"instagram", spend:"1200.50", reach:"15000", impressions:"30000" },
      { date_start: new Date(Date.now()-1*86400000).toISOString().slice(0,10), publisher_platform:"facebook",  spend:"800.00",  reach:"12000", impressions:"24000" },
      { date_start: new Date(Date.now()-2*86400000).toISOString().slice(0,10), publisher_platform:"facebook",  spend:"650.00",  reach:"9000",  impressions:"18000" }
    ]});
  if(url.includes("/insights?level=campaign"))
    return J({ data:[
      { campaign_name:"Always-On IG", publisher_platform:"instagram", spend:"3400.00", reach:"42000", impressions:"90000" },
      { campaign_name:"FB Retargeting", publisher_platform:"facebook", spend:"2100.00", reach:"31000", impressions:"70000" }
    ]});

  throw new Error("unexpected url "+url);
};

(async () => {
  const twitter = require("../platforms/twitter");
  const meta = require("../platforms/meta");
  const { assemble } = require("../assemble");
  const { lastNDates } = require("../lib/util");
  const cache = require("../lib/cache");

  const dates90 = lastNDates(90);

  // 1) X normalisation
  const tw = await twitter.fetchRaw("@testco");
  assert.strictEqual(tw.platform, "twitter");
  assert.strictEqual(tw.followers, 18452);
  assert.strictEqual(tw.posts.length, 2);
  assert.strictEqual(tw.posts[0].share, 70, "retweet+quote -> share");

  // 2) Meta normalisation (returns [instagram, facebook])
  const client = { id:"testco", name:"Test Co", budget:90000,
    handles:{ twitter:"@testco", instagram:"@testco", facebook:"facebook.com/testco", meta_ad_account_id:"act_999" } };
  const metaDatas = await meta.fetchMeta(client, dates90);
  const ig = metaDatas.find(d=>d.platform==="instagram");
  const fb = metaDatas.find(d=>d.platform==="facebook");
  assert.ok(ig && fb, "meta returns IG + FB");
  assert.strictEqual(ig.followers, 24500, "IG followers");
  assert.strictEqual(fb.followers, 51000, "FB followers");
  assert.ok(ig.spendRows.length >= 1, "IG ad spend rows present");
  assert.ok(fb.campaigns.length >= 1, "FB campaign present");
  assert.strictEqual(ig.campaigns.every(c=>c.platform==="instagram"), true, "IG campaigns filtered");

  // 3) assemble all three platforms
  const d = assemble(client, 30, [tw, ...metaDatas], {});
  ["labels","followersByPlatform","reach","spend","funnel","campaigns","topPosts","kpis","spendByPlatform"].forEach(k=>assert.ok(k in d,"missing "+k));
  assert.strictEqual(d.totalFollowers, 18452+24500+51000, "followers summed across platforms");
  assert.ok(d.totalSpend > 0, "real ad spend assembled");
  assert.ok(d.kpis.spend.value.startsWith("R"), "ZAR currency");
  assert.strictEqual(d.kpis.roas.value, "—", "roas N/A (no revenue data)");
  // campaigns have null roas -> front-end shows —
  assert.ok(d.campaigns.length >= 2 && d.campaigns[0].roas === null, "campaigns present, roas null");
  // spend split across IG + FB
  const platsWithSpend = d.spendByPlatform.map(s=>s.platform).sort();
  assert.deepStrictEqual(platsWithSpend, ["facebook","instagram"], "spend split by publisher platform");
  // top post should be the high-engagement IG reel
  assert.ok(d.topPosts[0].caption.includes("Reel") || d.topPosts[0].engagement>=2000, "top post by engagement");

  // 4) cache: second call must NOT re-invoke the fetcher within TTL
  let calls=0;
  const fn = async()=>{ calls++; return {n:calls}; };
  const a = await cache.getOrFetch("unit:test", fn);
  const b = await cache.getOrFetch("unit:test", fn);
  assert.strictEqual(calls, 1, "fetcher called once (cache hit on 2nd)");
  assert.strictEqual(b.cached, true, "second call served from cache");
  const c = await cache.getOrFetch("unit:test", fn, true); // force bypass
  assert.strictEqual(calls, 2, "force=true bypasses cache");

  console.log("✅ All checks passed.");
  console.log("   followers:", d.kpis.followers.value, "| reach:", d.kpis.reach.value,
              "| spend:", d.kpis.spend.value, "| engagement:", d.kpis.engagement.value,
              "| posts:", d.kpis.posts.value);
  console.log("   spend by platform:", JSON.stringify(d.spendByPlatform));
  console.log("   live label:", d.meta.liveLabel);
})().catch(e => { console.error("❌ TEST FAILED:", e.stack||e.message); process.exit(1); });
