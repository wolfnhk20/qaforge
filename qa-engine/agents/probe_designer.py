"""Agent 3: Probe Designer — contract + blueprint → probe_plan.json

Unlike Agents 1 & 2, the Probe Designer has NO tools. It is a single-shot
reasoning call: given the contract and blueprint, the LLM designs all probes
in one pass. No ToolNode needed — just a direct LLM invocation.

It also includes the interactive CLI for probe selection before execution.
"""

import json
from typing import Any, Dict, List, Optional

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

import config
from utils.trace import trace

AGENT_NAME = "PROBE_DESIGNER"

# ---------------------------------------------------------------------------
# Prompts (from prompts_agent3_4.md)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
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
      "probe_id": string,
      "target_endpoint": string,
      "method": string,
      "priority": "CRITICAL" | "HIGH" | "MEDIUM",
      "gap_hypothesis": string,
      "positive_cases": [
        {
          "case_id": string,
          "desc": string,
          "payload": object,
          "expected_status": int,
          "expected_response_contains": object
        }
      ],
      "negative_cases": [...],
      "edge_cases": [...],
      "scalability_flags": [string]
    }
  ],
  "total_probes": int,
  "designer_notes": string
}
"""


def _build_user_prompt(
    functional_contract_json: str,
    module_blueprint_json: str,
) -> str:
    return f"""\
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
"""


# ---------------------------------------------------------------------------
# Probe selection CLI (from prompts_agent3_4.md)
# ---------------------------------------------------------------------------

def show_probe_selection(probe_plan: dict) -> List[str]:
    """Interactive CLI for users to select which probes to run.

    Returns:
        List of selected probe IDs.
    """
    print("\n" + "=" * 60)
    print("  PROBE PLAN READY")
    print("=" * 60)
    for p in probe_plan["probes"]:
        total = (
            len(p.get("positive_cases", []))
            + len(p.get("negative_cases", []))
            + len(p.get("edge_cases", []))
        )
        print(f"  [{p['probe_id']}] {p['priority']:<8} {p['target_endpoint']}")
        print(f"         {p['gap_hypothesis']}")
        print(f"         Cases: {total} | Scalability flags: {len(p.get('scalability_flags', []))}")
        print()
    print("=" * 60)
    print("Options:")
    print("  [A] Run ALL probes in parallel")
    print("  [S] Select specific probes (enter IDs: P01 P03)")
    print("  [C] Run CRITICAL only")
    choice = input("\nYour choice: ").strip().upper()

    if choice == "A":
        return [p["probe_id"] for p in probe_plan["probes"]]
    elif choice == "C":
        return [
            p["probe_id"]
            for p in probe_plan["probes"]
            if p["priority"] == "CRITICAL"
        ]
    else:
        ids = choice.replace("S", "").strip().split()
        valid_ids = {p["probe_id"] for p in probe_plan["probes"]}
        return [i for i in ids if i in valid_ids]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_probe_designer(
    functional_contract: Dict[str, Any],
    module_blueprint: Dict[str, Any],
) -> Dict[str, Any]:
    """Run the Probe Designer agent (single-shot LLM call, no tools).

    Args:
        functional_contract: Output of Agent 1.
        module_blueprint: Output of Agent 2.

    Returns:
        Parsed ProbePlan as a dict.
    """
    trace(AGENT_NAME, "Designing adversarial probes...")

    user_prompt = _build_user_prompt(
        functional_contract_json=json.dumps(functional_contract, indent=2),
        module_blueprint_json=json.dumps(module_blueprint, indent=2),
    )

    llm = ChatGroq(
        model=config.MODEL_NAME,
        api_key=config.GROQ_API_KEY,
        temperature=0,
        max_tokens=8192,
    )

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_prompt),
    ]

    response = llm.invoke(messages)
    raw_content = response.content

    # Parse JSON (strip markdown fences if present)
    json_str = raw_content
    if "```json" in json_str:
        json_str = json_str.split("```json")[1].split("```")[0]
    elif "```" in json_str:
        json_str = json_str.split("```")[1].split("```")[0]

    probe_plan = json.loads(json_str.strip())

    # Emit trace lines
    for p in probe_plan.get("probes", []):
        n_cases = (
            len(p.get("positive_cases", []))
            + len(p.get("negative_cases", []))
            + len(p.get("edge_cases", []))
        )
        trace(AGENT_NAME, f"Designing probes for {p.get('target_endpoint', '?')}...")
        trace(AGENT_NAME, f"Gap hypothesis: {p.get('gap_hypothesis', '?')}")
        trace(
            AGENT_NAME,
            f"{n_cases} cases generated (pos: {len(p.get('positive_cases', []))}, "
            f"neg: {len(p.get('negative_cases', []))}, "
            f"edge: {len(p.get('edge_cases', []))})",
        )
        for flag in p.get("scalability_flags", []):
            trace(AGENT_NAME, f"Scalability flag: {flag}")

    total = probe_plan.get("total_probes", len(probe_plan.get("probes", [])))
    trace(AGENT_NAME, f"Probe plan complete. {total} probes designed.")

    return probe_plan
