# QAForge — AI-Native Software Quality Control Plane

QAForge is a contract-aware, multi-agent AI system designed for executing runtime code audits, mapping API surfaces, designing pressure-testing probes, and producing engineering narrative reports.

## Project Structure

* `/qa-web` — Next.js 15 frontend console (dashboard, findings explorer, log trace, report viewer).
* `/qa-engine` — FastAPI API layer and LangGraph multi-agent engine.

```text
                  +--------------------------------+
                  |            qa-web              |
                  |     (Next.js 15 Console)       |
                  +---------------+----------------+
                                  |
                                  | HTTP Requests
                                  v
                  +--------------------------------+
                  |           qa-engine            |
                  |        (FastAPI Layer)         |
                  +---------------+----------------+
                                  |
                                  | Runs Graph
                                  v
                  +--------------------------------+
                  |       LangGraph Engine         |
                  |  (Multi-Agent Audit Pipeline)  |
                  +---------------+----------------+
                                  |
                                  | Persists Results
                                  v
                  +--------------------------------+
                  |           Supabase             |
                  |       (Database & Auth)        |
                  +--------------------------------+
```

---

## Getting Started

### 1. Backend Setup (`/qa-engine`)

1. Make sure Python 3.11+ is installed.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Copy environment variables sample and configure it:
   ```bash
   copy .env.example .env
   ```
4. Configure your `.env` with:
   - `GROQ_API_KEY` (used for LLM audit reasoning)
   - `SUPABASE_URL` and `SUPABASE_KEY` (for persistence and user auth)
   - `GITHUB_TOKEN` *(Optional)* - Only used as a fallback for CLI-based standalone scripts. Under normal application workflows, all operations use the user's authenticated GitHub OAuth token.
5. Start the FastAPI backend:
   ```bash
   python run_api.py
   ```
   *The server runs by default on `http://localhost:8000`.*

### 2. Frontend Setup (`/qa-web`)

1. Install Node.js dependencies:
   ```bash
   npm install
   ```
2. Copy the frontend env template and configure it:
   ```bash
   copy .env.local.example .env.local
   ```
   See [`qa-web/docs/SETUP.md`](qa-web/docs/SETUP.md) for Supabase GitHub auth and webhook setup.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` (local: `http://localhost:8000`; production: `https://qaforge-api.onrender.com`)
3. Launch the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Production deployment

| Service | URL |
|---------|-----|
| Frontend (Vercel) | https://qaforge-jet.vercel.app |
| Backend (Render) | https://qaforge-api.onrender.com |

### Vercel (`qa-web`)

Set environment variables in the Vercel project settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` = `https://qaforge-api.onrender.com`

Redeploy after changing env vars.

### Render (`qa-engine`)

| Setting | Value |
|---------|--------|
| Root directory | `qa-engine` |
| Build command | `pip install -r requirements.txt` |
| Start command | `python run_api.py` |

Render injects `PORT`; the API binds to `0.0.0.0` on that port (not `127.0.0.1`). Health check path: `/` or `/health`.

Environment variables:

- `GROQ_API_KEY`
- `SUPABASE_URL` / `SUPABASE_KEY` (service role)
- `WEBHOOK_URL_BASE` = `https://qaforge-api.onrender.com`

### Supabase Auth (GitHub OAuth)

Full step-by-step: **[qa-web/docs/SETUP.md](qa-web/docs/SETUP.md)** (GitHub OAuth App, Supabase provider, redirect URLs).

Redirect URLs (Supabase → Authentication → URL configuration):

- `https://qaforge-jet.vercel.app/auth/callback`
- `http://localhost:3000/auth/callback` (local dev)

### GitHub webhooks (production)

Webhook payload URL (registered automatically when you enable **Auto Audits** in the dashboard):

```text
https://qaforge-api.onrender.com/webhook/github
```

Manual setup and troubleshooting: **[qa-web/docs/SETUP.md#3-github-webhooks-auto-audits](qa-web/docs/SETUP.md)**.

---

## GitHub Webhook Integration & Auto-Auditing

QAForge supports fully autonomous auditing triggered by Git pushes via GitHub Webhooks.

### How It Works:
1. **GitHub OAuth Session**: Authenticate with your GitHub account in the console. Your access token is retrieved securely from the Supabase auth session.
2. **Auto Audits Toggle**: Enable **Auto Audits** for any repository from the dashboard console. This registers a GitHub webhook using your live OAuth `provider_token` (sent per request, not stored in the database).
3. **Continuous Auditing**: Push events trigger the audit pipeline using the cached OAuth session from enable time. Re-enable Auto Audits after a backend restart if pushes stop running.
4. **Live Synchronization**: The console dashboard polls the latest audit state dynamically, streaming logs, updating progress bars, and updating findings progressively without needing page refreshes.

### Prerequisites & Credentials:
- **Supabase OAuth Link**: Ensure your Supabase project is configured with GitHub authentication (OAuth) enabling the `repo` scope to manage webhooks and read repository files.
- **Per-repository runtime config**: Staging URL and branch are stored in Supabase `repository_configs` when you enable Auto Audits. Webhook-triggered audits resolve the target automatically from that table — there is no global `STAGING_BASE_URL`.
- `WEBHOOK_URL_BASE`: The publicly reachable base URL of your FastAPI backend (production: `https://qaforge-api.onrender.com`; local dev: an `ngrok` tunnel or `http://localhost:8000`). GitHub hooks target `{WEBHOOK_URL_BASE}/webhook/github`.
- Per-repo webhook secrets are generated automatically when enabling Auto Audits (stored in Supabase `webhooks`). OAuth tokens are not stored in the database.

### Architecture Notes (Dynamic Token Migration):
- All PyGithub clients and GitHub tools read the token dynamically from `config.github_token_var` (an async/thread-safe `ContextVar`). This isolates client connections per request/webhook pipeline task and completely removes dependencies on any hardcoded backend token.
- Expired or revoked credentials trigger graceful error report generation directly inside the dashboard with remediation guidelines.
