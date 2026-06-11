/* ============================================================
   JT Digi Dash — live-data backend
   ------------------------------------------------------------
   Exposes:  POST /api/dashboard?days=30   body: { client: {...} }
   Returns the SAME JSON shape the front-end demo produces
   (see js/data.js -> demoData), but built from REAL platform data.

   Connected so far:  X (Twitter)   [server/platforms/twitter.js]
   Next platforms drop in the same way (Meta, TikTok, LinkedIn).

   Run locally:   cd server && npm install && npm start
   Deploy:        Render / Railway / Vercel  (see README.md)

   Required env var for X:  X_BEARER_TOKEN
   Optional:                CURRENCY_SYMBOL (default "R")
   ============================================================ */
try { require("dotenv").config(); } catch(e) { /* dotenv optional; hosts set env vars directly */ }
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { fetchTwitter } = require("./platforms/twitter");

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 8787;
const CUR = process.env.CURRENCY_SYMBOL || "R";

const PLATFORMS = ["instagram","tiktok","facebook","twitter","linkedin"];
const PLATFORM_LABEL = { instagram:"Instagram", tiktok:"TikTok", facebook:"Facebook", twitter:"X / Twitter", linkedin:"LinkedIn" };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

/* ---------- formatting (mirrors js/data.js) ---------- */
function fmt(n){
  n = Number(n)||0;
  if(n>=1e6) return (n/1e6).toFixed(1).replace(/\.0$/,"")+"M";
  if(n>=1e3) return (n/1e3).toFixed(1).replace(/\.0$/,"")+"K";
  return Math.round(n).toLocaleString();
}
const money = n => CUR + fmt(n);
const moneyExact = n => CUR + (Number(n)||0).toLocaleString("en-ZA",{minimumFractionDigits:2,maximumFractionDigits:2});

/* ---------- date helpers ---------- */
function dayKey(d){ return d.toISOString().slice(0,10); }
function label(d){ return `${MONTHS[d.getMonth()]} ${d.getDate()}`; }
function lastNDates(days){
  const out=[]; const today=new Date();
  for(let i=days-1;i>=0;i--){ const d=new Date(today); d.setDate(d.getDate()-i); out.push(d); }
  return out;
}

/* ---------- follower snapshots (build growth-over-time) ---------- */
const SNAP_FILE = path.join(__dirname, "data", "snapshots.json");
function readSnaps(){ try{ return JSON.parse(fs.readFileSync(SNAP_FILE,"utf8")); }catch(e){ return {}; } }
function writeSnaps(s){ try{ fs.mkdirSync(path.dirname(SNAP_FILE),{recursive:true}); fs.writeFileSync(SNAP_FILE, JSON.stringify(s)); }catch(e){ console.warn("snapshot write failed:", e.message); } }
function recordFollowers(key, value){
  const s = readSnaps(); s[key] = s[key] || {}; s[key][dayKey(new Date())] = value; writeSnaps(s); return s[key];
}
// build a per-day follower series for the requested window from stored snapshots
function followerSeries(history, dates, current){
  let last = null;
  return dates.map(d=>{
    const k = dayKey(d);
    if(history && history[k]!=null) last = history[k];
    return last;
  }).map(v => v==null ? current : v); // backfill leading gaps with current value
}

/* ============================================================
   Assemble the full dashboard object from X (Twitter) data.
   Other platforms are left empty until their integrations land.
   ============================================================ */
function buildFromTwitter(client, days, tw){
  const dates = lastNDates(days);
  const labels = dates.map(label);

  // follower growth from our daily snapshots
  const history = recordFollowers(tw.handle, tw.followers);
  const twSeries = followerSeries(history, dates, tw.followers);

  const followersByPlatform = {};
  PLATFORMS.forEach(p => followersByPlatform[p] = dates.map(()=>0));
  followersByPlatform.twitter = twSeries;

  const totalFollowers = tw.followers;
  const prevTotalFollowers = twSeries[0] || tw.followers;

  // tweets within window
  const since = dates[0];
  const inWindow = tw.tweets.filter(t => new Date(t.created_at) >= since);

  // reach (impressions proxy) per day
  const reachByDay = {}; dates.forEach(d=> reachByDay[dayKey(d)] = 0);
  inWindow.forEach(t=>{ const k=dayKey(new Date(t.created_at)); if(reachByDay[k]!=null) reachByDay[k]+=t.impression; });
  const reach = dates.map(d=>reachByDay[dayKey(d)]);
  const totalReach = reach.reduce((a,b)=>a+b,0);

  // engagement funnel
  const likes = inWindow.reduce((a,t)=>a+t.like,0);
  const shares = inWindow.reduce((a,t)=>a+t.retweet+t.quote,0);
  const comments = inWindow.reduce((a,t)=>a+t.reply,0);
  const views = inWindow.reduce((a,t)=>a+t.impression,0) || (likes+shares+comments)*15;
  const engagement = likes+shares+comments;

  const networkEngagement = {}; PLATFORMS.forEach(p=>networkEngagement[p]=0); networkEngagement.twitter = engagement;

  // most active days of week
  const dowCount = [0,0,0,0,0,0,0];
  inWindow.forEach(t=> dowCount[new Date(t.created_at).getDay()]++);
  const dow = DOW.map((d,i)=>({day:d, posts:dowCount[i]}));

  // posting frequency (posts/week) — twitter only
  const perWeek = +(inWindow.length / (days/7)).toFixed(1);
  const frequency = PLATFORMS.map(p=>({ platform:p, label:PLATFORM_LABEL[p], perWeek: p==="twitter"?perWeek:0 }));

  // days since last post
  const lastPostGap = {}; PLATFORMS.forEach(p=>lastPostGap[p]= p==="twitter" ? 0 : 999);
  if(tw.tweets.length){
    const latest = tw.tweets.reduce((a,t)=> new Date(t.created_at)>new Date(a.created_at)?t:a);
    lastPostGap.twitter = Math.floor((Date.now()-new Date(latest.created_at))/86400000);
  }

  // ad spend — X Ads API is separate/paid; not connected yet
  const spend = dates.map(()=>0);
  const totalSpend = 0;
  const spendByPlatform = [];
  const campaigns = [];

  // top posts
  const topPosts = [...inWindow]
    .map(t=>({ caption: t.text.length>80?t.text.slice(0,77)+"…":t.text, platform:"twitter",
               reach: t.impression, engagement: t.like+t.retweet+t.quote+t.reply }))
    .sort((a,b)=>b.engagement-a.engagement).slice(0,6);

  // growth rate %
  const twRate = prevTotalFollowers ? +(((totalFollowers-prevTotalFollowers)/prevTotalFollowers)*100).toFixed(1) : 0;
  const growthRate = PLATFORMS.map(p=>({ platform:p, label:PLATFORM_LABEL[p], rate: p==="twitter"?twRate:0 }));

  const engRate = views ? (engagement/views*100) : 0;

  return {
    meta:{ client:client.name, days, generatedAt:new Date(), liveLabel:"X (Twitter) — live", source:"twitter" },
    labels, platforms:PLATFORMS, platformLabel:PLATFORM_LABEL,
    followersByPlatform, totalFollowers, prevTotalFollowers,
    reach, totalReach, spend, totalSpend, dailyBudget:Math.round((client.budget||0)/30),
    funnel:{ views, likes, shares, comments, engagement },
    networkEngagement, dow, frequency, lastPostGap, spendByPlatform,
    campaigns, topPosts, growthRate,
    kpis:{
      followers:{ value:fmt(totalFollowers), delta: twRate },
      reach:{ value:fmt(totalReach), delta:0 },
      spend:{ value:money(totalSpend), delta:0 },
      engagement:{ value:fmt(engagement), delta:0 },
      engRate:{ value:engRate.toFixed(1)+"%", delta:0 },
      cpm:{ value: totalSpend ? moneyExact(totalSpend/(totalReach/1000||1)) : CUR+"0.00", delta:0 },
      roas:{ value: "—", delta:0 },
      posts:{ value: String(inWindow.length), delta:0 }
    }
  };
}

/* ============================================================
   Endpoint
   ============================================================ */
app.post("/api/dashboard", async (req, res) => {
  const days = Math.max(1, Math.min(90, parseInt(req.query.days)||30));
  const client = (req.body && req.body.client) || {};
  const twHandle = client.handles && client.handles.twitter;
  try{
    if(!twHandle) return res.status(400).json({ error:"This client has no X / Twitter handle set." });
    const tw = await fetchTwitter(twHandle, days);
    return res.json(buildFromTwitter(client, days, tw));
  }catch(e){
    console.error("dashboard error:", e.message);
    return res.status(502).json({ error: e.message });
  }
});

// allow GET for quick browser testing of a handle (no client object)
app.get("/api/dashboard", async (req, res) => {
  const days = Math.max(1, Math.min(90, parseInt(req.query.days)||30));
  const twitter = req.query.twitter;
  if(!twitter) return res.status(400).json({ error:"Add ?twitter=@handle to test, or POST a client object." });
  try{
    const tw = await fetchTwitter(twitter, days);
    return res.json(buildFromTwitter({ name:twitter, handles:{twitter}, budget:0 }, days, tw));
  }catch(e){ return res.status(502).json({ error:e.message }); }
});

app.get("/", (_, res) => res.send("JT Digi Dash API running. Test: /api/dashboard?twitter=YourHandle&days=30 (needs X_BEARER_TOKEN)."));
app.get("/health", (_, res) => res.json({ ok:true, hasToken: !!(process.env.X_BEARER_TOKEN||process.env.TWITTER_BEARER) }));

// only start listening when run directly (so tests can import buildFromTwitter)
if (require.main === module){
  app.listen(PORT, () => console.log(`JT Digi Dash API on http://localhost:${PORT}  (currency ${CUR})`));
}

module.exports = { app, buildFromTwitter, fmt, money, PLATFORMS };
