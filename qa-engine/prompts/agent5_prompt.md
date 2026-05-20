# Agent Prompts: Report Synthesizer + GitHub Publisher

---

## AGENT 5 — Report Synthesizer

### System Prompt

```
You are the Report Synthesizer agent in a Functional Contract Auditor system.

You receive:
1. FunctionalContract  — what the module was supposed to do
2. ModuleBlueprint     — what the code actually does
3. ProbeResults        — what happened when we tested it live

Your job is to synthesize all three into one structured audit report
that a QA engineer, developer, or engineering manager can act on immediately.

You write for two audiences simultaneously:
  AUDIENCE A — QA Engineer / Developer
    Needs: exact endpoint, exact failure, exact fix, exact file/function to change
  AUDIENCE B — Engineering Manager
    Needs: how many gaps, how critical, what is the risk of shipping as-is

Rules:
1. Every gap must have: what failed, why it is wrong (contract reference), exact fix.
2. Fixes must be specific. Not "add validation". Say "add Field(gt=0) to amount in PaymentRequest model".
3. Group findings into three sections: Functional Gaps, Missing Validations, Scalability Risks.
4. Sort within each section by priority: CRITICAL first, then HIGH, then MEDIUM.
5. Include a Confidence Score per endpoint: (cases_passed / total_cases) * 100.
6. Include a module-level Overall Trust Score: average of all endpoint confidence scores.
7. Include a "What Passed" section — things the module does correctly. This builds trust in the report.
8. Include a "Next Steps" section — top 3 actions ordered by priority.
9. Scalability risks come from two sources:
   a. Static flags from probe_plan (code patterns identified by Probe Designer)
   b. Runtime flags from probe_results (actual timeout or slow response observed)
   Label which source each flag came from.
10. Do not editorialize. Every statement must be traceable to a probe result or contract clause.

Output format: Markdown. Clean, structured, immediately pasteable into GitHub or Notion.

Emit trace lines to stderr:
[REPORT_SYNTHESIZER] Compiling {n} probe results across {m} endpoints...
[REPORT_SYNTHESIZER] Found {x} CRITICAL, {y} HIGH, {z} MEDIUM gaps.
[REPORT_SYNTHESIZER] Overall Trust Score: {score}%
[REPORT_SYNTHESIZER] Writing audit_report.md...
[REPORT_SYNTHESIZER] Filing GitHub issue for CRITICAL gaps...
```

---

### User Prompt Template

```
Synthesize the final audit report from the following data.

Functional Contract:
{functional_contract_json}

Module Blueprint:
{module_blueprint_json}

Probe Results:
{probe_results_json}

Follow this structure exactly:

---
# Audit Report: {module_name}
**Generated:** {timestamp}
**Repo:** {repo}
**Scope:** {scope}
**Audited by:** Functional Contract Auditor Agent

---
## Executive Summary
- Endpoints audited: {n}
- Total probe cases run: {n}
- Gaps confirmed: {n} ({x} CRITICAL, {y} HIGH, {z} MEDIUM)
- Overall Trust Score: {score}%
- Recommendation: SHIP_BLOCKED | SHIP_WITH_FIXES | SHIP_SAFE

(Recommendation logic:
  Any CRITICAL gap → SHIP_BLOCKED
  Only HIGH/MEDIUM gaps → SHIP_WITH_FIXES
  No gaps → SHIP_SAFE)

---
## Functional Gaps
(behaviors the contract promised that the implementation violates)

### [CRITICAL/HIGH/MEDIUM] {endpoint} — {gap title}
- **Contract says:** {exact expected_behavior from contract}
- **What happened:** {probe case_id} sent {payload}, got {actual_status}, expected {expected_status}
- **Why it matters:** {blast radius — what goes wrong in production}
- **Fix:** {specific, file-level, function-level fix}
- **Confidence after fix:** High / Medium (your assessment)

---
## Missing Validations
(inputs that should be rejected but were accepted)

### [CRITICAL/HIGH/MEDIUM] {endpoint} — {validation title}
(same sub-structure as above)

---
## Scalability Risks
(will not fail now but will fail under load)

### {endpoint} — {risk title}
- **Source:** Static analysis | Runtime observation
- **Pattern:** {what the code does that is risky}
- **Threshold:** {estimated user volume or RPS where this breaks}
- **Fix:** {specific change}

---
## What Passed ✅
(build trust — list what works correctly)
- {endpoint}: {behavior} verified across {n} cases. Confidence: {score}%

---
## Next Steps (Priority Order)
1. {most critical fix — file, function, change}
2. {second fix}
3. {third fix}

---
## Probe Coverage
| Endpoint | Cases Run | Passed | Failed | Confidence |
|---|---|---|---|---|
| POST /payment | 9 | 4 | 5 | 44% |

---
## Raw Gap Index
(machine-readable, for auto-filing issues)
{
  "gaps": [
    {
      "id": "GAP_001",
      "endpoint": "POST /payment",
      "classification": "MISSING_VALIDATION",
      "priority": "CRITICAL",
      "title": "Negative amount accepted without rejection",
      "fix": "Add Field(gt=0) to amount in PaymentRequest Pydantic model",
      "file_hint": "payment/models.py"
    }
  ]
}

Return the full Markdown report. Do not truncate.
```

---

## GitHub Publisher Tool (tools/report_tools.py)

```python
import json
from datetime import datetime
from pathlib import Path
from github import Github
from config import GITHUB_TOKEN

def write_report_to_file(report_md: str, module: str) -> str:
    """Write audit report markdown to outputs/"""
    Path("outputs").mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"outputs/audit_report_{module}_{timestamp}.md"
    Path(filename).write_text(report_md)
    return filename


def push_github_issue(
    repo_name: str,
    gap: dict,
    audit_report_url: str = ""
) -> str:
    """
    File one GitHub issue per CRITICAL gap.
    Returns the issue URL.
    """
    g = Github(GITHUB_TOKEN)
    repo = g.get_repo(repo_name)

    title = f"[AUDITOR] {gap['priority']} | {gap['endpoint']} — {gap['title']}"
    
    body = f"""
## Functional Gap Detected by Contract Auditor Agent

**Endpoint:** `{gap['endpoint']}`
**Classification:** `{gap['classification']}`
**Priority:** `{gap['priority']}`

### What Failed
{gap.get('what_happened', 'See audit report')}

### Contract Violation
{gap.get('contract_clause', 'See audit report')}

### Fix
```
{gap['fix']}
```
**File hint:** `{gap.get('file_hint', 'See module blueprint')}`

---
*Auto-filed by Functional Contract Auditor Agent*
*Full report: {audit_report_url}*
"""
    labels = ["bug", "automated-audit"]
    if gap["priority"] == "CRITICAL":
        labels.append("priority: critical")

    issue = repo.create_issue(title=title, body=body, labels=labels)
    return issue.html_url


def file_critical_gaps(
    repo_name: str,
    probe_results: dict,
    report_path: str
) -> list[str]:
    """
    Parse probe results, file one issue per CRITICAL gap.
    Returns list of issue URLs.
    """
    urls = []
    for probe_id, result in probe_results.items():
        if result.get("priority") == "CRITICAL":
            for gap in result.get("gaps", []):
                gap["endpoint"] = result["target_endpoint"]
                gap["priority"] = result["priority"]
                url = push_github_issue(repo_name, gap, report_path)
                urls.append(url)
                print(
                    f"[REPORT_TOOLS] Filed issue: {url}",
                    flush=True
                )
    return urls
```

---

## Agent 5 Node (agents/report_synthesizer.py)

```python
import json
from datetime import datetime
from anthropic import Anthropic
from tools.report_tools import write_report_to_file, file_critical_gaps
from config import ANTHROPIC_API_KEY

client = Anthropic(api_key=ANTHROPIC_API_KEY)

SYSTEM_PROMPT = """... (paste Report Synthesizer system prompt here) ..."""

async def run_report_synthesizer(state: dict) -> dict:
    from graph.pipeline import trace

    trace("REPORT_SYNTHESIZER", 
          f"Compiling {len(state['probe_results'])} probe results...")

    # Count gaps
    all_gaps = [
        g for r in state["probe_results"].values()
        for g in r.get("gaps", [])
    ]
    critical = sum(1 for g in all_gaps if g.get("classification") == "FUNCTIONAL_GAP")
    trace("REPORT_SYNTHESIZER", f"Found {len(all_gaps)} total gaps. Filing report...")

    user_prompt = USER_PROMPT_TEMPLATE.format(
        module_name=state["module_path"],
        repo=state["repo"],
        scope=state["scope"],
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        functional_contract_json=json.dumps(state["functional_contract"], indent=2),
        module_blueprint_json=json.dumps(state["module_blueprint"], indent=2),
        probe_results_json=json.dumps(state["probe_results"], indent=2)
    )

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}]
    )

    report_md = response.content[0].text

    # Write to file
    report_path = write_report_to_file(report_md, state["module_path"])
    trace("REPORT_SYNTHESIZER", f"Report written → {report_path}")

    # File GitHub issues for CRITICAL gaps
    issue_urls = file_critical_gaps(
        repo_name=state["repo"],
        probe_results=state["probe_results"],
        report_path=report_path
    )

    if issue_urls:
        trace("REPORT_SYNTHESIZER",
              f"Filed {len(issue_urls)} GitHub issue(s): {issue_urls[0]}")
    else:
        trace("REPORT_SYNTHESIZER", "No CRITICAL gaps — no issues filed.")

    return {
        "audit_report": report_md,
        "github_issue_url": issue_urls[0] if issue_urls else None
    }
```
