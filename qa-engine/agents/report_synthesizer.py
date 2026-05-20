"""Agent 5: Report Synthesizer — all results → audit_report.md + GitHub issues.

Single-shot LLM call (no tools/ToolNode). Takes contract + blueprint +
probe_results, produces a structured Markdown audit report, writes it to
file, and files GitHub issues for CRITICAL gaps.
"""

import json
from datetime import datetime
from typing import Any, Dict, Optional

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

import config
from tools.report_tools import file_critical_gaps, write_report_to_file
from utils.llm_helpers import safe_model_invoke
from utils.trace import trace

AGENT_NAME = "REPORT_SYNTHESIZER"

# ---------------------------------------------------------------------------
# Prompts (from agent5_prompt.md)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
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
"""

USER_PROMPT_TEMPLATE = """\
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
- Endpoints audited: (count)
- Total probe cases run: (count)
- Gaps confirmed: (count) (x CRITICAL, y HIGH, z MEDIUM)
- Overall Trust Score: (score)%
- Recommendation: SHIP_BLOCKED | SHIP_WITH_FIXES | SHIP_SAFE

(Recommendation logic:
  Any CRITICAL gap → SHIP_BLOCKED
  Only HIGH/MEDIUM gaps → SHIP_WITH_FIXES
  No gaps → SHIP_SAFE)

---
## Functional Gaps
(behaviors the contract promised that the implementation violates)

### [CRITICAL/HIGH/MEDIUM] endpoint — gap title
- **Contract says:** exact expected_behavior from contract
- **What happened:** probe case_id sent payload, got actual_status, expected expected_status
- **Why it matters:** blast radius — what goes wrong in production
- **Fix:** specific, file-level, function-level fix
- **Confidence after fix:** High / Medium

---
## Missing Validations
(inputs that should be rejected but were accepted — same sub-structure)

---
## Scalability Risks
(will not fail now but will fail under load)

### endpoint — risk title
- **Source:** Static analysis | Runtime observation
- **Pattern:** what the code does that is risky
- **Threshold:** estimated user volume or RPS where this breaks
- **Fix:** specific change

---
## What Passed ✅
(build trust — list what works correctly)
- endpoint: behavior verified across n cases. Confidence: score%

---
## Next Steps (Priority Order)
1. most critical fix — file, function, change
2. second fix
3. third fix

---
## Probe Coverage
| Endpoint | Cases Run | Passed | Failed | Confidence |
|---|---|---|---|---|

---
## Raw Gap Index
(machine-readable JSON block for auto-filing issues)

Return the full Markdown report. Do not truncate.
"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_report_synthesizer(
    repo: str,
    module_path: str,
    scope: str,
    functional_contract: Dict[str, Any],
    module_blueprint: Dict[str, Any],
    probe_results: Dict[str, Any],
) -> Dict[str, Any]:
    """Run the Report Synthesizer and return the report + issue URLs.

    Args:
        repo: GitHub repo in 'org/repo' format.
        module_path: Module path for the report title.
        scope: Audit scope (full_module, pr, commit_range).
        functional_contract: Output of Agent 1.
        module_blueprint: Output of Agent 2.
        probe_results: Output of Agent 4.

    Returns:
        Dict with keys: audit_report (str), report_path (str),
        github_issue_urls (list[str]).
    """
    # --- Count gaps for trace ---
    all_gaps = [
        g
        for r in probe_results.values()
        for g in r.get("gaps", [])
    ]
    n_endpoints = len(probe_results)
    trace(AGENT_NAME, f"Compiling {len(probe_results)} probe results across {n_endpoints} endpoints...")

    critical = sum(
        1 for pid, r in probe_results.items()
        if r.get("priority") == "CRITICAL" and r.get("gaps")
    )
    high = sum(
        1 for pid, r in probe_results.items()
        if r.get("priority") == "HIGH" and r.get("gaps")
    )
    medium = sum(
        1 for pid, r in probe_results.items()
        if r.get("priority") == "MEDIUM" and r.get("gaps")
    )
    trace(AGENT_NAME, f"Found {critical} CRITICAL, {high} HIGH, {medium} MEDIUM gap groups.")

    # --- Build the LLM prompt ---
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    user_prompt = USER_PROMPT_TEMPLATE.format(
        module_name=module_path,
        repo=repo,
        scope=scope,
        timestamp=timestamp,
        functional_contract_json=json.dumps(functional_contract, indent=2),
        module_blueprint_json=json.dumps(module_blueprint, indent=2),
        probe_results_json=json.dumps(probe_results, indent=2),
    )

    # --- Single-shot LLM call ---
    llm = ChatGroq(
        model=config.MODEL_NAME,
        api_key=config.GROQ_API_KEY,
        temperature=0,
        max_tokens=8192,
    )

    response = safe_model_invoke(
        llm,
        [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=user_prompt)],
        agent_name=AGENT_NAME,
        max_retries=3,
        retry_delay=10.0
    )

    report_md = response.content

    # --- Compute overall trust score for trace ---
    confidences = [
        r.get("confidence", 0.0) for r in probe_results.values()
    ]
    overall_trust = (
        round(sum(confidences) / len(confidences) * 100)
        if confidences
        else 0
    )
    trace(AGENT_NAME, f"Overall Trust Score: {overall_trust}%")

    # --- Write report to file ---
    report_path = write_report_to_file(report_md, module_path)
    trace(AGENT_NAME, f"Report written → {report_path}")

    # --- File GitHub issues for CRITICAL gaps ---
    trace(AGENT_NAME, "Filing GitHub issues for CRITICAL gaps...")
    issue_urls = file_critical_gaps(
        repo_name=repo,
        probe_results=probe_results,
        report_path=report_path,
    )

    if issue_urls:
        trace(AGENT_NAME, f"Filed {len(issue_urls)} GitHub issue(s): {issue_urls[0]}")
    else:
        trace(AGENT_NAME, "No CRITICAL gaps — no issues filed.")

    trace(AGENT_NAME, "Done. audit_report.md written.")

    return {
        "audit_report": report_md,
        "report_path": report_path,
        "github_issue_urls": issue_urls,
    }
