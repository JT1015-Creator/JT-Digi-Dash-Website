/* ============================================================
   JT Digi Dash — OPTIONAL live-data backend
   ------------------------------------------------------------
   You only need this when you're ready to pull REAL data.
   It exposes one endpoint the dashboard calls:
       GET /api/dashboard?client=<id>&days=<n>
   and must return the same JSON shape the demo generator
   produces (see js/data.js -> demoData return value).

   Run locally:   npm install && npm start
   Deploy:        Render / Railway / Vercel (see README.md)

   Secrets live in ENVIRONMENT VARIABLES, never in code:
     META_TOKEN, TIKTOK_TOKEN, TWITTER_BEARER, LINKEDIN_TOKEN,
     META_ADS_TOKEN, TIKTOK_ADS_TOKEN
   ============================================================ */
const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());

const PORT = process.env.PORT || 8787;

/* ---- Example platform fetchers (fill in real API calls) ---- */
async function fetchInstagram(handleOrId, days) {
  // const token = process.env.META_TOKEN;
  // const r = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/insights?metric=reach,follower_count&period=day&access_token=${token}`);
  // return r.json();
  return null; // TODO: implement with your Meta Graph API token
}
async function fetchTikTok(handle, days)   { return null; /* TODO: TikTok API */ }
async function fetchTwitter(handle, days)  { return null; /* TODO: X API v2 */ }
async function fetchLinkedIn(org, days)    { return null; /* TODO: LinkedIn Marketing API */ }
async function fetchMetaAds(accountId, days){ return null; /* TODO: Meta Marketing API */ }

/* ---- Assemble into the dashboard shape ---- */
app.get("/api/dashboard", async (req, res) => {
  const { client, days = 30 } = req.query;
  try {
    // 1) pull raw metrics from each connected platform (above)
    // 2) transform them into the SAME object shape js/data.js returns
    // 3) res.json(thatObject)
    //
    // Until you implement the fetchers, return 501 so the front-end
    // gracefully falls back to demo mode.
    res.status(501).json({
      error: "Live fetchers not implemented yet",
      hint: "Fill in fetchInstagram() etc. in server/server.js, then return the dashboard JSON shape from js/data.js"
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (_, res) => res.send("JT Digi Dash API is running. Try /api/dashboard?client=sprout&days=30"));
app.listen(PORT, () => console.log(`JT Digi Dash API on http://localhost:${PORT}`));
