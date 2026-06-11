/* ============================================================
   JT Digi Dash — CHARTS (Chart.js wrappers)
   ============================================================ */
(function(){
  const COLORS = { brand:"#1fb6ff", brand2:"#7b5cff", accent:"#7ef0ff",
    instagram:"#e1306c", tiktok:"#25f4ee", facebook:"#1877f2", twitter:"#1da1f2", linkedin:"#0a66c2",
    good:"#2fe08a", warn:"#ffcf5c", bad:"#ff6b8a", grid:"rgba(255,255,255,.06)", tick:"#8aa0c6" };

  const charts = {}; // id -> Chart instance

  if (window.Chart){
    Chart.defaults.color = COLORS.tick;
    Chart.defaults.font.family = "Inter, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
  }

  function destroy(id){ if(charts[id]){ charts[id].destroy(); delete charts[id]; } }
  function ctx(id){ const el=document.getElementById(id); return el ? el.getContext("2d") : null; }
  function grad(c, from, to){
    const g=c.createLinearGradient(0,0,0,260); g.addColorStop(0,from); g.addColorStop(1,to); return g;
  }
  // "#7b5cff" -> "rgba(123,92,255,a)"  (accepts hex or rgb/rgba, returns valid rgba)
  function rgba(color, a){
    if(color[0]==="#"){
      let h=color.slice(1); if(h.length===3) h=h.split("").map(x=>x+x).join("");
      const n=parseInt(h,16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
    }
    return color.replace(/^rgb\(/,"rgba(").replace(/\)$/,`,${a})`);
  }
  const baseScales = (extra={}) => ({
    x:{ grid:{display:false}, ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:8} },
    y:{ grid:{color:COLORS.grid}, ticks:{padding:8} },
    ...extra
  });
  const noLegend = { plugins:{ legend:{display:false} } };

  function line(id, labels, datasets, opts={}){
    const c=ctx(id); if(!c) return; destroy(id);
    charts[id]=new Chart(c,{ type:"line", data:{labels,datasets},
      options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:"index",intersect:false},
        plugins:{ legend:{display:opts.legend!==false, position:"top", align:"end"},
          tooltip:{backgroundColor:"#0e1626",borderColor:"#22304d",borderWidth:1,padding:10} },
        scales: baseScales(opts.scales||{}), ...opts.extra } });
  }

  const C = window.JTDD_CHARTS = {
    colors: COLORS,
    destroyAll(){ Object.keys(charts).forEach(destroy); },

    growth(id, labels, totalSeries){
      const c=ctx(id); if(!c) return; destroy(id);
      line(id, labels, [{
        label:"Followers", data:totalSeries, borderColor:COLORS.brand,
        backgroundColor:grad(c,"rgba(31,182,255,.35)","rgba(31,182,255,0)"),
        fill:true, tension:.4, pointRadius:0, borderWidth:2.5
      }], {legend:false});
    },

    funnel(id, f){
      const c=ctx(id); if(!c) return; destroy(id);
      charts[id]=new Chart(c,{ type:"bar",
        data:{ labels:["Views","Likes","Shares","Comments"],
          datasets:[{ data:[f.views,f.likes,f.shares,f.comments],
            backgroundColor:[COLORS.brand,COLORS.brand2,COLORS.accent,COLORS.good], borderRadius:8, maxBarThickness:64 }] },
        options:{ responsive:true,maintainAspectRatio:false, ...noLegend,
          scales: baseScales({y:{type:"logarithmic",grid:{color:COLORS.grid}}}) } });
    },

    network(id, labelMap, data){
      const c=ctx(id); if(!c) return; destroy(id);
      const entries=Object.entries(data).filter(([k,v])=>v>0);
      charts[id]=new Chart(c,{ type:"doughnut",
        data:{ labels:entries.map(([k])=>labelMap[k]),
          datasets:[{ data:entries.map(([k,v])=>v), borderWidth:0,
            backgroundColor:entries.map(([k])=>COLORS[k]||COLORS.brand) }] },
        options:{ responsive:true,maintainAspectRatio:false, cutout:"62%",
          plugins:{legend:{position:"right"}} } });
    },

    reachSpend(id, labels, reach, spend){
      const c=ctx(id); if(!c) return; destroy(id);
      charts[id]=new Chart(c,{ data:{ labels, datasets:[
        { type:"line", label:"Reach", data:reach, yAxisID:"y", borderColor:COLORS.accent,
          backgroundColor:grad(c,"rgba(126,240,255,.25)","rgba(126,240,255,0)"), fill:true, tension:.4, pointRadius:0, borderWidth:2 },
        { type:"bar", label:"Ad spend ("+((window.JTDD_CONFIG&&window.JTDD_CONFIG.CURRENCY_SYMBOL)||"R")+")", data:spend, yAxisID:"y1", backgroundColor:"rgba(123,92,255,.6)", borderRadius:5, maxBarThickness:14 }
      ]},
      options:{ responsive:true,maintainAspectRatio:false, interaction:{mode:"index",intersect:false},
        plugins:{legend:{position:"top",align:"end"}},
        scales:{ x:{grid:{display:false}}, y:{position:"left",grid:{color:COLORS.grid}}, y1:{position:"right",grid:{display:false}} } } });
    },

    growthPlatform(id, labels, byPlatform, labelMap){
      const c=ctx(id); if(!c) return; destroy(id);
      const ds=Object.entries(byPlatform).filter(([k,s])=>s.some(v=>v>0)).map(([k,s])=>({
        label:labelMap[k], data:s, borderColor:COLORS[k], backgroundColor:"transparent",
        tension:.4, pointRadius:0, borderWidth:2.5 }));
      line(id, labels, ds, {});
    },

    simpleLine(id, labels, data, color){
      const c=ctx(id); if(!c) return; destroy(id);
      line(id, labels, [{ label:"", data, borderColor:color,
        backgroundColor:grad(c, rgba(color,.25), rgba(color,0)),
        fill:true, tension:.4, pointRadius:0, borderWidth:2 }], {legend:false});
    },

    bars(id, labels, data, colors, opts={}){
      const c=ctx(id); if(!c) return; destroy(id);
      charts[id]=new Chart(c,{ type:opts.horizontal?"bar":"bar",
        data:{ labels, datasets:[{ data, backgroundColor:colors, borderRadius:7, maxBarThickness:opts.thick||46,
          label:opts.label||"" }] },
        options:{ responsive:true,maintainAspectRatio:false, indexAxis:opts.horizontal?"y":"x", ...noLegend,
          scales: opts.horizontal ? {x:{grid:{color:COLORS.grid}},y:{grid:{display:false}}} : baseScales() } });
    }
  };
})();
