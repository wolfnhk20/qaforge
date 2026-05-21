# QAForge setup: Supabase auth & GitHub webhooks

Production URLs:

| Service | URL |
|---------|-----|
| Frontend | https://qaforge-jet.vercel.app |
| Backend | https://qaforge-api.onrender.com |

Webhook endpoint (GitHub delivers push events here):

```text
https://qaforge-api.onrender.com/webhook/github
```

---

## 1. Frontend environment (`.env.local`)

```bash
cd qa-web
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase **Project URL**, **anon key**, and API URL.

For **Vercel**, set the same three variables in **Project → Settings → Environment Variables**, then redeploy.

| Variable | Where to find it |
|----------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` key |
| `NEXT_PUBLIC_API_URL` | `https://qaforge-api.onrender.com` (or `http://localhost:8000` locally) |

---

## 2. Supabase: GitHub authentication

QAForge uses **Supabase Auth** with the **GitHub** provider and PKCE. The frontend requests scopes `repo` and `write:repo_hook` so users can list repositories, read code, and register webhooks.

### 2.1 Create a GitHub OAuth App

1. Open [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers).
2. **New OAuth App**
3. Fill in:

   | Field | Value |
   |-------|--------|
   | Application name | `QAForge` (or your choice) |
   | Homepage URL | `https://qaforge-jet.vercel.app` |
   | Authorization callback URL | See step 2.2 below |

4. Create the app, then generate a **Client secret**.

### 2.2 Callback URL (must match Supabase)

In **Supabase Dashboard → Authentication → Providers → GitHub**, copy the **Callback URL (for OAuth)**. It looks like:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

Paste that exact URL into your GitHub OAuth App **Authorization callback URL**.

### 2.3 Enable GitHub in Supabase

1. **Authentication → Providers → GitHub** → Enable.
2. Paste **Client ID** and **Client secret** from the GitHub OAuth App.
3. Save.

### 2.4 URL configuration

**Authentication → URL Configuration**

| Setting | Production | Local dev |
|---------|------------|-----------|
| Site URL | `https://qaforge-jet.vercel.app` | `http://localhost:3000` |
| Redirect URLs | `https://qaforge-jet.vercel.app/auth/callback` | `http://localhost:3000/auth/callback` |

Add **both** redirect URLs if you use local and production.

### 2.5 Database tables

Run `qa-engine/supabase_schema.sql` in the Supabase SQL editor for a **new** project.

If the project already has `audits` / `webhooks` from an older deploy, run **`qa-engine/supabase_migrations.sql`** instead (adds `repository_configs`, etc.).

Required tables/columns for Auto Audits:

| Table | Columns | Purpose |
|-------|---------|---------|
| `webhooks` | `webhook_id`, `webhook_secret`, `enabled` | GitHub hook registration + HMAC |
| `repository_configs` | `staging_url`, `branch`, `webhook_enabled`, `repo_name` | Runtime probe target per repo |

GitHub OAuth tokens are **not** stored in Supabase. The dashboard sends `provider_token` when enabling Auto Audits; the backend caches it in memory for webhook-triggered runs (re-enable after server restarts if needed).

After running SQL, wait ~30 seconds for Supabase schema cache to refresh, then retry **Save runtime config**.

### 2.6 Backend Supabase keys (Render)

On Render (`qa-engine`), set:

- `SUPABASE_URL` — same project URL as the frontend
- `SUPABASE_KEY` — **service role** key (never expose in the frontend)

---

## 3. GitHub webhooks (Auto Audits)

You usually **do not** create the webhook manually in GitHub. QAForge registers it when you enable **Auto Audits** in the dashboard.

### 3.1 Prerequisites

1. Sign in at [https://qaforge-jet.vercel.app/login](https://qaforge-jet.vercel.app/login) with **Connect GitHub**.
2. On Render, set `WEBHOOK_URL_BASE=https://qaforge-api.onrender.com`.
3. In the dashboard **Repository → Auto Audits** panel, enter **Staging URL** (e.g. `https://abcd.ngrok-free.app`) and click **Save runtime config**.
4. Click **Enable Auto Audits** (staging URL is required and persisted to Supabase `repository_configs`).

The backend will:

- Create a GitHub webhook on that repository pointing to  
  `https://qaforge-api.onrender.com/webhook/github`
- Store webhook secret, OAuth token, and `repository_configs` (staging URL, branch) in Supabase

### 3.2 What GitHub should show (after enable)

**Repository → Settings → Webhooks →** one hook:

| Field | Expected value |
|-------|----------------|
| Payload URL | `https://qaforge-api.onrender.com/webhook/github` |
| Content type | `application/json` |
| Events | `push` |
| Active | Yes |

### 3.3 Manual webhook (troubleshooting only)

Only if the dashboard flow failed and you need a temporary hook:

1. **Settings → Webhooks → Add webhook**
2. **Payload URL:** `https://qaforge-api.onrender.com/webhook/github`
3. **Content type:** `application/json`
4. **Secret:** must match the secret stored in Supabase `webhooks` for that repo (dashboard enable generates this automatically)
5. **Events:** Just the **push** event
6. Enable the webhook

Manual hooks without a matching Supabase `webhooks` row will fail signature verification. Prefer **disable → re-enable Auto Audits** in the dashboard instead.

### 3.4 Verify the backend receives events

1. Push a commit to a branch on the repo.
2. In the dashboard, check **Last Push Received** / **Last Auto Audit** under Auto Audits.
3. On Render logs, look for `POST /webhook/github` and audit pipeline activity.

### 3.5 Common failures

| Symptom | Fix |
|---------|-----|
| `404` webhook not configured | Enable Auto Audits from the dashboard while signed in with GitHub |
| `403` invalid signature | Re-enable Auto Audits to rotate secret in Supabase + GitHub |
| `422` missing staging URL | Set Staging URL, then disable and re-enable Auto Audits |
| OAuth / repo list empty | Re-login; confirm GitHub OAuth app callback matches Supabase |
| Render cold start | First request after idle may be slow; retry push or health check |

---

## 4. Quick test checklist

- [ ] `.env.local` filled (or Vercel env vars set)
- [ ] Supabase GitHub provider enabled with correct callback URL
- [ ] Redirect URLs include `/auth/callback` for your frontend origin
- [ ] `supabase_schema.sql` applied
- [ ] Render: `WEBHOOK_URL_BASE=https://qaforge-api.onrender.com`
- [ ] Login with GitHub works
- [ ] Enable Auto Audits with a **Staging URL**
- [ ] GitHub webhook payload URL points to `/webhook/github` on Render
- [ ] Test push triggers an audit in the dashboard
