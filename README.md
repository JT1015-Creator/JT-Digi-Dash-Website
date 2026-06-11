# JT Digi Dash — Social & Ad Spend Dashboard

A live, interactive dashboard that tracks **growth, posting frequency, ad spend, reach and blind spots** across your clients' social media accounts — and exports any view to **PDF** with one click.

![view: overview / growth / content / ads / blind spots / accounts]

---

## ✨ What it does

- **Overview** — total followers, reach, ad spend & engagement, plus growth, an engagement funnel, per-network share and a reach-vs-spend chart.
- **Growth** — follower growth per platform, reach trend, growth-rate %.
- **Content & Posting** — most active days, posting frequency per platform, top-performing posts.
- **Ad Spend** — spend over time, spend by platform, full campaign table with CPM & ROAS.
- **Blind Spots** — automatically flags quiet platforms, expensive ad costs, weak campaigns and low engagement.
- **Accounts** — link each client's Instagram / TikTok / Facebook / X / LinkedIn handles; add unlimited clients.
- **Live feel** — auto-refreshes every 15 seconds.
- **PDF export** — download whatever's on screen as a clean, branded PDF.

It works in **two modes**:

| Mode | Setup | Use it for |
|------|-------|-----------|
| **Demo** (default) | None — just open it | Showing clients, presentations, day-to-day reporting |
| **Live** | Deploy the backend + add API tokens | Pulling real numbers from the actual accounts |

---

## 🚀 Run it right now (no setup)

**Easiest:** double-click `index.html`.

Or serve it locally (recommended, so PDF export works perfectly):

```bash
npx serve .
```

Then open the URL it prints (usually http://localhost:3000).

---

## 🌐 Put it online for free (GitHub Pages)

Once this repo is on GitHub:

1. Go to the repo on **github.com → Settings → Pages**.
2. Under **Build and deployment → Source**, pick **Deploy from a branch**.
3. Branch: **main**, folder: **/ (root)** → **Save**.
4. Wait ~1 minute. Your dashboard is live at
   `https://<your-username>.github.io/JT-Digi-Dash-Website/`

Share that link with anyone.

---

## ➕ Adding clients

Open the **Accounts** tab → **+ Add Client**. Enter the brand name, their social handles and a monthly ad budget. Clients are saved in your browser. Use **Export client data** to back them up as a file.

---

## 🔌 Going live with real data

**Two integrations are built, tested and ready:**

- **Meta — Instagram + Facebook + ad spend** ([`server/platforms/meta.js`](server/platforms/meta.js)). **Free API.** One Graph API token covers followers, posts, engagement, account reach, and ad spend (split by Instagram vs Facebook) with per-campaign breakdowns.
- **X / Twitter** ([`server/platforms/twitter.js`](server/platforms/twitter.js)). Followers, tweets, engagement, reach (impressions), posting frequency, top posts. **Pay-per-use** API.

A **built-in cache** ([`server/lib/cache.js`](server/lib/cache.js)) polls each account only about twice a day no matter how often the dashboard refreshes — this is what keeps X's pay-per-use cost down to roughly **R25–R50/client/month**.

### Switch on (4 steps)

1. **Get your tokens.**
   - **Meta:** create an app at [developers.facebook.com](https://developers.facebook.com), connect the client's Instagram **Business** account + Facebook Page, and generate a **long-lived access token**. (Free.)
   - **X:** create an app at [developer.x.com](https://developer.x.com) and copy the **Bearer token**.
     > ⚠️ **X cost:** as of 2026 X reading is **pay-per-use** (≈$0.005/post read). The cache keeps this small, but it isn't free like Meta.

2. **Deploy the backend to Render.** [render.com](https://render.com) → **New + → Blueprint** → connect this GitHub repo. Render reads [`render.yaml`](render.yaml) and sets everything up (including a small disk for follower history).

3. **Add your tokens** in the Render service → **Environment** tab: `META_TOKEN` and/or `X_BEARER_TOKEN`. (`CURRENCY_SYMBOL=R` and `CACHE_TTL_HOURS=12` are already set.)

4. **Point the dashboard at it.** In [`js/config.js`](js/config.js):
   ```js
   DATA_MODE: "live",
   API_BASE:  "https://your-service.onrender.com",
   ```
   Fill in each client's handles (Accounts tab). If you manage **several** Meta clients, add their **IDs** under *Add Client → Advanced* (Instagram Business ID, Page ID, Ad Account ID) so the backend targets the right accounts. Commit & push — GitHub Pages redeploys automatically.

Every chart, KPI, blind-spot and the PDF keep working — now on real data. If the backend is ever unreachable, the dashboard quietly falls back to demo data so it never breaks in front of a client.

### Test it locally first (optional)
```bash
cd server
cp .env.example .env        # paste your token(s) into .env
npm install
npm start                   # http://localhost:8787/health  shows which tokens are set
npm test                    # offline check with mock data — no tokens/network needed
```

### How cost stays low
`CACHE_TTL_HOURS` controls how often real APIs are actually called (default 12h ≈ twice a day). Raise it to 24 for ~once a day (cheapest). Every dashboard refresh in between is served from cache — zero API calls.

### Notes & limits
- Follower **growth** charts build up from the day you go live (APIs give a current count only; the backend snapshots daily into `server/data/`).
- **ROAS** shows “—”: ad platforms report spend/reach but not revenue, so true ROAS needs your sales data (a future add-on).
- **TikTok** and **LinkedIn** drop in the same way next — a module in `server/platforms/` returning the same normalised shape; [`server/assemble.js`](server/assemble.js) already merges any combination of platforms.

> **Why the developer-app steps?** Each platform requires its own approved app and access token to read account data — their security rule, not the dashboard's. Demo mode lets you use and present everything today while you arrange that access.

---

## 🗂 Project structure

```
JT-Digi-Dash-Website/
├─ index.html         the dashboard page
├─ css/styles.css     all styling
├─ js/
│  ├─ config.js       ← the one file you edit (mode, brand, API URL)
│  ├─ data.js         demo data generator + live fetch
│  ├─ charts.js       all charts (Chart.js)
│  ├─ pdf.js          PDF export
│  └─ app.js          wires everything together
├─ assets/logo.svg
└─ server/            optional backend for live data
```

---

## 🛠 Built with

Plain HTML/CSS/JS · [Chart.js](https://www.chartjs.org/) · [jsPDF](https://github.com/parallax/jsPDF) · [html2canvas](https://html2canvas.hertzen.com/). No build step, no framework — easy to host anywhere.
