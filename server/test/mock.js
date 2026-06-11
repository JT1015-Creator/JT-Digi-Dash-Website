/* Offline tests — no real tokens/network needed.
   Covers: X normalisation, Meta (IG+FB+Ads) normalisation,
   multi-platform assembly into the dashboard shape, and the cache.
   Run:  node test/mock.js   (or: npm test)
*/
process.env.X_BEARER_TOKEN = "x-test";
process.env.META_TOKEN = "meta-test";
process.env.TIKTOK_ACCESS_TOKEN = "tt-test";
process.env.LINKEDIN_TOKEN = "li-test";
process.env.LINKEDIN_ORG_ID = "123456";
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

  // ---------- TikTok ----------
  if(url.includes("/user/info/"))
    return J({ data:{ user:{ open_id:"tt1", follower_count:33000, following_count:50, likes_count:120000, video_count:88, display_name:"Test Co" } }, error:{ code:"ok" } });
  if(url.includes("/video/list/"))
    return J({ data:{ videos:[
      { id:"v1", title:"Trend dance 🔥", create_time:Math.floor((Date.now()-1*86400000)/1000), like_count:5400, comment_count:210, share_count:380, view_count:142000 },
      { id:"v2", title:"How-to in 15s", create_time:Math.floor((Date.now()-3*86400000)/1000), like_count:2100, comment_count:95, share_count:120, view_count:61000 }
    ]}, error:{ code:"ok" } });

  // ---------- LinkedIn ----------
  if(url.includes("/networkSizes/"))
    return J({ firstDegreeSize: 8700 });
  if(url.includes("organizationalEntityShareStatistics"))
    return J({ elements:[
      { timeRange:{ start: Date.now()-2*86400000, end: Date.now()-1*86400000 }, totalShareStatistics:{ impressionCount:5200, likeCount:140, commentCount:22, shareCount:18, clickCount:90 } },
      { timeRange:{ start: Date.now()-1*86400000, end: Date.now() },             totalShareStatistics:{ impressionCount:6100, likeCount:175, commentCount:30, shareCount:25, clickCount:110 } }
    ]});

  throw new Error("unexpected url "+url);
};

(async () => {
  const twitter = require("../platforms/twitter");
  const meta = require("../platforms/meta");
  const tiktok = require("../platforms/tiktok");
  const linkedin = require("../platforms/linkedin");
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
    handles:{ twitter:"@testco", instagram:"@testco", facebook:"facebook.com/testco", meta_ad_account_id:"act_999",
              tiktok:"@testco", linkedin:"company/testco", linkedin_org_id:"123456" } };
  const metaDatas = await meta.fetchMeta(client, dates90);
  const ig = metaDatas.find(d=>d.platform==="instagram");
  const fb = metaDatas.find(d=>d.platform==="facebook");
  assert.ok(ig && fb, "meta returns IG + FB");
  assert.strictEqual(ig.followers, 24500, "IG followers");
  assert.strictEqual(fb.followers, 51000, "FB followers");
  assert.ok(ig.spendRows.length >= 1, "IG ad spend rows present");
  assert.ok(fb.campaigns.length >= 1, "FB campaign present");
  assert.strictEqual(ig.campaigns.every(c=>c.platform==="instagram"), true, "IG campaigns filtered");

  // 3) TikTok normalisation
  const tt = await tiktok.fetchRaw(client, dates90);
  assert.strictEqual(tt.platform, "tiktok");
  assert.strictEqual(tt.followers, 33000, "TikTok followers");
  assert.strictEqual(tt.posts.length, 2, "TikTok videos");
  assert.strictEqual(tt.posts[0].reach, 142000, "TikTok view_count -> reach");

  // 4) LinkedIn normalisation (account-level)
  const li = await linkedin.fetchRaw(client, dates90);
  assert.strictEqual(li.platform, "linkedin");
  assert.strictEqual(li.followers, 8700, "LinkedIn followers");
  assert.strictEqual(li.posts.length, 0, "LinkedIn has no per-post data");
  assert.ok(li.engagementTotals && li.engagementTotals.impression === 5200+6100, "LinkedIn impressions aggregated");
  assert.ok(li.reachRows && li.reachRows.length === 2, "LinkedIn daily reach rows");

  // 5) assemble ALL FIVE platforms
  const d = assemble(client, 30, [tw, ...metaDatas, tt, li], {});
  ["labels","followersByPlatform","reach","spend","funnel","campaigns","topPosts","kpis","spendByPlatform"].forEach(k=>assert.ok(k in d,"missing "+k));
  assert.strictEqual(d.totalFollowers, 18452+24500+51000+33000+8700, "followers summed across all 5 platforms");
  assert.ok(d.totalSpend > 0, "real ad spend assembled");
  assert.ok(d.kpis.spend.value.startsWith("R"), "ZAR currency");
  assert.strictEqual(d.kpis.roas.value, "—", "roas N/A (no revenue data)");
  // campaigns have null roas -> front-end shows —
  assert.ok(d.campaigns.length >= 2 && d.campaigns[0].roas === null, "campaigns present, roas null");
  // spend split across IG + FB
  const platsWithSpend = d.spendByPlatform.map(s=>s.platform).sort();
  assert.deepStrictEqual(platsWithSpend, ["facebook","instagram"], "spend split by publisher platform");
  // LinkedIn account-level engagement folded into network + funnel, and NOT flagged "gone quiet"
  assert.ok(d.networkEngagement.linkedin === (140+22+18)+(175+30+25), "LinkedIn engagement folded in");
  assert.strictEqual(d.lastPostGap.linkedin, 0, "LinkedIn active (account-level), not 999");
  // TikTok contributes posts + reach
  assert.ok(d.networkEngagement.tiktok > 0, "TikTok engagement present");
  assert.ok(d.topPosts.some(p=>p.platform==="tiktok"), "TikTok post in top posts");

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
