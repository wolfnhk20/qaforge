# Frontend Development README

## Product Vision

Build a product interface for an AI-native software audit platform. The frontend should make backend intelligence legible, fast to trust, and operationally useful for engineering teams. The product is not a toy report viewer. It is a developer operations surface for running contract-aware audits and reviewing findings with confidence.

## Core UX Philosophy

- Show system intelligence, not just raw forms
- Make audit state obvious at every step
- Favor clarity over decoration
- Turn complex backend activity into a narrative the user can follow
- Build trust with real details: logs, stages, artifacts, findings, timestamps

## Brand Positioning

The brand should feel like modern AI infrastructure:

- serious
- precise
- technical
- operational
- confident

It should sit closer to Vercel, Linear, Datadog, Cursor, and Retool than to a generic AI chatbot product.

## Backend Architecture

```text
Frontend
↓
FastAPI
↓
LangGraph Engine
↓
Supabase
```

The frontend should consume backend APIs only. Do not embed agent logic, prompt logic, persistence logic, or secret-dependent workflows in the client.

## Sample UX Flow

```text
Connect Repo
→ Run Audit
→ View Findings
```

## Website Structure

### Public Marketing Surface

- Landing page
- Product overview
- Architecture section
- Demo report preview
- Call to action

### Authenticated Product Surface

- Audit dashboard
- Audit detail view
- Findings explorer
- History view
- Settings / integrations stub

## Required Frontend Pages

### 1. Landing Page

Must include:

- Hero
- Pipeline visualization
- Terminal logs
- Audit reports
- Architecture
- CTA

### 2. Audit Dashboard

Primary control center for launching and reviewing audits.

Recommended sections:

- New audit form
- Recent audits list
- Latest audit summary cards
- Findings preview panel
- System status / health panel

### 3. Audit Detail Page

Show one audit run in depth:

- Repo metadata
- Audit status
- Probe count
- Findings list
- Full markdown report
- Raw logs / trace timeline

### 4. Findings Explorer

Focused view for reviewing:

- endpoint
- classification
- priority
- reasoning
- suggested fix

### 5. History Page

Future-ready page for persisted runs from Supabase.

### 6. Settings / Integrations Placeholder

Future entry point for:

- GitHub OAuth
- webhook triggers
- runtime target management
- auth and team settings

## Dashboard Structure

Suggested layout:

- Left navigation
- Top command/search bar
- Main audit content area
- Right contextual panel for logs or finding details

Suggested dashboard modules:

- Audit launcher
- Pipeline stage tracker
- Latest report viewer
- Findings table
- Terminal log console
- Audit history

## API Endpoints

### `GET /health`

Response:

```json
{
  "status": "ok"
}
```

### `POST /audit`

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

### `GET /audit/latest`

Response:

```json
{
  "audit_id": 12,
  "status": "completed",
  "repo": "owner/repo",
  "probe_count": 3,
  "findings": [],
  "report_markdown": "# Audit Report ...",
  "report_path": "outputs/audit_report.md"
}
```

## Audit Report Structure

The frontend should assume `report_markdown` is the canonical narrative output.

Recommended rendering:

- Markdown renderer with code block styling
- Sticky table of contents for large reports
- Inline jump links from findings table to markdown sections

Typical report sections:

- Executive Summary
- Functional Gaps
- Missing Validations
- Scalability Risks
- What Passed
- Next Steps
- Probe Coverage
- Raw Gap Index

## Terminal Log Visualization Ideas

Potential UI patterns:

- live terminal panel styled like a deployment console
- collapsible stage groups by agent
- timestamped log rows
- color-coded severity / state
- timeline mode and raw console mode toggle

Useful labels:

- Intent Extractor
- Code Analyst
- Probe Designer
- Probe Executor
- Report Synthesizer

## Recommended Frontend Stack

- Next.js
- TypeScript
- React
- Tailwind CSS
- shadcn/ui or Radix-based primitives
- TanStack Query for API state
- Zustand only if lightweight client state is needed
- `react-markdown` for report rendering
- optional `framer-motion` for animation

## Design Language

Design should feel:

- minimal but premium
- technical but not cold
- sharp, fast, and instrumented

Avoid:

- generic AI gradients everywhere
- cartoon illustrations
- noisy dashboards
- vague copy

## Suggested Color Palette

- Background: `#0B1020`
- Surface: `#121A2B`
- Elevated Surface: `#182338`
- Text Primary: `#F4F7FB`
- Text Secondary: `#9FB0C7`
- Accent Blue: `#4EA1FF`
- Accent Green: `#31D0AA`
- Accent Amber: `#F5B942`
- Accent Red: `#FF6B6B`
- Border: `#25324A`

This should read as product infrastructure, not consumer SaaS.

## Animation Suggestions

- staggered reveal for pipeline stages
- subtle terminal typing animation for logs
- smooth markdown fade/slide transition when a report loads
- progress pulse on active audit stage
- count-up animation for metrics cards

Keep animation restrained and meaningful.

## UI Inspiration References

Reference visual and UX patterns from:

- Vercel
- Linear
- Cursor
- Datadog
- Retool

Interpret their clarity, density, and motion language. Do not imitate them literally.

## Landing Page Sections

### Hero

Communicate the product in one sentence:

- AI infrastructure for contract-aware software audits

Include:

- headline
- subheadline
- product screenshot or animated dashboard mock
- CTA

### Pipeline Visualization

Visualize the five-agent system as an explainable pipeline.

### Terminal Logs

Show real or representative audit traces to build trust.

### Audit Reports

Preview findings cards plus a markdown report view.

### Architecture

Explain how frontend, API, LangGraph, and Supabase fit together.

### CTA

Encourage users to run an audit or request access.

## Frontend Rules

### Consume APIs Only

The frontend should call the backend endpoints and render state. It should not reimplement:

- GitHub access logic
- probe generation logic
- audit persistence logic
- markdown synthesis logic

### Do Not Expose Secrets

Never put the following in frontend code:

- `GROQ_API_KEY`
- `GITHUB_TOKEN`
- `SUPABASE_KEY`

### Do Not Contain Business Logic

Business logic belongs in the backend. The frontend should remain a presentation and interaction layer.

## Future Features To Plan For

- GitHub OAuth
- real-time logs
- webhook triggers
- dashboard history
- team workspaces
- audit filtering and comparison
- saved environments

The UI should be structured so these additions fit naturally without a redesign.

## Recommended First Frontend Milestone

Build this first:

1. Landing page
2. Dashboard page with audit trigger form
3. Latest audit view
4. Findings table
5. Markdown report panel
6. Health check integration

If you need a working mental model, think: Vercel operational clarity + Linear polish + Datadog observability, applied to AI-powered code audit infrastructure.
