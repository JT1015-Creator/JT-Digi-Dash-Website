/* ============================================================
   TikTok — Display API (organic) + optional Business API (ads).
   FREE API.
   ------------------------------------------------------------
   TikTok user data needs a per-account OAuth access token (each
   client authorises once). Provide it per-client on
   client.handles.tiktok_token, or a single TIKTOK_ACCESS_TOKEN
   env var for your own account.

   Optional ad spend: set TIKTOK_ADVERTISER_ID + TIKTOK_BUSINESS_TOKEN
   (or per-client tiktok_advertiser_id) to pull spend via the
   Marketing API; otherwise spend is left empty.
   ------------------------------------------------------------
   Returns the unified raw shape consumed by server/assemble.js.
   TikTok gives a current follower count only (-> daily snapshots
   build growth) and view_count per video (used as reach).
   ============================================================ */
const DISPLAY = "https://open.tiktokapi.com/v2";
const BIZ = "https://business-api.tiktok.com/open_api/v1.3";

function userToken(client){
  const t = (client.handles && client.handles.tiktok_token) || process.env.TIKTOK_ACCESS_TOKEN;
  if(!t) throw new Error("Missing TikTok access token (TIKTOK_ACCESS_TOKEN or client.handles.tiktok_token)");
  return t;
}

async function getUser(token){
  const fields = "open_id,follower_count,following_count,likes_count,video_count,display_name";
  const r = await fetch(`${DISPLAY}/user/info/?fields=${fields}`, { headers:{ Authorization:`Bearer ${token}` } });
  const j = await r.json();
  if(j.error && j.error.code && j.error.code!=="ok") throw new Error(`TikTok: ${j.error.message||j.error.code}`);
  return (j.data && j.data.user) || {};
}

async function getVideos(token){
  const fields = "id,title,video_description,create_time,like_count,comment_count,share_count,view_count";
  const r = await fetch(`${DISPLAY}/video/list/?fields=${fields}`, {
    method:"POST",
    headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" },
    body: JSON.stringify({ max_count:20 })
  });
  const j = await r.json();
  if(j.error && j.error.code && j.error.code!=="ok") throw new Error(`TikTok: ${j.error.message||j.error.code}`);
  return (j.data && j.data.videos) || [];
}

/* optional ad spend via Marketing API — best effort, never breaks organic */
async function getAdSpend(client, dates){
  const advId = (client.handles && client.handles.tiktok_advertiser_id) || process.env.TIKTOK_ADVERTISER_ID;
  const bizToken = process.env.TIKTOK_BUSINESS_TOKEN || (client.handles && client.handles.tiktok_business_token);
  if(!advId || !bizToken) return { spendRows:null, campaigns:[] };
  try{
    const start = dates[0].toISOString().slice(0,10);
    const end = dates[dates.length-1].toISOString().slice(0,10);
    const params = new URLSearchParams({
      advertiser_id: advId,
      report_type: "BASIC",
      data_level: "AUCTION_CAMPAIGN",
      dimensions: JSON.stringify(["campaign_id","stat_time_day"]),
      metrics: JSON.stringify(["spend","reach","impressions","campaign_name"]),
      start_date: start, end_date: end,
      page_size: "100"
    });
    const r = await fetch(`${BIZ}/report/integrated/get/?${params}`, { headers:{ "Access-Token": bizToken } });
    const j = await r.json();
    const rows = (j.data && j.data.list) || [];
    const spendByDay = {}; const byCampaign = {};
    rows.forEach(row=>{
      const d = row.dimensions || {}; const m = row.metrics || {};
      const day = d.stat_time_day ? String(d.stat_time_day).slice(0,10) : null;
      const spend = parseFloat(m.spend||0);
      if(day) spendByDay[day]=(spendByDay[day]||0)+spend;
      const name = m.campaign_name || `Campaign ${d.campaign_id||""}`;
      const c = byCampaign[name] || (byCampaign[name]={ name, platform:"tiktok", spend:0, reach:0, impressions:0 });
      c.spend += spend; c.reach += parseInt(m.reach||0); c.impressions += parseInt(m.impressions||0);
    });
    return {
      spendRows: Object.entries(spendByDay).map(([date,spend])=>({date,spend})),
      campaigns: Object.values(byCampaign)
    };
  }catch(e){ console.warn("TikTok ads fetch skipped:", e.message); return { spendRows:null, campaigns:[] }; }
}

async function fetchRaw(client, dates){
  const token = userToken(client);
  const user = await getUser(token);
  const videos = await getVideos(token);
  const ads = await getAdSpend(client, dates);
  return {
    platform:"tiktok",
    handle: (client.handles && client.handles.tiktok ? String(client.handles.tiktok).replace(/^@/,"") : (user.open_id||"tiktok")),
    followers: user.follower_count || 0,
    reachRows: null,                 // no account daily reach; derived from video views
    spendRows: ads.spendRows,
    campaigns: ads.campaigns,
    posts: videos.map(v=>({
      created_at: new Date((v.create_time||0)*1000).toISOString(),
      text: v.title || v.video_description || "(no caption)",
      like: v.like_count||0,
      comment: v.comment_count||0,
      share: v.share_count||0,
      impression: v.view_count||0,
      reach: v.view_count||0
    }))
  };
}

module.exports = { fetchRaw };
