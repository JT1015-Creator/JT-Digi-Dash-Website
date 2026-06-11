/* ============================================================
   JT Digi Dash — DATA LAYER
   A single function getDashboardData(client, days) returns ALL
   the numbers the UI needs. In "demo" mode it generates
   realistic, slightly-changing data. In "live" mode it fetches
   from your backend. The rest of the app never changes.
   ============================================================ */
(function () {
  const CFG = window.JTDD_CONFIG;
  const PLATFORMS = ["instagram", "tiktok", "facebook", "twitter", "linkedin"];
  const PLATFORM_LABEL = { instagram:"Instagram", tiktok:"TikTok", facebook:"Facebook", twitter:"X / Twitter", linkedin:"LinkedIn" };

  /* ---- Default clients (seed). Stored & editable in localStorage. ---- */
  const SEED_CLIENTS = [
    { id:"sprout", name:"Sprout Coffee Co.", budget:120000,
      handles:{ instagram:"@sproutcoffee", tiktok:"@sproutcoffee", facebook:"facebook.com/sproutcoffee", twitter:"@sproutcoffee", linkedin:"company/sprout-coffee" },
      seed:42 },
    { id:"lumen", name:"Lumen Skincare", budget:225000,
      handles:{ instagram:"@lumenskin", tiktok:"@lumen", facebook:"facebook.com/lumenskin", twitter:"", linkedin:"company/lumen" },
      seed:88 },
    { id:"northpeak", name:"NorthPeak Outdoors", budget:75000,
      handles:{ instagram:"@northpeak", tiktok:"", facebook:"facebook.com/northpeak", twitter:"@northpeak", linkedin:"company/northpeak" },
      seed:13 }
  ];

  /* ---------------- client storage ---------------- */
  const SEED_VERSION = "2-zar"; // bump to refresh the built-in demo clients
  const SEED_IDS = SEED_CLIENTS.map(c=>c.id);
  function loadClients(){
    try{
      const stored = JSON.parse(localStorage.getItem("jtdd_clients"));
      if(stored && stored.length){
        if(localStorage.getItem("jtdd_seed_version") === SEED_VERSION) return stored;
        // refresh demo clients but keep any clients the user added themselves
        const custom = stored.filter(c=>!SEED_IDS.includes(c.id));
        const merged = SEED_CLIENTS.concat(custom);
        saveClients(merged);
        localStorage.setItem("jtdd_seed_version", SEED_VERSION);
        return merged;
      }
    }catch(e){}
    localStorage.setItem("jtdd_clients", JSON.stringify(SEED_CLIENTS));
    localStorage.setItem("jtdd_seed_version", SEED_VERSION);
    return SEED_CLIENTS;
  }
  function saveClients(list){ localStorage.setItem("jtdd_clients", JSON.stringify(list)); }

  /* ---------------- seeded RNG (stable per client, drifts over time) ---------------- */
  function makeRng(seed){
    let s = seed % 2147483647; if (s<=0) s+=2147483646;
    return ()=> (s = s*16807 % 2147483647) / 2147483647;
  }
  // small live "jitter" so numbers move a little on each refresh = feels live
  function liveJitter(){ return 0.985 + Math.random()*0.03; }

  function fmt(n){
    if (n>=1e6) return (n/1e6).toFixed(1).replace(/\.0$/,"")+"M";
    if (n>=1e3) return (n/1e3).toFixed(1).replace(/\.0$/,"")+"K";
    return Math.round(n).toLocaleString();
  }
  // money() prefixes the configured currency symbol (default "R" for ZAR)
  const CUR = CFG.CURRENCY_SYMBOL || "R";
  function money(n){ return CUR + fmt(n); }
  function moneyExact(n){ return CUR + Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }

  /* ---------------- DEMO generator ---------------- */
  function demoData(client, days){
    const rng = makeRng((client.seed||7) * 7 + days);
    const labels = [];
    const today = new Date();
    for (let i=days-1;i>=0;i--){ const d=new Date(today); d.setDate(d.getDate()-i);
      labels.push(d.toLocaleDateString(undefined,{month:"short",day:"numeric"})); }

    const base = 4000 + Math.floor(rng()*9000);
    const platformWeight = { instagram:.34, tiktok:.27, facebook:.18, twitter:.11, linkedin:.10 };

    // followers time-series per platform
    const followersByPlatform = {}; let totalFollowers=0, prevTotal=0;
    PLATFORMS.forEach(p=>{
      const has = !!(client.handles && client.handles[p]);
      const start = has ? Math.floor(base*platformWeight[p]*(1+rng())) : 0;
      const series=[]; let v=start;
      for(let i=0;i<days;i++){ v += has ? Math.floor((rng()-0.35)* (start*0.01+12)) : 0; v=Math.max(0,v); series.push(v); }
      followersByPlatform[p]=series;
      totalFollowers += series[series.length-1]*liveJitter();
      prevTotal += series[0];
    });
    totalFollowers=Math.round(totalFollowers);

    // reach + spend timeseries
    // baseCpm = realistic South African paid CPM (Rand per 1,000 reached).
    // Reach is derived from spend at that CPM, plus free "organic" reach,
    // so the top-line CPM stays coherent with the per-campaign CPMs below.
    const reach=[], spend=[]; const dailyBudget=(client.budget||90000)/30;
    const baseCpm = 70 + rng()*70;               // R70–R140 per 1,000 paid reach
    const organicDaily = base*0.8;               // free reach baseline
    for(let i=0;i<days;i++){
      const s = Math.round(dailyBudget*(0.6+rng()*0.9)*liveJitter());
      spend.push(s);
      const paidReach = s / baseCpm * 1000;
      const organic = organicDaily * (0.7+0.6*Math.sin(i/4)) * (0.8+rng()*0.5);
      reach.push(Math.round(paidReach + organic));
    }
    const totalReach = reach.reduce((a,b)=>a+b,0);
    const totalSpend = spend.reduce((a,b)=>a+b,0);

    // engagement funnel
    const views = Math.round(totalReach*0.9*liveJitter());
    const likes = Math.round(views*(0.10+rng()*0.08));
    const shares= Math.round(likes*(0.04+rng()*0.04));
    const comments=Math.round(likes*(0.10+rng()*0.06));
    const engagement = likes+shares+comments;

    // engagement per network
    const networkEngagement = {};
    PLATFORMS.forEach(p=>{ networkEngagement[p]= client.handles&&client.handles[p] ? Math.round(engagement*platformWeight[p]*(0.7+rng()*0.7)) : 0; });

    // active days of week
    const dow=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>({day:d,posts:Math.round(rng()*14)+2}));

    // posting frequency per platform (posts/week)
    const frequency = PLATFORMS.map(p=>({ platform:p, label:PLATFORM_LABEL[p],
      perWeek: client.handles&&client.handles[p] ? +(1+rng()*6).toFixed(1) : 0 }));

    // days since last post (for blind spots)
    const lastPostGap = {}; PLATFORMS.forEach(p=>{ lastPostGap[p]= client.handles&&client.handles[p] ? Math.floor(rng()*16) : 999; });

    // spend by platform
    const adPlatforms=["instagram","facebook","tiktok","twitter"];
    const spendByPlatform = adPlatforms.map(p=>({ platform:p, label:PLATFORM_LABEL[p],
      spend: client.handles&&client.handles[p] ? Math.round(totalSpend*(0.15+rng()*0.4)) : 0 }));
    const spSum = spendByPlatform.reduce((a,b)=>a+b.spend,0)||1;
    spendByPlatform.forEach(s=> s.spend=Math.round(s.spend/spSum*totalSpend));

    // campaigns table
    const campNames=["Spring Launch","Always-On Retargeting","UGC Boost","Lookalike Prospecting","Promo: Free Shipping"];
    const campaigns = campNames.map((n,i)=>{
      const sp=Math.round(totalSpend*[.34,.22,.18,.16,.10][i]);
      const cpm=+(baseCpm*(0.75+rng()*0.6)).toFixed(2);   // around the client CPM
      const rc=Math.round(sp/cpm*1000);
      const roas=+(1.4+rng()*3.4).toFixed(2);
      return { name:n, platform:adPlatforms[i%adPlatforms.length], spend:sp, reach:rc, cpm, roas };
    });

    // top posts
    const captions=["Behind the scenes of our new drop ☕","5 things nobody tells you about…","POV: it's Monday and you've got this","Customer love 💛 swipe to see","We tried it so you don't have to","New arrivals just landed 🚀"];
    const topPosts = captions.map((c,i)=>({
      caption:c, platform:PLATFORMS[i%PLATFORMS.length],
      reach:Math.round(totalReach*(0.04+rng()*0.06)),
      engagement:Math.round(engagement*(0.05+rng()*0.08))
    })).sort((a,b)=>b.engagement-a.engagement);

    // growth rate %
    const growthRate = PLATFORMS.map(p=>{
      const s=followersByPlatform[p]; if(!s[0]) return {platform:p,label:PLATFORM_LABEL[p],rate:0};
      return { platform:p, label:PLATFORM_LABEL[p], rate:+(((s[s.length-1]-s[0])/s[0])*100).toFixed(1) };
    });

    return {
      meta:{ client:client.name, days, generatedAt:new Date() },
      labels, platforms:PLATFORMS, platformLabel:PLATFORM_LABEL,
      followersByPlatform, totalFollowers, prevTotalFollowers:prevTotal,
      reach, totalReach, spend, totalSpend, dailyBudget:Math.round(dailyBudget),
      funnel:{ views, likes, shares, comments, engagement },
      networkEngagement, dow, frequency, lastPostGap, spendByPlatform,
      campaigns, topPosts, growthRate,
      kpis:{
        followers:{ value:fmt(totalFollowers), delta:pct(prevTotal,totalFollowers) },
        reach:{ value:fmt(totalReach), delta:+(rng()*30-8).toFixed(1) },
        spend:{ value:money(totalSpend), delta:+(rng()*24-10).toFixed(1) },
        engagement:{ value:fmt(engagement), delta:+(rng()*40-6).toFixed(1) },
        engRate:{ value:(engagement/(views||1)*100).toFixed(1)+"%", delta:+(rng()*10-3).toFixed(1) },
        cpm:{ value:moneyExact(totalSpend/(totalReach/1000||1)), delta:+(rng()*14-8).toFixed(1) },
        roas:{ value:(1.8+rng()*2.6).toFixed(2)+"x", delta:+(rng()*30-8).toFixed(1) },
        posts:{ value:Math.round(frequency.reduce((a,b)=>a+b.perWeek,0)*(days/7)).toString(), delta:+(rng()*20-6).toFixed(1) }
      }
    };
  }

  function pct(from,to){ if(!from) return 0; return +(((to-from)/from)*100).toFixed(1); }

  /* ---------------- LIVE fetch (uses your backend) ---------------- */
  async function liveData(client, days){
    const url = `${CFG.API_BASE}/api/dashboard?client=${encodeURIComponent(client.id)}&days=${days}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error("Live data request failed: "+res.status);
    return res.json();
  }

  /* ---------------- public ---------------- */
  window.JTDD_DATA = {
    PLATFORMS, PLATFORM_LABEL, fmt, money, moneyExact, CUR, loadClients, saveClients,
    async get(client, days){
      if (CFG.DATA_MODE === "live" && CFG.API_BASE){
        try { return await liveData(client, days); }
        catch(e){ console.warn("[JTDD] live fetch failed, using demo:", e.message); }
      }
      return demoData(client, days);
    }
  };
})();
