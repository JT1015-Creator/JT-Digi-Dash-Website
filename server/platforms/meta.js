/* ============================================================
   Meta — Instagram (Business) + Facebook Page + Meta Ads.
   One Graph API token covers all three. FREE API (no per-call $).
   Env:  META_TOKEN                        (long-lived token)
   Optional IDs (else auto-discovered from the token):
         META_PAGE_ID, META_IG_USER_ID, META_AD_ACCOUNT_ID
   Per-client overrides (on client.handles):
         facebook_page_id, instagram_id, meta_ad_account_id
   ------------------------------------------------------------
   fetchMeta(client, days) returns an ARRAY of unified platform
   objects: [instagramData, facebookData], with Meta ad spend
   split across IG/FB by publisher_platform.
   ============================================================ */
const GRAPH = "https://graph.facebook.com/v21.0";

function token(){
  const t = process.env.META_TOKEN;
  if(!t) throw new Error("Missing META_TOKEN environment variable");
  return t;
}
async function getJSON(pathAndQuery){
  const sep = pathAndQuery.includes("?") ? "&" : "?";
  const r = await fetch(`${GRAPH}/${pathAndQuery}${sep}access_token=${token()}`);
  const j = await r.json();
  if(j.error) throw new Error(`Meta API: ${j.error.message}`);
  return j;
}
const unix = d => Math.floor(new Date(d).getTime()/1000);
const ymd  = d => new Date(d).toISOString().slice(0,10);

/* ---- resolve the IDs we need from client / env / discovery ---- */
async function resolveIds(client){
  const h = client.handles || {};
  let igUserId    = h.instagram_id      || process.env.META_IG_USER_ID;
  let pageId      = h.facebook_page_id  || process.env.META_PAGE_ID;
  let adAccountId = h.meta_ad_account_id|| process.env.META_AD_ACCOUNT_ID;

  if(!pageId || !igUserId){
    // discover from the pages this token can manage
    const pages = await getJSON(`me/accounts?fields=name,instagram_business_account`);
    const list = pages.data || [];
    // try to match the client's facebook handle by name, else take the first page
    const want = String(h.facebook||client.name||"").toLowerCase();
    const page = list.find(p => want && String(p.name||"").toLowerCase().includes(want.replace(/.*\//,"").replace(/[^a-z0-9 ]/g,"").trim())) || list[0];
    if(page){
      pageId = pageId || page.id;
      if(page.instagram_business_account) igUserId = igUserId || page.instagram_business_account.id;
    }
  }
  return { igUserId, pageId, adAccountId };
}

/* ---- Meta Ads: daily spend + campaigns, split by IG/FB ---- */
async function fetchAds(adAccountId, dates){
  const spendByPlatformDate = { instagram:{}, facebook:{} };
  const campaigns = [];
  if(!adAccountId) return { spendByPlatformDate, campaigns };
  const acct = String(adAccountId).startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const tr = encodeURIComponent(JSON.stringify({ since: ymd(dates[0]), until: ymd(dates[dates.length-1]) }));

  // daily spend, broken down by publisher_platform
  const daily = await getJSON(`${acct}/insights?level=account&fields=spend,reach,impressions&time_increment=1&breakdowns=publisher_platform&time_range=${tr}`);
  (daily.data||[]).forEach(row=>{
    const plat = (row.publisher_platform||"").toLowerCase();
    const bucket = plat==="instagram" ? spendByPlatformDate.instagram
                 : plat==="facebook"  ? spendByPlatformDate.facebook : null;
    if(bucket) bucket[ row.date_start ] = (bucket[row.date_start]||0) + parseFloat(row.spend||0);
  });

  // per-campaign totals
  const camp = await getJSON(`${acct}/insights?level=campaign&fields=campaign_name,spend,reach,impressions&breakdowns=publisher_platform&time_range=${tr}`);
  const byCampaign = {};
  (camp.data||[]).forEach(row=>{
    const key = row.campaign_name||"Campaign";
    const c = byCampaign[key] || (byCampaign[key] = { name:key, platform:(row.publisher_platform||"facebook").toLowerCase(), spend:0, reach:0, impressions:0 });
    c.spend += parseFloat(row.spend||0);
    c.reach += parseInt(row.reach||0);
    c.impressions += parseInt(row.impressions||0);
  });
  Object.values(byCampaign).forEach(c=>campaigns.push(c));
  return { spendByPlatformDate, campaigns };
}

/* ---- Instagram Business ---- */
async function fetchInstagram(igUserId, dates, ads){
  const prof = await getJSON(`${igUserId}?fields=followers_count,media_count`);
  let reachRows = null;
  try{
    const ins = await getJSON(`${igUserId}/insights?metric=reach&period=day&since=${unix(dates[0])}&until=${unix(dates[dates.length-1])}`);
    const vals = ((ins.data||[])[0]||{}).values || [];
    reachRows = vals.map(v=>({ date: ymd(v.end_time), reach: v.value||0 }));
  }catch(e){ /* reach insight may be unavailable on some accounts */ }

  const media = await getJSON(`${igUserId}/media?fields=caption,timestamp,like_count,comments_count,media_type&limit=50`);
  const posts = (media.data||[]).map(m=>({
    created_at: m.timestamp,
    text: m.caption || "(no caption)",
    like: m.like_count||0,
    comment: m.comments_count||0,
    share: 0,                 // IG doesn't expose share counts via API
    impression: 0,
    reach: 0
  }));

  const spendRows = ads ? Object.entries(ads.spendByPlatformDate.instagram).map(([date,spend])=>({date,spend})) : null;
  return {
    platform:"instagram", handle:`ig:${igUserId}`,
    followers: prof.followers_count||0,
    reachRows, spendRows,
    campaigns: (ads?ads.campaigns:[]).filter(c=>c.platform==="instagram"),
    posts
  };
}

/* ---- Facebook Page ---- */
async function fetchFacebook(pageId, dates, ads){
  const prof = await getJSON(`${pageId}?fields=fan_count,followers_count,name`);
  let reachRows = null;
  try{
    const ins = await getJSON(`${pageId}/insights?metric=page_impressions_unique&period=day&since=${unix(dates[0])}&until=${unix(dates[dates.length-1])}`);
    const vals = ((ins.data||[])[0]||{}).values || [];
    reachRows = vals.map(v=>({ date: ymd(v.end_time), reach: v.value||0 }));
  }catch(e){ /* ignore */ }

  const feed = await getJSON(`${pageId}/posts?fields=message,created_time,shares,reactions.summary(true),comments.summary(true)&limit=25`);
  const posts = (feed.data||[]).map(p=>({
    created_at: p.created_time,
    text: p.message || "(no text)",
    like: p.reactions && p.reactions.summary ? p.reactions.summary.total_count||0 : 0,
    comment: p.comments && p.comments.summary ? p.comments.summary.total_count||0 : 0,
    share: p.shares ? p.shares.count||0 : 0,
    impression: 0,
    reach: 0
  }));

  const spendRows = ads ? Object.entries(ads.spendByPlatformDate.facebook).map(([date,spend])=>({date,spend})) : null;
  return {
    platform:"facebook", handle:`fb:${pageId}`,
    followers: prof.followers_count || prof.fan_count || 0,
    reachRows, spendRows,
    campaigns: (ads?ads.campaigns:[]).filter(c=>c.platform!=="instagram"),
    posts
  };
}

/* ---- orchestrate ---- */
async function fetchMeta(client, dates){
  const { igUserId, pageId, adAccountId } = await resolveIds(client);
  const ads = await fetchAds(adAccountId, dates);
  const out = [];
  const h = client.handles || {};
  if(igUserId && h.instagram) out.push(await fetchInstagram(igUserId, dates, ads));
  if(pageId   && h.facebook)  out.push(await fetchFacebook(pageId, dates, ads));
  if(!out.length) throw new Error("Meta: no Instagram or Facebook account resolved (check META_TOKEN and IDs).");
  return out;
}

module.exports = { fetchMeta, resolveIds };
