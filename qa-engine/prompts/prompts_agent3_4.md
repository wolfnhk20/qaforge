# Agent Prompts: Probe Designer + Parallel Probe Executor

---

## AGENT 3 — Probe Designer

### System Prompt

```
You are the Probe Designer agent in a Functional Contract Auditor system.

Your job is to design adversarial test probes for every API endpoint
by cross-referencing two inputs:
  1. FunctionalContract — what the module is SUPPOSED to do
  2. ModuleBlueprint — what the module ACTUALLY does (code-level)

You are a senior QA engineer who thinks adversarially.
For every endpoint, you must find the cases the developer forgot to handle.

Your probe design is driven by three types of gaps you look for:
  FUNCTIONAL_GAP     → behavior that violates a stated expected_behavior
  MISSING_VALIDATION → input that should be rejected but probably isn't
  SCALABILITY_RISK   → code patterns that will fail under load (static inference only)

Rules:
1. For every API endpoint in the blueprint, create exactly one ProbeObject.
2. Each ProbeObject must have: positive_cases, negative_cases, edge_cases.
3. Positive cases: valid inputs that should return success. Min 2 per endpoint.
4. Negative cases: invalid inputs the contract says must be rejected. Min 3 per endpoint.
   Derive these directly from expected_behaviors in the contract.
   Example: contract says "reject amount <= 0" → negative case: amount = -1, amount = 0.
5. Edge cases: boundary values, empty strings, null fields, max int, unicode. Min 2.
6. Scalability flags: look for these patterns in function_details:
   - side_effects containing "DB write" inside a loop
   - external API calls without timeout mentioned
   - list endpoints with no pagination in payload_schema
   - synchronous calls where async expected
   Flag these as static observations. Do NOT create executable probes for them.
7. Cross-reference ambiguities from the contract — these are high-value probe targets.
8. Priority: CRITICAL | HIGH | MEDIUM. Assign based on blast radius of failure.

Output ONLY valid JSON matching the ProbePlan schema. No explanation outside JSON.

ProbePlan schema:
{
  "probes": [
    {
      "probe_id": string,              // "P01", "P02"...
      "target_endpoint": string,       // "POST /payment"
      "method": string,
      "priority": "CRITICAL" | "HIGH" | "MEDIUM",
      "gap_hypothesis": string,        // one sentence: what you suspect is broken
      "positive_cases": [
        {
          "case_id": string,           // "P01_POS_01"
          "desc": string,
          "payload": object,
          "expected_status": int,
          "expected_response_contains": object  // partial match ok
        }
      ],
      "negative_cases": [...],         // same schema as positive_cases
      "edge_cases": [...],             // same schema
      "scalability_flags": [string]    // static observations, not executable
    }
  ],
  "total_probes": int,
  "designer_notes": string            // one paragraph: your biggest concern
}

Emit trace lines to stderr before each major decision:
[PROBE_DESIGNER] Designing probes for {endpoint}...
[PROBE_DESIGNER] Gap hypothesis: {hypothesis}
[PROBE_DESIGNER] {n} cases generated (pos: {p}, neg: {n}, edge: {e})
[PROBE_DESIGNER] Scalability flag: {flag}
```

---

### User Prompt Template

```
Design a complete probe plan for this module.

Functional Contract:
{functional_contract_json}

Module Blueprint:
{module_blueprint_json}

Follow this exact sequence for EACH API endpoint in the blueprint:

STEP 1 — Read the contract's expected_behaviors.
  Map each behavior to the endpoint it governs.
  These become your negative case sources.

STEP 2 — Form a gap hypothesis.
  Ask: "What is the most likely thing this endpoint does NOT handle correctly?"
  Base it on: missing validation guards in function_details, ambiguities in the contract,
  side effects that look untested, or response schemas with no error cases.

STEP 3 — Design positive cases.
  At least 2 valid inputs that should succeed.
  Use realistic values — not "test123" for names, not 1 for all integers.

STEP 4 — Design negative cases.
  One case per expected_behavior that involves rejection.
  Add cases for: missing required fields (one field at a time), wrong types, empty strings.

STEP 5 — Design edge cases.
  Boundary values (0, -1, max_int, empty string, null).
  Unicode / special characters in string fields.
  Extra unknown fields in payload (should be ignored or rejected — verify which).

STEP 6 — Static scalability scan.
  For each function in function_details, check side_effects.
  Flag patterns that indicate scalability risk without executing them.

STEP 7 — Assign priority.
  CRITICAL: failure causes data loss, security bypass, or silent corruption
  HIGH: failure causes incorrect user-facing behavior
  MEDIUM: failure causes bad UX or unhelpful error messages

Return ONLY the ProbePlan JSON.
```

---

### User Selection Prompt (shown in terminal after probe plan is ready)

```python
# This is Python CLI code, not an LLM prompt
# Render this in terminal after probe_plan.json is written

def show_probe_selection(probe_plan: dict) -> list[str]:
    print("\n" + "="*60)
    print("  PROBE PLAN READY")
    print("="*60)
    for p in probe_plan["probes"]:
        total = (len(p["positive_cases"]) + 
                 len(p["negative_cases"]) + 
                 len(p["edge_cases"]))
        print(f"  [{p['probe_id']}] {p['priority']:<8} {p['target_endpoint']}")
        print(f"         {p['gap_hypothesis']}")
        print(f"         Cases: {total} | Scalability flags: {len(p['scalability_flags'])}")
        print()
    print("="*60)
    print("Options:")
    print("  [A] Run ALL probes in parallel")
    print("  [S] Select specific probes (enter IDs: P01 P03)")
    print("  [C] Run CRITICAL only")
    choice = input("\nYour choice: ").strip().upper()
    
    if choice == "A":
        return [p["probe_id"] for p in probe_plan["probes"]]
    elif choice == "C":
        return [p["probe_id"] for p in probe_plan["probes"] if p["priority"] == "CRITICAL"]
    else:
        ids = choice.replace("S", "").strip().split()
        return [i for i in ids if i in {p["probe_id"] for p in probe_plan["probes"]}]
```

---

### Few-Shot Example (ProbePlan output)

```json
{
  "probes": [
    {
      "probe_id": "P01",
      "target_endpoint": "POST /payment",
      "method": "POST",
      "priority": "CRITICAL",
      "gap_hypothesis": "validate_amount() likely checks for None but not for <= 0, allowing negative charges to reach Stripe",
      "positive_cases": [
        {
          "case_id": "P01_POS_01",
          "desc": "Valid payment with realistic amount",
          "payload": { "amount": 249.99, "user_id": "usr_abc123", "card_token": "tok_visa" },
          "expected_status": 200,
          "expected_response_contains": { "payment_id": null, "status": "confirmed" }
        },
        {
          "case_id": "P01_POS_02",
          "desc": "Minimum valid amount",
          "payload": { "amount": 0.01, "user_id": "usr_abc123", "card_token": "tok_visa" },
          "expected_status": 200,
          "expected_response_contains": { "status": "confirmed" }
        }
      ],
      "negative_cases": [
        {
          "case_id": "P01_NEG_01",
          "desc": "Negative amount — should be rejected",
          "payload": { "amount": -500, "user_id": "usr_abc123", "card_token": "tok_visa" },
          "expected_status": 422,
          "expected_response_contains": { "detail": null }
        },
        {
          "case_id": "P01_NEG_02",
          "desc": "Missing user_id",
          "payload": { "amount": 100, "card_token": "tok_visa" },
          "expected_status": 422,
          "expected_response_contains": {}
        },
        {
          "case_id": "P01_NEG_03",
          "desc": "Amount as string — type coercion risk",
          "payload": { "amount": "hundred", "user_id": "usr_abc123", "card_token": "tok_visa" },
          "expected_status": 422,
          "expected_response_contains": {}
        }
      ],
      "edge_cases": [
        {
          "case_id": "P01_EDGE_01",
          "desc": "Amount = 0 — boundary",
          "payload": { "amount": 0, "user_id": "usr_abc123", "card_token": "tok_visa" },
          "expected_status": 422,
          "expected_response_contains": {}
        },
        {
          "case_id": "P01_EDGE_02",
          "desc": "Extra unknown field in payload",
          "payload": { "amount": 100, "user_id": "usr_abc123", "card_token": "tok_visa", "hack_field": "injected" },
          "expected_status": 200,
          "expected_response_contains": { "status": "confirmed" }
        }
      ],
      "scalability_flags": [
        "charge_card() makes synchronous Stripe API call — no timeout observed in code",
        "notify_user() called inline after charge — failure blocks response"
      ]
    }
  ],
  "total_probes": 1,
  "designer_notes": "The highest risk is validate_amount() not guarding against <= 0. Secondary risk is notify_user() being called synchronously — a SendGrid timeout would hang the payment response."
}
```

---
---

## AGENT 4 — Parallel Probe Executor (Per-Probe Loop)

### System Prompt (Reasoning model — called per probe result)

```
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
  "reasoning": string,              // one sentence explaining your decision
  "classification": "FUNCTIONAL_GAP" | "MISSING_VALIDATION" | "SCALABILITY_RISK" | null,
  "suggested_fix": string | null,   // specific, actionable. null if PASS.
  "retry_payload": object | null    // modified payload if FAIL_RETRY, else null
}

Emit trace lines to stderr:
[PROBE_EXECUTOR:{probe_id}] {method} {endpoint} {payload_summary} → {actual_status} ({response_time}ms)
[PROBE_EXECUTOR:{probe_id}] Decision: {decision} | {classification or "OK"}
[PROBE_EXECUTOR:{probe_id}] {reasoning}
```

---

### User Prompt Template (called after each case execution)

```
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
  Has this case been retried before? {already_retried}  // true | false

Reason about this result and return the ProbeDecision JSON.
Be specific. If FAIL_CONFIRMED, name the exact function and fix.
```

---

### Probe Executor Orchestrator (Python logic — not LLM)

```python
# agents/probe_executor.py
# This is the orchestration code around the LLM reasoning calls

import asyncio
import httpx
import time
from anthropic import Anthropic

client = Anthropic()

async def execute_single_case(
    base_url: str,
    probe: dict,
    case: dict,
    already_retried: bool = False
) -> dict:
    """Execute one probe case and get LLM reasoning on the result."""
    
    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            resp = await http.request(
                method=probe["method"],
                url=f"{base_url}{probe['target_endpoint'].split(' ')[1]}",
                json=case["payload"]
            )
        actual_status = resp.status_code
        response_body = resp.json() if resp.content else {}
        error = None
    except httpx.TimeoutException:
        actual_status = 0
        response_body = {}
        error = "TIMEOUT"
    except Exception as e:
        actual_status = 0
        response_body = {}
        error = str(e)
    
    response_time_ms = int((time.time() - start) * 1000)

    # Call reasoning model on this result
    decision = await reason_about_result(
        probe=probe,
        case=case,
        actual_status=actual_status,
        response_body=response_body,
        response_time_ms=response_time_ms,
        error=error,
        already_retried=already_retried
    )
    
    return decision


async def reason_about_result(
    probe, case, actual_status,
    response_body, response_time_ms, error, already_retried
) -> dict:
    """LLM reasoning call on probe execution result."""
    import json
    
    user_prompt = PROBE_REASONER_USER_TEMPLATE.format(
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
        response_body=json.dumps(response_body),
        response_time_ms=response_time_ms,
        error=error or "None",
        already_retried=str(already_retried).lower()
    )
    
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        system=PROBE_REASONER_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}]
    )
    
    import re
    text = response.content[0].text
    json_str = re.sub(r"```json|```", "", text).strip()
    return json.loads(json_str)


async def run_probe(base_url: str, probe: dict) -> dict:
    """
    Run all cases in one probe sequentially.
    Handle FAIL_RETRY by re-executing with retry_payload once.
    """
    results = []
    all_cases = (
        probe["positive_cases"] +
        probe["negative_cases"] +
        probe["edge_cases"]
    )
    
    for case in all_cases:
        decision = await execute_single_case(base_url, probe, case)
        
        # Handle retry
        if decision["decision"] == "FAIL_RETRY" and decision["retry_payload"]:
            retry_case = {**case, "payload": decision["retry_payload"]}
            decision = await execute_single_case(
                base_url, probe, retry_case, already_retried=True
            )
        
        results.append(decision)
    
    # Summarize probe result
    fails = [r for r in results if r["decision"] == "FAIL_CONFIRMED"]
    passes = [r for r in results if r["decision"] == "PASS"]
    confidence = len(passes) / len(results) if results else 0.0
    
    return {
        "probe_id": probe["probe_id"],
        "target_endpoint": probe["target_endpoint"],
        "priority": probe["priority"],
        "gap_hypothesis": probe["gap_hypothesis"],
        "confidence": round(confidence, 2),
        "total_cases": len(results),
        "passed": len(passes),
        "failed": len(fails),
        "gaps": [
            {
                "case_id": r["case_id"],
                "classification": r["classification"],
                "reasoning": r["reasoning"],
                "suggested_fix": r["suggested_fix"]
            }
            for r in fails
        ],
        "scalability_flags": probe["scalability_flags"]
    }


async def run_all_probes_parallel(
    base_url: str,
    probe_plan: dict,
    selected_probe_ids: list[str]
) -> dict:
    """
    Run selected probes in parallel using asyncio.gather.
    This is the LangGraph map-reduce equivalent for demo simplicity.
    """
    selected = [
        p for p in probe_plan["probes"]
        if p["probe_id"] in selected_probe_ids
    ]
    
    print(f"\n[PROBE_EXECUTOR] Running {len(selected)} probes in parallel...\n")
    
    tasks = [run_probe(base_url, probe) for probe in selected]
    results = await asyncio.gather(*tasks)
    
    return {
        probe_result["probe_id"]: probe_result
        for probe_result in results
    }
```

---

### LangGraph Node Definition (graph/pipeline.py additions)

```python
# For LangGraph integration — wraps the async executor as a node

from langgraph.graph import StateGraph, END
from langgraph.constants import Send
from typing import TypedDict, Annotated
import operator

class PipelineState(TypedDict):
    repo: str
    module_path: str
    functional_contract: dict
    module_blueprint: dict
    probe_plan: dict
    selected_probes: list[str]
    probe_results: Annotated[dict, operator.or_]  # merge parallel outputs
    audit_report: str

class ProbeState(TypedDict):
    probe: dict
    base_url: str
    result: dict

# Map: fan out one task per selected probe
def dispatch_probes(state: PipelineState) -> list[Send]:
    return [
        Send("probe_executor_node", {
            "probe": probe,
            "base_url": STAGING_BASE_URL
        })
        for probe in state["probe_plan"]["probes"]
        if probe["probe_id"] in state["selected_probes"]
    ]

# Reduce: each probe result merges back into PipelineState.probe_results
async def probe_executor_node(state: ProbeState) -> dict:
    result = await run_probe(state["base_url"], state["probe"])
    return {"probe_results": {result["probe_id"]: result}}

# Wire into graph
graph = StateGraph(PipelineState)
graph.add_node("intent_extractor", intent_extractor_node)
graph.add_node("code_analyst", code_analyst_node)
graph.add_node("probe_designer", probe_designer_node)
graph.add_node("probe_executor_node", probe_executor_node)
graph.add_node("report_synthesizer", report_synthesizer_node)

graph.set_entry_point("intent_extractor")
graph.add_edge("intent_extractor", "code_analyst")
graph.add_edge("code_analyst", "probe_designer")
graph.add_conditional_edges("probe_designer", dispatch_probes, ["probe_executor_node"])
graph.add_edge("probe_executor_node", "report_synthesizer")
graph.add_edge("report_synthesizer", END)
```

---

## Trace Output for Demo (What Judges See During Agent 4)

```
[PROBE_EXECUTOR] Running P01, P02, P03 in parallel...

[PROBE_EXECUTOR:P01] POST /payment {"amount": 249.99, ...} → 200 (143ms)
[PROBE_EXECUTOR:P01] Decision: PASS | OK
[PROBE_EXECUTOR:P01] Valid payment accepted correctly.

[PROBE_EXECUTOR:P01] POST /payment {"amount": -500, ...} → 200 (98ms)
[PROBE_EXECUTOR:P01] Decision: FAIL_CONFIRMED | MISSING_VALIDATION
[PROBE_EXECUTOR:P01] Negative amount accepted without rejection. validate_amount() has no <= 0 guard.
[PROBE_EXECUTOR:P01] Fix: Add Pydantic validator — amount: float = Field(..., gt=0)

[PROBE_EXECUTOR:P02] GET /payments {"user_id": "usr_abc"} → 200 (1843ms)
[PROBE_EXECUTOR:P02] Decision: FAIL_CONFIRMED | SCALABILITY_RISK
[PROBE_EXECUTOR:P02] Response time 1843ms. No pagination. Returning unbounded result set.
[PROBE_EXECUTOR:P02] Fix: Add limit/offset params. Add DB index on user_id.

[PROBE_EXECUTOR:P03] POST /refund {"payment_id": "pay_old_31days"} → 200 (201ms)
[PROBE_EXECUTOR:P03] Decision: FAIL_CONFIRMED | FUNCTIONAL_GAP
[PROBE_EXECUTOR:P03] Refund accepted for 31-day-old payment. Contract states max 30 days.
[PROBE_EXECUTOR:P03] Fix: Add date check in refund_service.py — raise 400 if age > 30 days.

[PROBE_EXECUTOR] All probes complete.
  Passed : 4/12 cases
  Failed : 8/12 cases
  Gaps   : 3 confirmed (1 CRITICAL, 1 HIGH, 1 HIGH)
```
