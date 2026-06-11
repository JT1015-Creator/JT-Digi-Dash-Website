/* ============================================================
   JT Digi Dash — APP (wires UI <-> data <-> charts)
   ============================================================ */
(function(){
  const CFG = window.JTDD_CONFIG;
  const DATA = window.JTDD_DATA;
  const CH = window.JTDD_CHARTS;
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>[...r.querySelectorAll(s)];

  const PLAT_INITIAL = { instagram:"IG", tiktok:"TT", facebook:"f", twitter:"X", linkedin:"in" };
  const PLAT_COLOR = CH.colors;

  let clients = DATA.loadClients();
  let currentClientId = clients[0].id;
  let currentView = "overview";
  let currentDays = 30;
  let data = null;
  let refreshTimer = null;

  const VIEW_META = {
    overview:{ title:"Overview", sub:"Cross-platform performance at a glance" },
    growth:{ title:"Growth", sub:"Audience growth & reach trends" },
    content:{ title:"Content & Posting", sub:"Frequency, timing and top posts" },
    ads:{ title:"Ad Spend", sub:"Budget, efficiency and campaigns" },
    blindspots:{ title:"Blind Spots", sub:"Gaps & opportunities surfaced from your data" },
    accounts:{ title:"Accounts", sub:"Link & manage client social profiles" }
  };

  /* ---------------- helpers ---------------- */
  const fmt = DATA.fmt;
  const money = DATA.money;
  function deltaHtml(d){
    const up = d>=0; return `<span class="kpi__delta ${up?"up":"down"}">${up?"▲":"▼"} ${Math.abs(d)}%</span>`;
  }
  function kpiCard(label, ico, glow, k){
    return `<div class="kpi" style="--glow:${glow}">
      <div class="kpi__label"><span class="kpi__ico">${ico}</span>${label}</div>
      <div class="kpi__value">${k.value}</div>
      ${deltaHtml(k.delta)}
    </div>`;
  }
  function currentClient(){ return clients.find(c=>c.id===currentClientId) || clients[0]; }

  function toast(msg){
    const t=$("#toast"); t.textContent=msg; t.hidden=false;
    clearTimeout(t._t); t._t=setTimeout(()=>t.hidden=true, 2600);
  }

  /* ---------------- rendering per view ---------------- */
  function renderOverview(){
    $("#kpiGrid").innerHTML =
      kpiCard("Total Followers","👥","rgba(31,182,255,.22)", data.kpis.followers) +
      kpiCard("Total Reach","📡","rgba(126,240,255,.22)", data.kpis.reach) +
      kpiCard("Ad Spend","💸","rgba(123,92,255,.22)", data.kpis.spend) +
      kpiCard("Engagement","❤","rgba(255,107,138,.22)", data.kpis.engagement);

    // total followers series = sum across platforms
    const totalSeries = data.labels.map((_,i)=>
      data.platforms.reduce((sum,p)=> sum + (data.followersByPlatform[p][i]||0), 0));
    CH.growth("chartGrowth", data.labels, totalSeries);
    CH.funnel("chartFunnel", data.funnel);
    CH.network("chartNetwork", data.platformLabel, data.networkEngagement);
    CH.reachSpend("chartReachSpend", data.labels, data.reach, data.spend);
  }

  function renderGrowth(){
    $("#growthKpis").innerHTML =
      kpiCard("Total Followers","👥","rgba(31,182,255,.22)", data.kpis.followers) +
      kpiCard("Reach","📡","rgba(126,240,255,.22)", data.kpis.reach) +
      kpiCard("Engagement Rate","✨","rgba(47,224,138,.22)", data.kpis.engRate);
    CH.growthPlatform("chartGrowthPlatform", data.labels, data.followersByPlatform, data.platformLabel);
    CH.simpleLine("chartReach", data.labels, data.reach, CH.colors.accent);
    const gr = data.growthRate.filter(g=>g.rate!==0);
    CH.bars("chartGrowthRate", gr.map(g=>g.label), gr.map(g=>g.rate),
      gr.map(g=> g.rate>=0?CH.colors.good:CH.colors.bad), {horizontal:true});
  }

  function renderContent(){
    const totalPosts = data.dow.reduce((a,b)=>a+b.posts,0);
    $("#contentKpis").innerHTML =
      kpiCard("Posts (period)","📝","rgba(31,182,255,.22)", data.kpis.posts) +
      kpiCard("Avg / Week","📅","rgba(123,92,255,.22)", {value:(data.frequency.reduce((a,b)=>a+b.perWeek,0)).toFixed(1), delta:data.kpis.posts.delta}) +
      kpiCard("Best Day","🏆","rgba(255,207,92,.22)", {value:data.dow.reduce((a,b)=>b.posts>a.posts?b:a).day, delta:0});

    CH.bars("chartActiveDays", data.dow.map(d=>d.day), data.dow.map(d=>d.posts),
      data.dow.map(()=>CH.colors.brand), {});
    const freq = data.frequency.filter(f=>f.perWeek>0);
    CH.bars("chartFrequency", freq.map(f=>f.label), freq.map(f=>f.perWeek),
      freq.map(f=>CH.colors[f.platform]), {horizontal:true});

    const maxEng = Math.max(...data.topPosts.map(p=>p.engagement));
    $("#topPostsTable").innerHTML =
      `<thead><tr><th>Post</th><th>Platform</th><th>Reach</th><th>Engagement</th><th></th></tr></thead><tbody>` +
      data.topPosts.map(p=>`<tr>
        <td>${p.caption}</td>
        <td><span class="pill pill--${shortP(p.platform)}">${data.platformLabel[p.platform]}</span></td>
        <td>${fmt(p.reach)}</td>
        <td>${fmt(p.engagement)}</td>
        <td><div class="bar-cell"><i style="width:${(p.engagement/maxEng*100).toFixed(0)}%"></i></div></td>
      </tr>`).join("") + `</tbody>`;
  }

  function renderAds(){
    $("#adKpis").innerHTML =
      kpiCard("Total Spend","💸","rgba(123,92,255,.22)", data.kpis.spend) +
      kpiCard("CPM","📊","rgba(31,182,255,.22)", data.kpis.cpm) +
      kpiCard("ROAS","📈","rgba(47,224,138,.22)", data.kpis.roas) +
      kpiCard("Daily Budget","🗓","rgba(255,207,92,.22)", {value:money(data.dailyBudget), delta:0});

    CH.simpleLine("chartSpend", data.labels, data.spend, "#7b5cff");
    const sp = data.spendByPlatform.filter(s=>s.spend>0);
    CH.bars("chartSpendPlatform", sp.map(s=>s.label), sp.map(s=>s.spend),
      sp.map(s=>CH.colors[s.platform]), {});

    $("#campaignTable").innerHTML =
      `<thead><tr><th>Campaign</th><th>Platform</th><th>Spend</th><th>Reach</th><th>CPM</th><th>ROAS</th></tr></thead><tbody>` +
      data.campaigns.map(c=>`<tr>
        <td>${c.name}</td>
        <td><span class="pill pill--${shortP(c.platform)}">${data.platformLabel[c.platform]}</span></td>
        <td>${money(c.spend)}</td>
        <td>${fmt(c.reach)}</td>
        <td>${DATA.CUR}${c.cpm}</td>
        <td style="color:${c.roas==null?'var(--muted)':c.roas>=2?'#2fe08a':'#ffcf5c'};font-weight:600">${c.roas==null?'—':c.roas+'x'}</td>
      </tr>`).join("") + `</tbody>`;
  }

  function renderBlindspots(){
    const issues = computeBlindspots(data);
    $("#blindspotList").innerHTML = issues.map(b=>`
      <div class="blindspot">
        <div class="blindspot__sev sev-${b.sev}">${b.sev==="high"?"⚠":b.sev==="med"?"●":"✓"}</div>
        <div class="blindspot__body"><h4>${b.title}</h4><p>${b.detail}</p></div>
      </div>`).join("");

    // coverage: posts/week per platform (0 = silent)
    const cov = data.frequency.map(f=>f.perWeek);
    CH.bars("chartCoverage", data.frequency.map(f=>f.label), cov,
      data.frequency.map(f=> f.perWeek>0?CH.colors[f.platform]:"rgba(255,107,138,.5)"), {horizontal:true});

    // gaps: days since last post (cap display at 30)
    const gapPlatforms = data.platforms.filter(p=> data.lastPostGap[p] < 900);
    CH.bars("chartGaps", gapPlatforms.map(p=>data.platformLabel[p]),
      gapPlatforms.map(p=>Math.min(data.lastPostGap[p],30)),
      gapPlatforms.map(p=> data.lastPostGap[p]>7?CH.colors.bad: data.lastPostGap[p]>3?CH.colors.warn:CH.colors.good), {});
  }

  function computeBlindspots(d){
    const out=[];
    // silent platforms
    d.platforms.forEach(p=>{
      const connected = !!(currentClient().handles && currentClient().handles[p]);
      if(!connected){
        out.push({sev:"med",title:`No ${d.platformLabel[p]} presence`,
          detail:`This client isn't tracked on ${d.platformLabel[p]}. Competitors may be capturing that audience — consider adding it in Accounts.`});
      } else if(d.lastPostGap[p] > 7){
        out.push({sev:"high",title:`${d.platformLabel[p]} has gone quiet`,
          detail:`${d.lastPostGap[p]} days since the last post. Consistency drives reach — schedule content to recover momentum.`});
      }
    });
    // low engagement rate
    const er = parseFloat(d.kpis.engRate.value);
    if(er < 2) out.push({sev:"med",title:"Engagement rate below benchmark",
      detail:`Engagement rate is ${d.kpis.engRate.value}. Healthy social typically sits above 2–3%. Test more hooks, replies and UGC.`});
    // expensive CPM (ZAR benchmarks: comfortable roughly R80–R150 per 1,000 reached)
    const cpm = parseFloat(d.kpis.cpm.value.replace(/[^\d.]/g,""));
    if(cpm > 150) out.push({sev:"high",title:"Ad reach is getting expensive",
      detail:`CPM is ${DATA.CUR}${cpm.toFixed(2)} — above the ~${DATA.CUR}80–${DATA.CUR}150 comfort zone. Refresh creative or tighten audiences to lower cost per 1,000 reached.`});
    // weak ROAS campaigns
    const weak = d.campaigns.filter(c=>c.roas < 1.6);
    if(weak.length) out.push({sev:"high",title:`${weak.length} campaign(s) below break-even ROAS`,
      detail:`${weak.map(c=>c.name).join(", ")} returning under 1.6x. Pause or rework before they drain budget.`});
    // posting imbalance
    const active = d.frequency.filter(f=>f.perWeek>0);
    if(active.length){
      const max=Math.max(...active.map(f=>f.perWeek)), min=Math.min(...active.map(f=>f.perWeek));
      if(max > min*3) out.push({sev:"low",title:"Uneven posting across platforms",
        detail:`Posting is concentrated on one channel. Spreading content more evenly reduces single-platform risk.`});
    }
    if(!out.length) out.push({sev:"low",title:"No major blind spots detected",
      detail:"All tracked platforms are active, ad costs are healthy and engagement is on benchmark. Keep it up."});
    return out.sort((a,b)=>({high:0,med:1,low:2})[a.sev]-({high:0,med:1,low:2})[b.sev]);
  }

  function renderAccounts(){
    const c = currentClient();
    $("#accountsGrid").innerHTML = DATA.PLATFORMS.map(p=>{
      const handle = c.handles && c.handles[p];
      const on = !!handle;
      return `<div class="acct">
        <div class="acct__ico" style="background:${PLAT_COLOR[p]}">${PLAT_INITIAL[p]}</div>
        <div><div class="acct__name">${data.platformLabel[p]}</div>
        <div class="acct__handle">${handle || "Not linked"}</div></div>
        <div class="acct__status ${on?"":"off"}">${on?"● Tracking":"○ Off"}</div>
      </div>`;
    }).join("");

    $("#howtoBox").innerHTML = `
      <p>Right now the dashboard runs in <strong>Demo mode</strong> — realistic data that auto-refreshes so you can present to clients immediately.</p>
      <p><strong>All five platforms are built &amp; ready:</strong> Instagram, Facebook + ad spend (Meta), TikTok, LinkedIn — all <em>free APIs</em> — and X / Twitter (pay-per-use). To go live:</p>
      <ol>
        <li>Deploy the backend in <code>/server</code> — one click via the included <code>render.yaml</code> on <strong>Render</strong>. See <code>README.md</code> → “Going live”.</li>
        <li>Get tokens for the platforms you want and add them as environment variables in Render (never in the website files):
          <ul>
            <li><strong>Meta</strong> <code>META_TOKEN</code> (IG + FB + ads), <strong>TikTok</strong> <code>TIKTOK_ACCESS_TOKEN</code>, <strong>LinkedIn</strong> <code>LINKEDIN_TOKEN</code> + <code>LINKEDIN_ORG_ID</code> — all free.</li>
            <li><strong>X</strong> <code>X_BEARER_TOKEN</code> from <code>developer.x.com</code> — <em>pay-per-use; smart caching keeps it ~R25–R50/client/mo.</em></li>
          </ul>
        </li>
        <li>In <code>js/config.js</code> set <code>DATA_MODE: "live"</code> and <code>API_BASE</code> to your Render URL. Fill in each client's handles above. Managing several clients on one platform? Add their IDs/tokens under “Advanced” when adding a client.</li>
      </ol>
      <p>That's it — every chart, KPI, blind-spot and the PDF keep working, now on real data. If the backend is ever unreachable, the dashboard quietly falls back to demo data so it never breaks in front of a client.</p>
      <p style="color:var(--muted2)">Notes: a built-in cache polls each account about twice a day (set by <code>CACHE_TTL_HOURS</code>) so costs stay low no matter how often the dashboard refreshes. Follower-growth charts build up from the day you go live (daily snapshots). LinkedIn shows account-level totals (its API doesn't expose per-post data); TikTok/X ad spend need their separate ad APIs.</p>`;
  }

  function shortP(p){ return {instagram:"ig",tiktok:"tt",facebook:"fb",twitter:"tw",linkedin:"li"}[p]||"ig"; }

  /* ---------------- master render ---------------- */
  async function refresh(showToast){
    const c = currentClient();
    data = await DATA.get(c, currentDays);
    const r = {overview:renderOverview, growth:renderGrowth, content:renderContent,
               ads:renderAds, blindspots:renderBlindspots, accounts:renderAccounts}[currentView];
    if(r) r();
    $("#lastUpdated").textContent = "Updated " + new Date().toLocaleTimeString();
    $("#dataMode").textContent = CFG.DATA_MODE==="live" ? "Live" : "Demo (live-simulated)";
    if(showToast) toast("Data refreshed");
  }

  function switchView(v){
    currentView = v;
    $$(".nav__item").forEach(b=>b.classList.toggle("is-active", b.dataset.view===v));
    $$(".view").forEach(s=>s.classList.toggle("is-active", s.dataset.view===v));
    $("#viewTitle").textContent = VIEW_META[v].title;
    $("#viewSubtitle").textContent = VIEW_META[v].sub;
    $("#sidebar").classList.remove("open");
    CH.destroyAll();
    refresh(false);
  }

  /* ---------------- client select ---------------- */
  function fillClientSelect(){
    $("#clientSelect").innerHTML = clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
    $("#clientSelect").value = currentClientId;
  }

  /* ---------------- modal (add client) ---------------- */
  function openClientModal(){
    ["name","instagram","tiktok","facebook","twitter","linkedin","budget","instagram_id","facebook_page_id","meta_ad_account_id","linkedin_org_id","tiktok_token","tiktok_advertiser_id"].forEach(f=>{ const el=$("#f_"+f); if(el) el.value=""; });
    $("#clientModal").hidden=false;
  }
  function saveClient(){
    const name = $("#f_name").value.trim();
    if(!name){ toast("Please enter a client name"); return; }
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,24)+"-"+Math.random().toString(36).slice(2,5);
    const client = { id, name,
      budget: parseInt($("#f_budget").value)||90000,
      handles:{
        instagram:$("#f_instagram").value.trim(), tiktok:$("#f_tiktok").value.trim(),
        facebook:$("#f_facebook").value.trim(), twitter:$("#f_twitter").value.trim(),
        linkedin:$("#f_linkedin").value.trim(),
        instagram_id:$("#f_instagram_id").value.trim(),
        facebook_page_id:$("#f_facebook_page_id").value.trim(),
        meta_ad_account_id:$("#f_meta_ad_account_id").value.trim(),
        linkedin_org_id:$("#f_linkedin_org_id").value.trim(),
        tiktok_token:$("#f_tiktok_token").value.trim(),
        tiktok_advertiser_id:$("#f_tiktok_advertiser_id").value.trim() },
      seed: Math.floor(Math.random()*200)+1 };
    clients.push(client); DATA.saveClients(clients);
    currentClientId = id; fillClientSelect();
    $("#clientModal").hidden=true; toast("Client added: "+name);
    refresh(false);
  }

  /* ---------------- refresh loop ---------------- */
  function startLoop(){
    if(refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(()=>refresh(false), CFG.REFRESH_MS||15000);
  }

  /* ---------------- events ---------------- */
  function bind(){
    $$(".nav__item").forEach(b=> b.addEventListener("click", ()=>switchView(b.dataset.view)));
    $("#clientSelect").addEventListener("change", e=>{ currentClientId=e.target.value; refresh(false); });
    $("#rangeSelect").addEventListener("change", e=>{ currentDays=+e.target.value; CH.destroyAll(); refresh(false); });
    $("#refreshBtn").addEventListener("click", ()=>refresh(true));
    $("#menuToggle").addEventListener("click", ()=> $("#sidebar").classList.toggle("open"));
    $("#addClientBtn").addEventListener("click", openClientModal);
    $("#clientModalClose").addEventListener("click", ()=> $("#clientModal").hidden=true);
    $("#clientCancel").addEventListener("click", ()=> $("#clientModal").hidden=true);
    $("#clientSave").addEventListener("click", saveClient);
    $("#exportDataBtn").addEventListener("click", ()=>{
      const blob=new Blob([JSON.stringify(clients,null,2)],{type:"application/json"});
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
      a.download="jtdd-clients.json"; a.click(); toast("Client data exported");
    });
    $("#pdfBtn").addEventListener("click", async ()=>{
      const btn=$("#pdfBtn"); const old=btn.textContent; btn.textContent="Generating…"; btn.disabled=true;
      try{ await window.JTDD_PDF.exportPDF(currentClient().name, VIEW_META[currentView].title); toast("PDF downloaded"); }
      catch(e){ console.error(e); toast("PDF failed — see console"); }
      finally{ btn.textContent=old; btn.disabled=false; }
    });
  }

  /* ---------------- init ---------------- */
  function init(){
    const logo = $(".brand__logo");
    if(logo){
      logo.onerror = ()=>{ logo.onerror=null; logo.src = "assets/logo.svg"; }; // fall back if agency logo missing
      if(CFG.LOGO) logo.src = CFG.LOGO;
    }
    fillClientSelect();
    bind();
    switchView("overview");
    startLoop();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
