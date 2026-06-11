/* ============================================================
   JT Digi Dash — live-data backend
   ------------------------------------------------------------
   POST /api/dashboard?days=30[&force=1]   body: { client:{...} }
   Returns the same JSON shape the front-end demo produces,
   built from REAL platform data, with caching to control cost.

   Connected:  X (Twitter)  +  Meta (Instagram, Facebook, Ads)
   Add a platform = new module in platforms/ + a branch below.

   Env:  X_BEARER_TOKEN, META_TOKEN, CURRENCY_SYMBOL (def R),
         CACHE_TTL_HOURS (def 12)
   ============================================================ */
try { require("dotenv").config(); } catch(e) {}
const express = require("express");
const cors = require("cors");
const { lastNDates } = require("./lib/util");
const { getOrFetch, recordFollowers, readFollowerHistory } = require("./lib/cache");
const { assemble } = require("./assemble");
const twitter = require("./platforms/twitter");
const meta = require("./platforms/meta");

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 8787;

// raw data is always pulled over a wide window and cached; the
// assembler slices it to whatever range the dashboard asks for.
const FETCH_DATES = () => lastNDates(90);

/* Collect (cached) data for every platform this client is on. */
async function gather(client, force){
  const h = client.handles || {};
  const datas = [];

  // --- X (Twitter) ---
  if(h.twitter){
    const handle = twitter.cleanHandle(h.twitter);
    const { data } = await getOrFetch(`twitter:${handle}`, ()=>twitter.fetchRaw(handle), force);
    datas.push(data);
  }

  // --- Meta (Instagram + Facebook + Ads) ---
  if(h.instagram || h.facebook){
    const key = `meta:${client.id || client.name}`;
    const { data } = await getOrFetch(key, ()=>meta.fetchMeta(client, FETCH_DATES()), force);
    (Array.isArray(data)?data:[data]).forEach(d=>datas.push(d));
  }

  // record follower snapshots (idempotent per day) + collect history
  const historyByPlatform = {};
  datas.forEach(pd=>{
    recordFollowers(pd.platform, pd.handle, pd.followers);
    historyByPlatform[pd.platform] = readFollowerHistory(pd.platform, pd.handle);
  });
  return { datas, historyByPlatform };
}

app.post("/api/dashboard", async (req, res) => {
  const days = Math.max(1, Math.min(90, parseInt(req.query.days)||30));
  const force = req.query.force === "1";
  const client = (req.body && req.body.client) || {};
  const h = client.handles || {};
  if(!(h.twitter || h.instagram || h.facebook))
    return res.status(400).json({ error:"This client has no connected platform (X, Instagram or Facebook) set." });
  try{
    const { datas, historyByPlatform } = await gather(client, force);
    if(!datas.length) return res.status(502).json({ error:"No platform data returned." });
    return res.json(assemble(client, days, datas, historyByPlatform));
  }catch(e){
    console.error("dashboard error:", e.message);
    return res.status(502).json({ error:e.message });
  }
});

// quick browser test for an X handle (no client object needed)
app.get("/api/dashboard", async (req, res) => {
  const days = Math.max(1, Math.min(90, parseInt(req.query.days)||30));
  if(!req.query.twitter) return res.status(400).json({ error:"Add ?twitter=@handle to test, or POST a client object." });
  try{
    const client = { name:req.query.twitter, handles:{twitter:req.query.twitter}, budget:0 };
    const { datas, historyByPlatform } = await gather(client, req.query.force==="1");
    return res.json(assemble(client, days, datas, historyByPlatform));
  }catch(e){ return res.status(502).json({ error:e.message }); }
});

app.get("/", (_, res) => res.send("JT Digi Dash API running. Test X: /api/dashboard?twitter=YourHandle&days=30"));
app.get("/health", (_, res) => res.json({ ok:true,
  hasXToken: !!(process.env.X_BEARER_TOKEN||process.env.TWITTER_BEARER),
  hasMetaToken: !!process.env.META_TOKEN }));

if (require.main === module){
  app.listen(PORT, () => console.log(`JT Digi Dash API on http://localhost:${PORT}`));
}
module.exports = { app, gather };
