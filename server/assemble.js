/* ============================================================
   Merge one or more platforms' unified data into the exact
   dashboard JSON shape the front-end expects (mirrors demoData
   in js/data.js). Works for any combination of platforms.
   ============================================================ */
const { PLATFORMS, PLATFORM_LABEL, fmt, money, moneyExact, CUR, dayKey, label, lastNDates } = require("./lib/util");

// build a per-day follower series from stored snapshots; backfill gaps
function followerSeries(history, dates, current){
  let last=null;
  return dates.map(d=>{ const k=dayKey(d); if(history && history[k]!=null) last=history[k]; return last; })
              .map(v=> v==null ? current : v);
}

function assemble(client, days, platformDatas, historyByPlatform={}){
  const dates = lastNDates(days);
  const labels = dates.map(label);
  const since = dates[0];
  const present = platformDatas.map(p=>p.platform);

  // ---- followers ----
  const followersByPlatform = {};
  PLATFORMS.forEach(p=> followersByPlatform[p]= dates.map(()=>0));
  let totalFollowers=0, prevTotalFollowers=0;
  platformDatas.forEach(pd=>{
    const series = followerSeries(historyByPlatform[pd.platform], dates, pd.followers);
    followersByPlatform[pd.platform] = series;
    totalFollowers += pd.followers||0;
    prevTotalFollowers += series[0]||pd.followers||0;
  });

  // ---- posts merged + windowed ----
  const allPosts = [];
  platformDatas.forEach(pd=> (pd.posts||[]).forEach(p=> allPosts.push({ ...p, platform:pd.platform })));
  const inWindow = allPosts.filter(p=> new Date(p.created_at) >= since);

  // ---- reach per day (account reachRows preferred, else post-derived) ----
  const reach = dates.map(()=>0);
  platformDatas.forEach(pd=>{
    const byDay = {};
    if(pd.reachRows && pd.reachRows.length){
      pd.reachRows.forEach(r=> byDay[r.date]=(byDay[r.date]||0)+(r.reach||0));
    } else {
      (pd.posts||[]).forEach(p=>{ const k=dayKey(p.created_at); byDay[k]=(byDay[k]||0)+(p.reach||0); });
    }
    dates.forEach((d,i)=>{ reach[i]+= byDay[dayKey(d)]||0; });
  });
  const totalReach = reach.reduce((a,b)=>a+b,0);

  // ---- spend per day + per platform (from ad data) ----
  const spend = dates.map(()=>0);
  const spendByPlatformMap = {};
  platformDatas.forEach(pd=>{
    if(!pd.spendRows) return;
    const byDay={}; pd.spendRows.forEach(r=> byDay[r.date]=(byDay[r.date]||0)+(r.spend||0));
    let tot=0;
    dates.forEach((d,i)=>{ const v=byDay[dayKey(d)]||0; spend[i]+=v; tot+=v; });
    if(tot>0) spendByPlatformMap[pd.platform]=tot;
  });
  const totalSpend = spend.reduce((a,b)=>a+b,0);
  const spendByPlatform = Object.entries(spendByPlatformMap)
    .map(([p,s])=>({ platform:p, label:PLATFORM_LABEL[p], spend:Math.round(s) }));

  // ---- engagement funnel ----
  const sum = (arr,f)=>arr.reduce((a,x)=>a+f(x),0);
  const likes = sum(inWindow,p=>p.like||0);
  const shares = sum(inWindow,p=>p.share||0);
  const comments = sum(inWindow,p=>p.comment||0);
  const impr = sum(inWindow,p=>p.impression||0);
  const views = impr>0 ? impr : totalReach;
  const engagement = likes+shares+comments;

  // ---- per-network engagement ----
  const networkEngagement = {}; PLATFORMS.forEach(p=>networkEngagement[p]=0);
  inWindow.forEach(p=> networkEngagement[p.platform]+= (p.like||0)+(p.share||0)+(p.comment||0));

  // ---- active days of week ----
  const dowCount=[0,0,0,0,0,0,0];
  inWindow.forEach(p=> dowCount[new Date(p.created_at).getDay()]++);
  const DOW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const dow = DOW.map((d,i)=>({day:d, posts:dowCount[i]}));

  // ---- posting frequency + last-post gap ----
  const frequency = PLATFORMS.map(p=>{
    const cnt = inWindow.filter(x=>x.platform===p).length;
    return { platform:p, label:PLATFORM_LABEL[p], perWeek: present.includes(p)? +(cnt/(days/7)).toFixed(1) : 0 };
  });
  const lastPostGap={}; PLATFORMS.forEach(p=>lastPostGap[p]= present.includes(p)?0:999);
  platformDatas.forEach(pd=>{
    if(!pd.posts||!pd.posts.length){ lastPostGap[pd.platform]=999; return; }
    const latest = pd.posts.reduce((a,b)=> new Date(b.created_at)>new Date(a.created_at)?b:a);
    lastPostGap[pd.platform]= Math.floor((Date.now()-new Date(latest.created_at))/86400000);
  });

  // ---- campaigns (real ad data; ROAS unknown without revenue) ----
  const campaigns = [];
  platformDatas.forEach(pd=> (pd.campaigns||[]).forEach(c=>{
    const cpm = c.reach ? +(c.spend/(c.reach/1000)).toFixed(2) : 0;
    campaigns.push({ name:c.name, platform:c.platform, spend:Math.round(c.spend),
                     reach:Math.round(c.reach||c.impressions||0), cpm, roas:null });
  }));
  campaigns.sort((a,b)=>b.spend-a.spend);

  // ---- top posts ----
  const topPosts = [...inWindow]
    .map(p=>({ caption: (p.text||"").length>80?p.text.slice(0,77)+"…":(p.text||""),
               platform:p.platform, reach:p.reach||p.impression||0,
               engagement:(p.like||0)+(p.share||0)+(p.comment||0) }))
    .sort((a,b)=>b.engagement-a.engagement).slice(0,6);

  // ---- growth rate ----
  const growthRate = PLATFORMS.map(p=>{
    const s=followersByPlatform[p]; if(!s[0]) return {platform:p,label:PLATFORM_LABEL[p],rate:0};
    return { platform:p, label:PLATFORM_LABEL[p], rate:+(((s[s.length-1]-s[0])/s[0])*100).toFixed(1) };
  });

  const overallRate = prevTotalFollowers ? +(((totalFollowers-prevTotalFollowers)/prevTotalFollowers)*100).toFixed(1) : 0;
  const engRate = views ? (engagement/views*100) : 0;

  return {
    meta:{ client:client.name, days, generatedAt:new Date(),
           liveLabel: present.map(p=>PLATFORM_LABEL[p]).join(" + ")+" — live", source:present.join(",") },
    labels, platforms:PLATFORMS, platformLabel:PLATFORM_LABEL,
    followersByPlatform, totalFollowers, prevTotalFollowers,
    reach, totalReach, spend, totalSpend, dailyBudget:Math.round((client.budget||0)/30),
    funnel:{ views, likes, shares, comments, engagement },
    networkEngagement, dow, frequency, lastPostGap, spendByPlatform,
    campaigns, topPosts, growthRate,
    kpis:{
      followers:{ value:fmt(totalFollowers), delta:overallRate },
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

module.exports = { assemble };
