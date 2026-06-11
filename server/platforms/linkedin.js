/* ============================================================
   LinkedIn — Marketing / Community Management API. FREE API
   (but needs LinkedIn Marketing Developer Platform approval).
   ------------------------------------------------------------
   Env:  LINKEDIN_TOKEN            (OAuth access token)
         LINKEDIN_VERSION          (optional, default 202401)
         LINKEDIN_ORG_ID           (numeric organization id)
   Per-client override: client.handles.linkedin_org_id
   ------------------------------------------------------------
   LinkedIn doesn't expose convenient per-post metrics without
   heavier scopes, so this returns ACCOUNT-LEVEL data:
     • current followers          (networkSizes)
     • daily reach (impressions)  (organizationalEntityShareStatistics)
     • aggregate engagement       (likes + comments + shares)
   delivered via `engagementTotals` (the assembler folds this into
   the funnel + per-network engagement). Per-post/top-posts for
   LinkedIn is a future enhancement.
   ============================================================ */
const BASE = "https://api.linkedin.com/rest";

function token(){
  const t = process.env.LINKEDIN_TOKEN;
  if(!t) throw new Error("Missing LINKEDIN_TOKEN environment variable");
  return t;
}
function headers(){
  return {
    Authorization: `Bearer ${token()}`,
    "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202401",
    "X-Restli-Protocol-Version": "2.0.0"
  };
}
async function getJSON(url){
  const r = await fetch(url, { headers: headers() });
  const j = await r.json();
  if(j.status && j.status>=400) throw new Error(`LinkedIn ${j.status}: ${j.message||""}`);
  return j;
}
function orgId(client){
  const id = (client.handles && client.handles.linkedin_org_id) || process.env.LINKEDIN_ORG_ID;
  if(!id) throw new Error("Missing LinkedIn organization id (LINKEDIN_ORG_ID or client.handles.linkedin_org_id)");
  return String(id).replace(/\D/g,"");
}

async function fetchRaw(client, dates){
  const id = orgId(client);
  const orgUrn = `urn:li:organization:${id}`;

  // --- current followers ---
  let followers = 0;
  try{
    const ns = await getJSON(`${BASE}/networkSizes/${encodeURIComponent(orgUrn)}?edgeType=CompanyFollowedByMember`);
    followers = ns.firstDegreeSize || 0;
  }catch(e){ console.warn("LinkedIn followers fetch failed:", e.message); }

  // --- daily reach + engagement (time-bound share statistics) ---
  let reachRows = null;
  const totals = { like:0, comment:0, share:0, impression:0 };
  try{
    const start = dates[0].getTime();
    const end = dates[dates.length-1].getTime();
    const ti = `(timeRange:(start:${start},end:${end}),timeGranularityType:DAY)`;
    const url = `${BASE}/organizationalEntityShareStatistics?q=organizationalEntity`
      + `&organizationalEntity=${encodeURIComponent(orgUrn)}`
      + `&timeIntervals=${encodeURIComponent(ti)}`;
    const stats = await getJSON(url);
    const els = stats.elements || [];
    reachRows = [];
    els.forEach(el=>{
      const s = el.totalShareStatistics || {};
      const day = el.timeRange ? new Date(el.timeRange.start).toISOString().slice(0,10) : null;
      if(day) reachRows.push({ date: day, reach: s.impressionCount || 0 });
      totals.like += s.likeCount || 0;
      totals.comment += s.commentCount || 0;
      totals.share += s.shareCount || 0;
      totals.impression += s.impressionCount || 0;
    });
    if(!reachRows.length) reachRows = null;
  }catch(e){ console.warn("LinkedIn statistics fetch failed:", e.message); }

  return {
    platform:"linkedin",
    handle:`li:${id}`,
    followers,
    reachRows,
    spendRows:null,                 // LinkedIn ad spend (adAnalytics) is a future add-on
    campaigns:[],
    posts:[],                       // account-level only; no per-post data
    engagementTotals: totals        // assembler folds this into funnel + network engagement
  };
}

module.exports = { fetchRaw };
