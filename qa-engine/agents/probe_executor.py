"""Agent 4: Parallel Probe Executor — per-probe reasoning loop.

Architecture:
  - For each probe, cases run sequentially (execute → LLM reason → retry?).
  - Multiple probes run in parallel via asyncio.gather.
  - Each case result is reasoned about by a separate LLM call (Groq).
  - FAIL_RETRY triggers one re-execution with a modified payload.

This is orchestration code with embedded LLM reasoning — NOT a ToolNode agent.
"""

import asyncio
import json
from typing import Any, Dict, List, Optional

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

import config
from tools.probe_tools import execute_api_call
from utils.trace import trace

AGENT_NAME = "PROBE_EXECUTOR"

# ---------------------------------------------------------------------------
# Prompts (from prompts_agent3_4.md)
# ---------------------------------------------------------------------------

REASONER_SYSTEM_PROMPT = """\
You are the Probe Execution Reasoner in a Functional Contract Auditor system.

You are given the result of one API probe execution.
Your job is to reason about the result and make one of three decisions:

DECISION A — PASS
  The API behaved as expected for this case.
  Increase confidence. Move to next case.

DECISION B — FAIL_RETRY
  The API failed in a way that might be a fluke or test environment issue.
  Condition: retry only if this is the first failure for this case.
  Modify the payload slightly to confirm it is a real gap, not noise.

DECISION C — FAIL_CONFIRMED
  The API failed in a way that is clearly a functional gap.
  Classify the failure into one of:
    FUNCTIONAL_GAP        → behavior contradicts a stated expected_behavior
    MISSING_VALIDATION    → invalid input was accepted without error
    SCALABILITY_RISK      → response time > 2000ms or timeout observed
  Provide: what happened, why it is wrong, and the exact fix to apply.

Rules:
1. Never retry the same payload twice. Retry means a modified boundary value.
2. If actual_status matches expected_status → PASS always.
3. If actual_status is 500 → FAIL_CONFIRMED, classify as FUNCTIONAL_GAP (unhandled exception).
4. If actual_status is 200 but expected 4xx → FAIL_CONFIRMED, classify as MISSING_VALIDATION.
5. If response_time_ms > 2000 → flag SCALABILITY_RISK even if status is correct.
6. Be specific in suggested_fix. Name the function to fix, the line to add, the validator to use.

Output ONLY valid JSON matching the ProbeDecision schema.

ProbeDecision schema:
{
  "case_id": string,
  "decision": "PASS" | "FAIL_RETRY" | "FAIL_CONFIRMED",
  "actual_status": int,
  "expected_status": int,
  "response_time_ms": int,
  "reasoning": string,
  "classification": "FUNCTIONAL_GAP" | "MISSING_VALIDATION" | "SCALABILITY_RISK" | null,
  "suggested_fix": string | null,
  "retry_payload": object | null
}
"""

REASONER_USER_TEMPLATE = """\
A probe case has been executed. Reason about the result and decide next action.

Probe context:
  Probe ID: {probe_id}
  Target: {method} {endpoint}
  Gap hypothesis: {gap_hypothesis}
  Expected behavior (from contract): {relevant_expected_behavior}

Case executed:
  Case ID: {case_id}
  Description: {case_desc}
  Payload sent: {payload}
  Expected status: {expected_status}

Execution result:
  Actual status: {actual_status}
  Response body: {response_body}
  Response time: {response_time_ms}ms
  Error (if any): {error}

Retry context:
  Has this case been retried before? {already_retried}

Reason about this result and return the ProbeDecision JSON.
Be specific. If FAIL_CONFIRMED, name the exact function and fix.
"""


# ---------------------------------------------------------------------------
# LLM reasoning call
# ---------------------------------------------------------------------------

async def _reason_about_result(
    probe: dict,
    case: dict,
    actual_status: int,
    response_body: dict,
    response_time_ms: int,
    error: Optional[str],
    already_retried: bool,
) -> dict:
    """Make a single LLM call to reason about one case execution result."""

    user_prompt = REASONER_USER_TEMPLATE.format(
        probe_id=probe["probe_id"],
        method=probe["method"],
        endpoint=probe["target_endpoint"],
        gap_hypothesis=probe["gap_hypothesis"],
        relevant_expected_behavior="(from contract)",
        case_id=case["case_id"],
        case_desc=case["desc"],
        payload=json.dumps(case["payload"]),
        expected_status=case["expected_status"],
        actual_status=actual_status,
        response_body=json.dumps(response_body)[:1000],
        response_time_ms=response_time_ms,
        error=error or "None",
        already_retried=str(already_retried).lower(),
    )

    llm = ChatGroq(
        model=config.MODEL_NAME,
        api_key=config.GROQ_API_KEY,
        temperature=0,
        max_tokens=1024,
    )

    response = await llm.ainvoke([
        SystemMessage(content=REASONER_SYSTEM_PROMPT),
        HumanMessage(content=user_prompt),
    ])

    raw = response.content.strip()
    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0]
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0]

    return json.loads(raw.strip())


# ---------------------------------------------------------------------------
# Single case execution (HTTP + LLM reasoning)
# ---------------------------------------------------------------------------

async def _execute_single_case(
    base_url: str,
    probe: dict,
    case: dict,
    already_retried: bool = False,
) -> dict:
    """Execute one probe case and get LLM reasoning on the result."""

    actual_status, response_body, response_time_ms, error = await execute_api_call(
        base_url=base_url,
        method=probe["method"],
        endpoint=probe["target_endpoint"],
        payload=case["payload"],
        probe_id=probe["probe_id"],
    )

    decision = await _reason_about_result(
        probe=probe,
        case=case,
        actual_status=actual_status,
        response_body=response_body,
        response_time_ms=response_time_ms,
        error=error,
        already_retried=already_retried,
    )

    # Trace the decision
    tag = f"PROBE_EXECUTOR:{probe['probe_id']}"
    classification = decision.get("classification") or "OK"
    trace(tag, f"Decision: {decision['decision']} | {classification}")
    trace(tag, decision.get("reasoning", ""))

    return decision


# ---------------------------------------------------------------------------
# Per-probe orchestration (all cases sequentially, with retry)
# ---------------------------------------------------------------------------

async def run_probe(base_url: str, probe: dict) -> dict:
    """Run all cases in one probe sequentially.
    Handle FAIL_RETRY by re-executing with retry_payload once.
    """
    tag = f"PROBE_EXECUTOR:{probe['probe_id']}"
    trace(tag, f"Starting probe — {probe['target_endpoint']}")

    results: List[dict] = []
    all_cases = (
        probe.get("positive_cases", [])
        + probe.get("negative_cases", [])
        + probe.get("edge_cases", [])
    )

    for case in all_cases:
        decision = await _execute_single_case(base_url, probe, case)

        # Handle retry
        if decision.get("decision") == "FAIL_RETRY" and decision.get("retry_payload"):
            trace(tag, f"Retrying {case['case_id']} with modified payload...")
            retry_case = {**case, "payload": decision["retry_payload"]}
            decision = await _execute_single_case(
                base_url, probe, retry_case, already_retried=True
            )

        results.append(decision)

    # Summarize
    fails = [r for r in results if r.get("decision") == "FAIL_CONFIRMED"]
    passes = [r for r in results if r.get("decision") == "PASS"]
    confidence = round(len(passes) / len(results), 2) if results else 0.0

    trace(tag, f"Done. {len(passes)}/{len(results)} passed. {len(fails)} gaps found.")

    return {
        "probe_id": probe["probe_id"],
        "target_endpoint": probe["target_endpoint"],
        "priority": probe.get("priority", ""),
        "gap_hypothesis": probe.get("gap_hypothesis", ""),
        "confidence": confidence,
        "total_cases": len(results),
        "passed": len(passes),
        "failed": len(fails),
        "gaps": [
            {
                "case_id": r.get("case_id", ""),
                "classification": r.get("classification", ""),
                "reasoning": r.get("reasoning", ""),
                "suggested_fix": r.get("suggested_fix", ""),
            }
            for r in fails
        ],
        "scalability_flags": probe.get("scalability_flags", []),
    }


# ---------------------------------------------------------------------------
# Public API — parallel execution of selected probes
# ---------------------------------------------------------------------------

async def run_all_probes_parallel(
    base_url: str,
    probe_plan: dict,
    selected_probe_ids: List[str],
) -> dict:
    """Run selected probes in parallel using asyncio.gather.

    Args:
        base_url: Staging server base URL.
        probe_plan: Full ProbePlan dict from Agent 3.
        selected_probe_ids: List of probe IDs to execute.

    Returns:
        Dict mapping probe_id → probe result summary.
    """
    selected = [
        p for p in probe_plan["probes"]
        if p["probe_id"] in selected_probe_ids
    ]

    trace(AGENT_NAME, f"Running {len(selected)} probes in parallel...")

    tasks = [run_probe(base_url, probe) for probe in selected]
    results = await asyncio.gather(*tasks)

    probe_results = {r["probe_id"]: r for r in results}

    # Summary trace
    total_cases = sum(r["total_cases"] for r in results)
    total_passed = sum(r["passed"] for r in results)
    total_failed = sum(r["failed"] for r in results)
    trace(AGENT_NAME, f"All probes complete.")
    trace(AGENT_NAME, f"  Passed: {total_passed}/{total_cases} cases")
    trace(AGENT_NAME, f"  Failed: {total_failed}/{total_cases} cases")
    trace(AGENT_NAME, f"  Gaps  : {total_failed} confirmed")

    return probe_results


def run_probes_sync(
    base_url: str,
    probe_plan: dict,
    selected_probe_ids: List[str],
) -> dict:
    """Synchronous wrapper for run_all_probes_parallel (for pipeline use)."""
    return asyncio.run(
        run_all_probes_parallel(base_url, probe_plan, selected_probe_ids)
    )
