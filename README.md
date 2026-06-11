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

## 🔌 Going live with real data (optional, advanced)

The dashboard already has everything wired — you only need to feed it real numbers.

1. **Deploy the backend** in [`/server`](server/) to a free host (Render, Railway or Vercel). It's a tiny Node/Express app exposing `GET /api/dashboard`.
2. **Get API access tokens** for each platform you want real data from:
   - Instagram & Facebook → **Meta Graph API** (Business account + Page token)
   - TikTok → **TikTok for Business / Display API**
   - X/Twitter → **X API v2** (Bearer token)
   - LinkedIn → **LinkedIn Marketing API**
   - Ads → **Meta Marketing API** / **TikTok Ads API**
3. **Store tokens as environment variables** on your host (never in the code). Names are listed in [`server/server.js`](server/server.js).
4. **Fill in the fetcher functions** in `server/server.js` so they return the same JSON shape the demo uses (see `demoData()` in [`js/data.js`](js/data.js)).
5. In [`js/config.js`](js/config.js) set:
   ```js
   DATA_MODE: "live",
   API_BASE:  "https://your-backend-url.com",
   ```

That's it — every chart, KPI and the PDF export keep working unchanged.

> **Why the extra steps?** Each social platform requires its own approved developer app and access token to read private account data — that's their security rule, not the dashboard's. The demo mode lets you use and demo everything today while you arrange that access.

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
