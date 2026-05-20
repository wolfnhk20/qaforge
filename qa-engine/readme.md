# qa-engine

`qa-engine` is an AI infrastructure backend for contract-aware software auditing. It analyzes a GitHub module, reconstructs intended behavior from repository signals, maps implementation details from source code, generates adversarial probes, executes those probes against a running environment, and synthesizes the results into a structured engineering report.

This is not a generic chat wrapper and not a test generator. It is a backend platform for automated audit execution, report generation, and persistence, designed to become the foundation for a future product surface that includes dashboards, history, GitHub integrations, and live observability.

## Product Overview

The product solves a specific engineering gap: teams often know what code does today, but they do not have a reliable system for comparing implementation behavior against intended behavior and surfacing regressions in a decision-ready format.

`qa-engine` provides:

- Intent extraction from repository context such as README files, commits, PR descriptions, and diffs
- Code analysis that maps APIs, handler functions, and call surfaces
- Probe design that converts expected behavior into executable test pressure
- Runtime probe execution against a live target such as `localhost:5000` or staging
- Report synthesis into markdown and structured JSON
- FastAPI endpoints for product integration
- Supabase persistence for audits and logs

## Architecture

```text
CLI / Frontend / Integrations
            |
            v
        FastAPI API
            |
            v
      LangGraph Engine
            |
   +--------+--------+
   |        |        |
 GitHub   Runtime   LLM
 Signals   Target  Reasoning
            |
            v
         Outputs
            |
            v
        Supabase
```

The system is intentionally split into layers:

- `agents/` contains the reasoning units and keeps the product logic modular
- `graph/` owns orchestration and state passing
- `tools/` contains external system access and deterministic helpers
- `api/` exposes the backend through REST
- `db/` handles persistence

This separation keeps the backend ready for future additions like OAuth, jobs, queueing, or streaming without rewriting the agents.

## Multi-Agent Workflow

### Agent 1: Intent Extractor

Reads developer-authored repository signals to infer expected behavior.

Inputs:

- Repo name
- Module path
- Scope (`full_module`, `pr`, `commit_range`)

Outputs:

- `functional_contract.json`

### Agent 2: Code Analyst

Maps implementation-level APIs, handlers, and callable surfaces. Supports deterministic Flask route detection and preserves FastAPI/OpenAPI support.

Outputs:

- `module_blueprint.json`

### Agent 3: Probe Designer

Transforms contract expectations and blueprint details into audit probes.

Outputs:

- `probe_plan.json`

### Agent 4: Probe Executor

Runs probes against the configured runtime target and classifies observed failures.

Outputs:

- `probe_results.json`

### Agent 5: Report Synthesizer

Produces final markdown findings and optional GitHub issue payloads.

Outputs:

- `audit_report.md`

## LangGraph Orchestration Flow

```text
Intent Extractor
  -> Code Analyst
  -> Probe Designer
  -> Probe Selection
  -> Parallel Probe Executor
  -> Report Synthesizer
  -> END
```

The API layer does not bypass this graph. It calls the same compiled pipeline used by the CLI so behavior stays aligned across interfaces.

## API Layer

The FastAPI layer lives in [api/server.py](/F:/hackathon/QA-Agent-/qa-engine/api/server.py:1) and uses [api/service.py](/F:/hackathon/QA-Agent-/qa-engine/api/service.py:1) as the orchestration boundary.

Why this matters:

- Route handlers stay thin
- Persistence is isolated from transport
- Future auth and webhook logic can attach at the API boundary
- The LangGraph engine remains unchanged

### Current Endpoints

#### `GET /health`

Returns a basic process health signal.

Response:

```json
{
  "status": "ok"
}
```

#### `POST /audit`

Runs the full audit pipeline, saves the result to Supabase, and returns a structured response.

Request:

```json
{
  "repo": "owner/repo",
  "module": ".",
  "scope": "full_module"
}
```

Response:

```json
{
  "audit_id": 12,
  "status": "completed",
  "repo": "owner/repo",
  "probe_count": 3,
  "findings": [
    {
      "probe_id": "P01",
      "endpoint": "/payment",
      "priority": "HIGH",
      "classification": "MISSING_VALIDATION",
      "reasoning": "Accepted a payload that should have been rejected.",
      "suggested_fix": "Add input validation before persistence.",
      "case_id": "P01_NEG_01"
    }
  ],
  "report_markdown": "# Audit Report ...",
  "report_path": "outputs/audit_report.md"
}
```

#### `GET /audit/latest`

Returns the latest persisted audit if Supabase is configured. If Supabase is unavailable, it falls back to local output artifacts.

## Supabase Integration

Supabase is the persistence layer for product-facing state.

Current responsibilities:

- Save completed audit records
- Save operational log events
- Fetch the latest audit for UI consumption

Implementation files:

- [db/supabase.py](/F:/hackathon/QA-Agent-/qa-engine/db/supabase.py:1)
- [supabase_schema.sql](/F:/hackathon/QA-Agent-/qa-engine/supabase_schema.sql:1)

### Stored Audit Fields

- `repo`
- `module`
- `status`
- `probe_count`
- `findings`
- `report_markdown`
- `created_at`

### Stored Log Fields

- `audit_id`
- `level`
- `message`
- `payload`
- `created_at`

## Folder Structure

```text
qa-engine/
├── api/
│   ├── __init__.py
│   ├── server.py
│   └── service.py
├── agents/
│   ├── __init__.py
│   ├── intent_extractor.py
│   ├── code_analyst.py
│   ├── probe_designer.py
│   ├── probe_executor.py
│   └── report_synthesizer.py
├── db/
│   ├── __init__.py
│   └── supabase.py
├── graph/
│   ├── __init__.py
│   └── pipeline.py
├── models/
│   ├── __init__.py
│   ├── blueprint.py
│   ├── contract.py
│   ├── probe.py
│   └── report.py
├── outputs/
├── prompts/
├── tools/
│   ├── __init__.py
│   ├── code_tools.py
│   ├── github_tools.py
│   ├── probe_tools.py
│   └── report_tools.py
├── traces/
├── config.py
├── main.py
├── requirements.txt
├── supabase_schema.sql
└── readme.md
```

## Installation Guide

### 1. Create and activate a virtual environment

```bash
python -m venv venv
venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

If your shell has `PIP_NO_INDEX=1` set, remove it before installing:

```powershell
Remove-Item Env:PIP_NO_INDEX -ErrorAction SilentlyContinue
```

## Environment Setup

Copy the example file:

```bash
copy .env.example .env
```

Required environment variables:

- `GROQ_API_KEY`
- `GITHUB_TOKEN`
- `STAGING_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_KEY`

Optional:

- `MODEL_NAME`
- `DEFAULT_BRANCH`

## Running Locally

### CLI

```bash
python main.py --repo owner/repo --module . --auto
```

Examples:

```bash
python main.py --repo owner/repo --module services/payment --auto
python main.py --repo owner/repo --module . --scope pr --pr 42 --auto
python main.py --repo owner/repo --module . --scope commit_range --from-commit abc --to-commit def --auto
```

### FastAPI Server

```bash
uvicorn api.server:app --reload
```

On Windows, using the venv executable directly is also safe:

```bash
venv\Scripts\python.exe -m uvicorn api.server:app --reload
```

## API Endpoint Reference

### `GET /health`

Use for process health checks and deployment monitoring.

### `POST /audit`

Purpose:

- Trigger a complete audit
- Persist the result
- Return a product-ready response payload

Validation behavior:

- Rejects malformed repo values
- Requires `pr_number` when `scope="pr"`
- Requires `base_commit` and `head_commit` when `scope="commit_range"`

Failure classes:

- `422` for bad input
- `502` for pipeline failures
- `503` for Supabase persistence failures
- `500` for malformed outputs or unexpected server errors

### `GET /audit/latest`

Purpose:

- Load the most recent audit for a dashboard or report viewer

Behavior:

- Uses Supabase if configured
- Falls back to local artifacts when needed

## Outputs

`outputs/` is the local artifact layer. It exists even when the API is used.

Generated files include:

- `functional_contract.json`
- `module_blueprint.json`
- `probe_plan.json`
- `probe_results.json`
- `audit_report.md`

These files are useful for:

- debugging
- demos
- regression investigation
- artifact inspection in local development

## Backend / Frontend Separation

The frontend should treat the backend as the system of record for audit execution and persisted state.

Backend responsibilities:

- repository analysis
- orchestration
- persistence
- secrets
- external integrations

Frontend responsibilities:

- trigger audits
- display progress and results
- render report views
- visualize history and findings

Frontend should not:

- contain business logic from the audit engine
- replicate pipeline logic
- expose GitHub, Groq, or Supabase secrets

## Future Roadmap

- GitHub OAuth for user-initiated repo access
- real-time log streaming
- webhook-triggered audits
- dashboard history and filtering
- background jobs and queueing
- JWT-based access control
- multi-tenant audit storage
- report diffing across audit runs

## Current Limitations

- No authentication yet
- No queueing or job workers yet
- No websocket streaming yet
- `/audit` currently runs inline
- Agent execution still depends on external GitHub and LLM connectivity
- Probe execution assumes a reachable runtime target

## Tech Stack

| Layer | Tooling |
|---|---|
| API | FastAPI, Uvicorn |
| Orchestration | LangGraph |
| LLM Provider | Groq via `langchain-groq` |
| GitHub Access | PyGithub |
| Runtime Probing | httpx |
| Persistence | Supabase |
| Validation / Models | Pydantic |
| Config | python-dotenv |

## Positioning

`qa-engine` should be understood as a product-ready AI infrastructure backend for software assurance workflows. It is designed to become the control plane behind a polished frontend experience, not remain a terminal-only prototype.
