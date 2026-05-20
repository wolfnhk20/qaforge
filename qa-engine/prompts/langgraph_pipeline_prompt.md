# Cursor Prompt: LangGraph Pipeline — Full Wiring

---

## Paste This Entire Block Into Cursor

```
You are implementing the LangGraph pipeline for a Functional Contract Auditor Agent system.
This pipeline wires 5 agents together into a single runnable graph.

Read every word carefully before writing a single line of code.

---

## WHAT ALREADY EXISTS (do not rewrite these)

agents/intent_extractor.py     → async def run_intent_extractor(state) -> dict
agents/code_analyst.py         → async def run_code_analyst(state) -> dict
agents/probe_designer.py       → async def run_probe_designer(state) -> dict
agents/probe_executor.py       → async def run_probe(base_url, probe) -> dict
agents/report_synthesizer.py   → async def run_report_synthesizer(state) -> dict

tools/github_tools.py          → all GitHub API calls
tools/probe_tools.py           → execute_api_call, validate_response
tools/report_tools.py          → push_github_issue, write_markdown

models/contract.py             → FunctionalContract (Pydantic)
models/blueprint.py            → ModuleBlueprint (Pydantic)
models/probe.py                → ProbePlan, ProbeResult (Pydantic)
models/report.py               → AuditReport (Pydantic)

config.py                      → ANTHROPIC_API_KEY, GITHUB_TOKEN, STAGING_BASE_URL

---

## YOUR JOB

Create graph/pipeline.py that does the following:

---

### STEP 1 — Define PipelineState

Use TypedDict. Every field must be Optional with default None except probe_results
which uses Annotated with operator.or_ for parallel merge.

Fields:
  # Input
  repo: str
  module_path: str
  scope: str                    # "full_module" | "pr" | "commit_range"
  pr_number: Optional[int]
  base_commit: Optional[str]
  head_commit: Optional[str]
  branch: str

  # Agent 1 output
  functional_contract: Optional[dict]

  # Agent 2 output
  module_blueprint: Optional[dict]

  # Agent 3 output
  probe_plan: Optional[dict]

  # User selection (set after probe plan is shown)
  selected_probes: Optional[list[str]]

  # Agent 4 output — parallel merge
  probe_results: Annotated[dict, operator.or_]

  # Agent 5 output
  audit_report: Optional[str]
  github_issue_url: Optional[str]

  # Trace metadata
  errors: Annotated[list, operator.add]   # collect errors from any node

---

### STEP 2 — Define Each Node

Create one async function per agent. Each function:
  - Receives full PipelineState
  - Calls the corresponding agent function
  - Emits a trace line to stderr before and after
  - Catches exceptions, appends to state["errors"], returns partial state
  - Returns ONLY the fields it updates (not the full state)

Node signatures:
  async def intent_extractor_node(state: PipelineState) -> dict
  async def code_analyst_node(state: PipelineState) -> dict
  async def probe_designer_node(state: PipelineState) -> dict
  async def probe_executor_node(state: ProbeState) -> dict   ← different state
  async def report_synthesizer_node(state: PipelineState) -> dict

For probe_executor_node, define a separate ProbeState TypedDict:
  class ProbeState(TypedDict):
      probe: dict
      base_url: str

The node calls run_probe(state["base_url"], state["probe"]) and returns:
  {"probe_results": {result["probe_id"]: result}}

---

### STEP 3 — User Selection Node (IMPORTANT)

Create a synchronous node called probe_selection_node(state: PipelineState) -> dict

This node:
1. Prints the probe plan to terminal in this exact format:
   ============================================================
     PROBE PLAN READY — {total_probes} probes designed
   ============================================================
     [P01] CRITICAL   POST /payment
            {gap_hypothesis}
            Cases: {total} | Scalability flags: {n}

     [P02] HIGH       GET /payments
            ...
   ============================================================
   Options:
     [A] Run ALL probes in parallel
     [C] Run CRITICAL only
     [S] Select specific (enter IDs: P01 P03)
   ============================================================

2. Takes user input from terminal (input() is fine — this is a hackathon)
3. Returns {"selected_probes": [list of probe_ids based on selection]}

Do NOT make this an LLM call. Pure Python CLI.

---

### STEP 4 — Dispatch Function (Map Step)

Create a function that fans out parallel probe execution:

def dispatch_probes(state: PipelineState) -> list[Send]:
    from langgraph.constants import Send
    return [
        Send("probe_executor_node", {
            "probe": probe,
            "base_url": STAGING_BASE_URL
        })
        for probe in state["probe_plan"]["probes"]
        if probe["probe_id"] in (state["selected_probes"] or [])
    ]

---

### STEP 5 — Build the Graph

from langgraph.graph import StateGraph, END

graph_builder = StateGraph(PipelineState)

Add nodes:
  graph_builder.add_node("intent_extractor", intent_extractor_node)
  graph_builder.add_node("code_analyst", code_analyst_node)
  graph_builder.add_node("probe_designer", probe_designer_node)
  graph_builder.add_node("probe_selection", probe_selection_node)
  graph_builder.add_node("probe_executor_node", probe_executor_node)
  graph_builder.add_node("report_synthesizer", report_synthesizer_node)

Add edges:
  graph_builder.set_entry_point("intent_extractor")
  graph_builder.add_edge("intent_extractor", "code_analyst")
  graph_builder.add_edge("code_analyst", "probe_designer")
  graph_builder.add_edge("probe_designer", "probe_selection")
  graph_builder.add_conditional_edges(
      "probe_selection",
      dispatch_probes,
      ["probe_executor_node"]
  )
  graph_builder.add_edge("probe_executor_node", "report_synthesizer")
  graph_builder.add_edge("report_synthesizer", END)

Compile:
  pipeline = graph_builder.compile()

---

### STEP 6 — Trace Logger (use this everywhere)

import sys

def trace(agent: str, msg: str):
    print(f"[{agent}] {msg}", file=sys.stderr, flush=True)

Call trace() at these moments in every node:
  - Before calling the agent function:  "[NODE] Starting..."
  - After success:                      "[NODE] Done. {key output summary}"
  - On exception:                       "[NODE] ERROR: {str(e)}"

---

### STEP 7 — Entry Point in main.py

Create main.py with this structure:

import asyncio
import argparse
from graph.pipeline import pipeline
from config import STAGING_BASE_URL

def parse_args():
    parser = argparse.ArgumentParser(description="Functional Contract Auditor")
    parser.add_argument("--repo",        required=True,  help="org/repo")
    parser.add_argument("--module",      required=True,  help="module path in repo")
    parser.add_argument("--scope",       default="full_module",
                        choices=["full_module", "pr", "commit_range"])
    parser.add_argument("--pr",          type=int,       help="PR number")
    parser.add_argument("--from-commit", dest="base_commit")
    parser.add_argument("--to-commit",   dest="head_commit")
    parser.add_argument("--branch",      default="main")
    return parser.parse_args()

async def main():
    args = parse_args()

    initial_state = {
        "repo":         args.repo,
        "module_path":  args.module,
        "scope":        args.scope,
        "pr_number":    args.pr,
        "base_commit":  args.base_commit,
        "head_commit":  args.head_commit,
        "branch":       args.branch,
        "probe_results": {},
        "errors": []
    }

    print("\n" + "="*60)
    print("  FUNCTIONAL CONTRACT AUDITOR")
    print(f"  Repo: {args.repo} | Module: {args.module}")
    print("="*60 + "\n")

    final_state = await pipeline.ainvoke(initial_state)

    print("\n" + "="*60)
    print("  AUDIT COMPLETE")
    print(f"  Gaps found : {count_gaps(final_state['probe_results'])}")
    print(f"  Report     : outputs/audit_report.md")
    if final_state.get("github_issue_url"):
        print(f"  GitHub     : {final_state['github_issue_url']}")
    if final_state.get("errors"):
        print(f"  Errors     : {len(final_state['errors'])} (check trace log)")
    print("="*60 + "\n")

def count_gaps(probe_results: dict) -> int:
    return sum(
        len(r.get("gaps", []))
        for r in probe_results.values()
    )

if __name__ == "__main__":
    asyncio.run(main())

---

### STEP 8 — requirements.txt

Generate this file:

langgraph>=0.2.0
langchain-anthropic>=0.2.0
anthropic>=0.30.0
pydantic>=2.0.0
httpx>=0.27.0
PyGithub>=2.3.0
python-dotenv>=1.0.0

---

### STEP 9 — config.py

import os
from dotenv import load_dotenv
load_dotenv()

ANTHROPIC_API_KEY  = os.getenv("ANTHROPIC_API_KEY")
GITHUB_TOKEN       = os.getenv("GITHUB_TOKEN")
STAGING_BASE_URL   = os.getenv("STAGING_BASE_URL", "http://localhost:8000")
MAX_FILES_TO_ANALYZE = 5
MAX_PROBE_RETRIES    = 1
PROBE_TIMEOUT_SECONDS = 5.0

---

## RULES FOR CURSOR

1. Do not hallucinate imports. Only import what exists in the files listed above.
2. Do not implement any agent logic inside pipeline.py. Only wire and call.
3. Every node must have try/except. Errors go to state["errors"], node returns partial state.
4. probe_executor_node uses ProbeState not PipelineState. Get this right.
5. The parallel merge works because probe_results uses Annotated[dict, operator.or_].
   Each probe_executor_node call returns {"probe_results": {"P01": ...}}.
   LangGraph merges all of them automatically. Do not manually collect results.
6. probe_selection_node is synchronous (not async). That is intentional.
7. main.py uses pipeline.ainvoke() not pipeline.invoke() because nodes are async.
8. Write the full file for each: graph/pipeline.py, main.py, requirements.txt, config.py.
   Do not truncate. Do not add placeholder comments like "# implement this".

Start with graph/pipeline.py.
```
