# Getting your Meta token (Instagram + Facebook + ad spend)

This produces a **long-lasting** `META_TOKEN` for the JT Digi Dash backend. One token
covers Instagram, Facebook and Meta ad spend for a client.

> ⏱️ ~20–30 minutes the first time. After this, adding another client is quick.

---

## ✅ Before you start — the prerequisites (do these first!)

A token only works if the accounts are set up right:

1. **The client's Instagram is a Business or Creator account** (not personal).
   *In the Instagram app → Settings → Account type → switch to Business/Creator.*
2. **That Instagram is linked to a Facebook Page.**
   *Facebook Page → Settings → Linked accounts → Instagram → connect.*
3. **You are an Admin** of that Facebook Page.
4. **The Page + Ad account live in a Meta Business Portfolio** (Business Manager) at
   **[business.facebook.com](https://business.facebook.com)**. If you don't have one, create one (free) and add the Page and Ad account to it.

If all four are true, continue. 👇

---

## Step 1 — Create a developer app (once)

1. Go to **[developers.facebook.com](https://developers.facebook.com)** → log in → **My Apps** → **Create App**.
2. Use case: choose **Other** → **Next**.
3. App type: **Business** → **Next**.
4. Name it (e.g. *JT Digi Dash*) → **Create app**. Done — you don't need to add any products.

---

## Step 2 — Create a System User and a long-lasting token

This is the part that gives you a token that won't expire on you.

1. Go to **[business.facebook.com/settings](https://business.facebook.com/settings)** (Business Settings).
2. Left menu → **Users → System users** → **Add**.
   - Name: *JT Digi Dash* · Role: **Admin** → **Create system user**.
3. With that system user selected, click **Add Assets** and assign:
   - **Pages** → the client's Page → toggle **Full control** (or at least *View Page performance*).
   - **Ad accounts** → the client's ad account → **View performance** (for ad spend).
   - **Apps** → the app you made in Step 1 → **Manage**.
   - (If **Instagram accounts** is listed as an asset, add the client's IG too.)
   - **Save changes.**
4. Click **Generate new token**.
   - **App:** pick your Step-1 app.
   - **Token expiration:** choose **Never** (or 60 days).
   - **Permissions — tick these:**
     - `pages_show_list`
     - `pages_read_engagement`
     - `read_insights`
     - `instagram_basic`
     - `instagram_manage_insights`
     - `ads_read`
     - `business_management`
   - **Generate token.**
5. **Copy the token now** (it's shown only once). This long string is your **`META_TOKEN`**.

---

## Step 3 — (For ad spend) find your Ad Account ID

1. Still in Business Settings → **Accounts → Ad accounts**.
2. Click the client's ad account. The ID is the number shown, like **`act_1234567890`**.
3. You'll put this in the dashboard later (it's optional — organic IG/FB data works without it).

> The **Page ID** and **Instagram ID** are found automatically from your token — you don't need to hunt for them.

---

## Step 4 — Put the token into Render

1. Render → your **jt-digi-dash-api** service → **Environment**.
2. **➕ Add variable** → KEY: `META_TOKEN` → VALUE: paste the token → **Save Changes**.
3. (Optional, for ad spend) **➕ Add variable** → KEY: `META_AD_ACCOUNT_ID` → VALUE: `act_1234567890`.
4. Render redeploys (~1 min).

## Step 5 — Check + go live

- Open **https://jt-digi-dash-api.onrender.com/health** → you should see `"hasMetaToken":true`. ✅
- Tell Claude **"tokens added"** and it flips the dashboard to live.
- In the dashboard's **Accounts** tab, make sure the client's **Instagram** and **Facebook** handles are filled in.

---

## Troubleshooting

| You see… | Fix |
|---|---|
| `hasMetaToken:false` on /health | Token didn't save — re-add the `META_TOKEN` variable and Save. |
| `Meta API: ... permission` error | A scope wasn't ticked in Step 2.4, or the asset wasn't assigned in Step 2.3. Regenerate the token. |
| No Instagram data, Facebook works | The IG account isn't a Business account, or isn't linked to the Page (prerequisites 1–2). |
| Token stops working after weeks | You picked 60-day expiry — regenerate with **Never**, or just regenerate when needed. |
| Multiple clients | Repeat for each client's assets. Give each client their own IDs in the dashboard's **Add Client → Advanced** so the right accounts are read. |
