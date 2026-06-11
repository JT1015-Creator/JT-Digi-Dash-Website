/* Shared helpers for the JT Digi Dash backend. */
const CUR = process.env.CURRENCY_SYMBOL || "R";

const PLATFORMS = ["instagram","tiktok","facebook","twitter","linkedin"];
const PLATFORM_LABEL = { instagram:"Instagram", tiktok:"TikTok", facebook:"Facebook", twitter:"X / Twitter", linkedin:"LinkedIn" };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function fmt(n){
  n = Number(n)||0;
  if(n>=1e6) return (n/1e6).toFixed(1).replace(/\.0$/,"")+"M";
  if(n>=1e3) return (n/1e3).toFixed(1).replace(/\.0$/,"")+"K";
  return Math.round(n).toLocaleString();
}
const money = n => CUR + fmt(n);
const moneyExact = n => CUR + (Number(n)||0).toLocaleString("en-ZA",{minimumFractionDigits:2,maximumFractionDigits:2});

function dayKey(d){ return new Date(d).toISOString().slice(0,10); }
function label(d){ d=new Date(d); return `${MONTHS[d.getMonth()]} ${d.getDate()}`; }
function lastNDates(days){
  const out=[]; const today=new Date();
  for(let i=days-1;i>=0;i--){ const d=new Date(today); d.setDate(d.getDate()-i); out.push(d); }
  return out;
}

module.exports = { CUR, PLATFORMS, PLATFORM_LABEL, MONTHS, DOW, fmt, money, moneyExact, dayKey, label, lastNDates };
