/* ============================================================
   JT Digi Dash — CONFIG
   This is the ONLY file you normally need to touch.
   ============================================================ */
window.JTDD_CONFIG = {

  /* ---------------------------------------------------------
     DATA MODE
     "demo" -> realistic, auto-updating sample data (works now,
               no setup, great for showing clients).
     "live" -> pulls from your backend at API_BASE (see server/).
     --------------------------------------------------------- */
  DATA_MODE: "demo",

  /* Where your live-data backend lives once deployed.
     Leave as-is until you deploy the server in /server. */
  API_BASE: "",

  /* How often the dashboard refreshes itself (milliseconds). */
  REFRESH_MS: 15000,

  /* Branding — change freely. */
  BRAND_NAME: "JT Digi Dash",
  AGENCY_NAME: "TEN15 J.T. Digital Agency",
  LOGO: "assets/logo.png",   /* your agency logo (falls back to logo.svg if missing) */

  /* Currency shown on all money values. "R" = South African Rand (ZAR). */
  CURRENCY_SYMBOL: "R",
  CURRENCY_CODE: "ZAR",

  /* ---------------------------------------------------------
     PLATFORM ACCESS TOKENS (for "live" mode only)
     These are read by the backend in /server, NOT the browser.
     Never paste real secrets into front-end files that ship to
     GitHub Pages. Put them in the server's environment instead.
     Listed here only as documentation of what you'll need.
     --------------------------------------------------------- */
  REQUIRED_FOR_LIVE: {
    instagram: "Meta Graph API token (Instagram Business account)",
    facebook:  "Meta Graph API token (Page access token)",
    tiktok:    "TikTok for Business / Display API token",
    twitter:   "X (Twitter) API v2 Bearer token",
    linkedin:  "LinkedIn Marketing API token",
    ads_meta:  "Meta Ads (Marketing API) token",
    ads_tiktok:"TikTok Ads API token"
  }
};
