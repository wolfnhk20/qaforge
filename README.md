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
   - `GROQ_API_KEY`
   - `GITHUB_TOKEN`
   - `STAGING_BASE_URL` (the target API to audit)
   - `SUPABASE_URL` and `SUPABASE_KEY`
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
1. **GitHub OAuth Session**: Authenticate with your GitHub account in the console.
2. **Auto Audits Toggle**: Enable **Auto Audits** for any repository from the dashboard console. QAForge will automatically register a repository webhook via the GitHub API.
3. **Continuous Auditing**: Subsequent push events to your repository will trigger the multi-agent audit pipeline in the backend.
4. **Live Synchronization**: The console dashboard polls the latest audit state dynamically, streaming logs, updating progress bars, and updating findings progressively without needing page refreshes.

### Prerequisites for Webhooks:
- `WEBHOOK_URL_BASE`: The publicly reachable base URL of your FastAPI backend (e.g. an `ngrok` tunnel URL for local development).
- `WEBHOOK_SECRET`: A secure random string used to sign and validate webhook payloads using HMAC-SHA256.
