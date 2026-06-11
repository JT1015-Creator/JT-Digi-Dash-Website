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

**X (Twitter) is already coded and ready.** The backend in [`/server`](server/) pulls real follower counts, tweets, engagement, reach (impressions), posting frequency and top posts from the **X API v2** and serves them to the dashboard. Other platforms drop in the same way next.

### Switch X on (4 steps)

1. **Get an X Bearer token.** Create a developer app at [developer.x.com](https://developer.x.com) and copy the **Bearer token**.
   > ⚠️ **Cost:** reading analytics requires X's paid **Basic** tier (~US$100/month). The free tier won't return tweet/follower data.

2. **Deploy the backend to Render (free).**
   - Go to [render.com](https://render.com) → **New + → Blueprint** → connect this GitHub repo.
   - Render reads [`render.yaml`](render.yaml) and sets the service up automatically.

3. **Add your token.** In the Render service → **Environment** tab, set:
   - `X_BEARER_TOKEN` = your X Bearer token
   - (`CURRENCY_SYMBOL` is already `R`.)

4. **Point the dashboard at it.** In [`js/config.js`](js/config.js):
   ```js
   DATA_MODE: "live",
   API_BASE:  "https://your-service.onrender.com",   // your Render URL
   ```
   Make sure each client's **X / Twitter** handle is filled in (Accounts tab). Commit & push — GitHub Pages redeploys automatically.

Every chart, KPI, blind-spot and the PDF export keep working — now on real X data. If the backend is ever unreachable, the dashboard quietly falls back to demo data so it never breaks in front of a client.

### Test it locally first (optional)
```bash
cd server
cp .env.example .env        # then paste your token into .env
npm install
npm start
# open http://localhost:8787/api/dashboard?twitter=YourHandle&days=30
npm test                    # runs an offline check with mock data, no token needed
```

### Notes & limits (X specifically)
- X returns a **current** follower count only — so the growth chart builds up from the day you go live (the backend records a daily snapshot in `server/data/`).
- **Reach** uses X's impression count. **Ad spend** is a separate paid X Ads API and shows as not-connected until added.

### Adding the other platforms later
Instagram + Facebook (and Meta ad spend) come from **one** Meta developer app — the best next step. TikTok and LinkedIn each need their own developer app. Each new platform is a small module in `server/platforms/` returning the same normalised data; the assembler in [`server/server.js`](server/server.js) already defines the shape.

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
