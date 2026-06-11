/* ============================================================
   Caching + follower snapshots.
   ------------------------------------------------------------
   WHY THIS MATTERS (cost control):
   The dashboard auto-refreshes every 15s. Without caching that
   would hammer the X API (which bills per read). This layer
   fetches each platform AT MOST once per CACHE_TTL window and
   serves the cached copy to every refresh in between — so a
   client's X cost stays at roughly one poll per day, not
   thousands. Free APIs (Meta/TikTok) also get faster + gentler.

   CACHE_TTL_HOURS env var controls the window (default 12h ->
   ~2 polls/day per platform). Set to 24 for ~1 poll/day.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { dayKey } = require("./util");

const DATA_DIR  = path.join(__dirname, "..", "data");
const CACHE_FILE = path.join(DATA_DIR, "cache.json");
const SNAP_FILE  = path.join(DATA_DIR, "snapshots.json");
const TTL_MS = (parseFloat(process.env.CACHE_TTL_HOURS) || 12) * 3600 * 1000;

function ensureDir(){ try{ fs.mkdirSync(DATA_DIR,{recursive:true}); }catch(e){} }
function readJSON(file){ try{ return JSON.parse(fs.readFileSync(file,"utf8")); }catch(e){ return {}; } }
function writeJSON(file,obj){ ensureDir(); try{ fs.writeFileSync(file, JSON.stringify(obj)); }catch(e){ console.warn("write failed",file,e.message); } }

// in-memory mirror so we don't hit disk every request
let _cache = readJSON(CACHE_FILE);

/* getOrFetch(key, fetchFn) -> returns cached value if fresh,
   otherwise awaits fetchFn(), stores it, and returns it.
   force=true bypasses the cache (manual refresh). */
async function getOrFetch(key, fetchFn, force=false){
  const now = Date.now();
  const hit = _cache[key];
  if(!force && hit && (now - hit.ts) < TTL_MS){
    return { data: hit.data, cached:true, ageMs: now-hit.ts };
  }
  const data = await fetchFn();
  _cache[key] = { ts: now, data };
  writeJSON(CACHE_FILE, _cache);
  return { data, cached:false, ageMs:0 };
}

/* Record today's follower count so we can build growth-over-time
   for platforms (like X) that only return a current snapshot. */
function recordFollowers(platform, handle, value){
  if(value==null) return readFollowerHistory(platform, handle);
  const snaps = readJSON(SNAP_FILE);
  const k = `${platform}:${handle}`;
  snaps[k] = snaps[k] || {};
  snaps[k][dayKey(new Date())] = value;
  writeJSON(SNAP_FILE, snaps);
  return snaps[k];
}
function readFollowerHistory(platform, handle){
  const snaps = readJSON(SNAP_FILE);
  return snaps[`${platform}:${handle}`] || {};
}

module.exports = { getOrFetch, recordFollowers, readFollowerHistory, TTL_MS };
