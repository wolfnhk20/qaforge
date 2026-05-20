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
2. Configure your `.env` file (copied from backend or created manually):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` (Defaults to `http://localhost:8000`)
3. Launch the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## GitHub Webhook Integration & Auto-Auditing

QAForge supports fully autonomous auditing triggered by Git pushes via GitHub Webhooks.

### How It Works:
1. **GitHub OAuth Session**: Authenticate with your GitHub account in the console. Your access token is retrieved securely from the Supabase auth session.
2. **Auto Audits Toggle**: Enable **Auto Audits** for any repository from the dashboard console. This registers a repository webhook via the GitHub API using the authenticated user's access token, and stores the token securely in the webhook metadata.
3. **Continuous Auditing**: Subsequent push events to your repository will trigger the multi-agent audit pipeline in the backend. The webhook receiver reads the stored OAuth token and runs the agent graph with request-scoped credentials.
4. **Live Synchronization**: The console dashboard polls the latest audit state dynamically, streaming logs, updating progress bars, and updating findings progressively without needing page refreshes.

### Prerequisites & Credentials:
- **Supabase OAuth Link**: Ensure your Supabase project is configured with GitHub authentication (OAuth) enabling the `repo` scope to manage webhooks and read repository files.
- **Per-repository runtime config**: Staging URL and branch are stored in Supabase `repository_configs` when you enable Auto Audits. Webhook-triggered audits resolve the target automatically from that table — there is no global `STAGING_BASE_URL`.
- `WEBHOOK_URL_BASE`: The publicly reachable base URL of your FastAPI backend (e.g., an `ngrok` tunnel URL for local development).
- `WEBHOOK_SECRET`: A secure random string used to sign and validate webhook payloads using HMAC-SHA256.

### Architecture Notes (Dynamic Token Migration):
- All PyGithub clients and GitHub tools read the token dynamically from `config.github_token_var` (an async/thread-safe `ContextVar`). This isolates client connections per request/webhook pipeline task and completely removes dependencies on any hardcoded backend token.
- Expired or revoked credentials trigger graceful error report generation directly inside the dashboard with remediation guidelines.
