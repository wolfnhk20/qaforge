"""LangGraph pipeline wiring for the full backend."""

from __future__ import annotations

import json
import operator
from typing import Annotated, Optional, TypedDict

from langgraph.constants import Send
from langgraph.graph import END, StateGraph

import config
from agents.code_analyst import run_code_analyst
from utils.target_url import TargetUrlError, resolve_audit_base_url
from agents.intent_extractor import run_intent_extractor
from agents.probe_designer import run_probe_designer, show_probe_selection
from agents.probe_executor import run_probe
from agents.report_synthesizer import run_report_synthesizer
from utils.trace import trace


class PipelineState(TypedDict):
    """Full pipeline state flowing through all nodes."""

    repo: str
    module_path: str
    scope: str
    pr_number: Optional[int]
    base_commit: Optional[str]
    head_commit: Optional[str]
    branch: str
    auto_run: bool
    functional_contract: Optional[dict]
    module_blueprint: Optional[dict]
    probe_plan: Optional[dict]
    selected_probes: Optional[list[str]]
    probe_results: Annotated[dict, operator.or_]
    audit_report: Optional[str]
    report_path: Optional[str]
    github_issue_urls: Optional[list[str]]
    base_url: Optional[str]
    errors: Annotated[list, operator.add]


class ProbeState(TypedDict):
    """Per-probe state for the parallel executor nodes."""

    probe: dict
    base_url: str


def _write_output(filename: str, payload: dict) -> None:
    """Write JSON output into the repo-root outputs directory."""
    config.ensure_runtime_dirs()
    output_path = config.OUTPUTS_DIR / filename
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def intent_extractor_node(state: PipelineState) -> dict:
    trace("PIPELINE", "Starting Agent 1: Intent Extractor...")
    try:
        contract = run_intent_extractor(
            repo=state["repo"],
            module_path=state["module_path"],
            scope=state.get("scope", "full_module"),
            branch=state.get("branch", "main"),
            pr_number=state.get("pr_number"),
            base_commit=state.get("base_commit"),
            head_commit=state.get("head_commit"),
        )
        trace(
            "PIPELINE",
            f"Agent 1 done. {len(contract.get('expected_behaviors', []))} behaviors extracted.",
        )
        _write_output("agent1_contract.json", contract)
        _write_output("functional_contract.json", contract)
        return {"functional_contract": contract}
    except Exception as exc:
        trace("PIPELINE", f"Agent 1 ERROR: {exc}")
        return {"errors": [f"intent_extractor: {exc}"]}


def code_analyst_node(state: PipelineState) -> dict:
    trace("PIPELINE", "Starting Agent 2: Code Analyst...")
    try:
        blueprint = run_code_analyst(
            repo=state["repo"],
            module_path=state["module_path"],
            functional_contract=state.get("functional_contract") or {},
        )
        trace("PIPELINE", f"Agent 2 done. {len(blueprint.get('apis', []))} APIs mapped.")
        _write_output("agent2_blueprint.json", blueprint)
        _write_output("module_blueprint.json", blueprint)
        return {"module_blueprint": blueprint}
    except Exception as exc:
        trace("PIPELINE", f"Agent 2 ERROR: {exc}")
        return {"errors": [f"code_analyst: {exc}"]}


def probe_designer_node(state: PipelineState) -> dict:
    trace("PIPELINE", "Starting Agent 3: Probe Designer...")
    try:
        plan = run_probe_designer(
            functional_contract=state.get("functional_contract") or {},
            module_blueprint=state.get("module_blueprint") or {},
        )
        trace("PIPELINE", f"Agent 3 done. {len(plan.get('probes', []))} probes designed.")
        _write_output("agent3_probe_plan.json", plan)
        _write_output("probe_plan.json", plan)
        return {"probe_plan": plan}
    except Exception as exc:
        trace("PIPELINE", f"Agent 3 ERROR: {exc}")
        return {"errors": [f"probe_designer: {exc}"]}


def probe_selection_node(state: PipelineState) -> dict:
    trace("PIPELINE", "Waiting for user probe selection...")
    try:
        plan = state.get("probe_plan") or {"probes": []}
        if state.get("auto_run"):
            selected = [probe["probe_id"] for probe in plan.get("probes", [])]
            trace("PIPELINE", f"Auto-run enabled. Selecting all {len(selected)} probes.")
            result: dict = {"selected_probes": selected}
        else:
            selected = show_probe_selection(plan)
            trace("PIPELINE", f"User selected {len(selected)} probes: {selected}")
            result = {"selected_probes": selected}

        try:
            result["base_url"] = resolve_audit_base_url(state.get("base_url"), required=True)
        except TargetUrlError as exc:
            trace("PIPELINE", f"Target URL validation failed: {exc}")
            result["errors"] = [f"target_url: {exc}"]
        return result
    except Exception as exc:
        trace("PIPELINE", f"Probe selection ERROR: {exc}")
        all_ids = [probe["probe_id"] for probe in (state.get("probe_plan") or {}).get("probes", [])]
        return {"selected_probes": all_ids, "errors": [f"probe_selection: {exc}"]}


async def probe_executor_node(state: ProbeState) -> dict:
    probe = state["probe"]
    probe_id = probe.get("probe_id", "?")
    trace("PIPELINE", f"Executing probe {probe_id}...")
    try:
        result = await run_probe(state["base_url"], probe)
        trace(
            "PIPELINE",
            f"Probe {probe_id} done. {result.get('passed', 0)}/{result.get('total_cases', 0)} passed.",
        )
        try:
            from api.service import flatten_findings
            flat = flatten_findings({result["probe_id"]: result})
            from utils.trace import event_emitter
            emitter = event_emitter.get()
            if emitter:
                emitter("findings", flat)
        except Exception:
            pass
        return {"probe_results": {result["probe_id"]: result}}
    except Exception as exc:
        trace("PIPELINE", f"Probe {probe_id} ERROR: {exc}")
        return {"probe_results": {probe_id: {"error": str(exc)}}}


def dispatch_probes(state: PipelineState) -> list[Send]:
    """Create one Send step per selected probe."""
    plan = state.get("probe_plan") or {"probes": []}
    selected = state.get("selected_probes") or []
    base_url = state.get("base_url")

    if not base_url:
        trace("PIPELINE", "Skipping probe dispatch — no valid staging base URL in audit context.")
        return []

    sends = [
        Send("probe_executor_node", {"probe": probe, "base_url": base_url})
        for probe in plan["probes"]
        if probe["probe_id"] in selected
    ]
    trace("PIPELINE", f"Dispatching {len(sends)} probes against {base_url}...")
    return sends


def report_synthesizer_node(state: PipelineState) -> dict:
    trace("PIPELINE", "Starting Agent 5: Report Synthesizer...")
    try:
        probe_results = state.get("probe_results") or {}
        _write_output("agent4_probe_results.json", probe_results)
        _write_output("probe_results.json", probe_results)

        result = run_report_synthesizer(
            repo=state["repo"],
            module_path=state["module_path"],
            scope=state.get("scope", "full_module"),
            functional_contract=state.get("functional_contract") or {},
            module_blueprint=state.get("module_blueprint") or {},
            probe_results=probe_results,
        )
        trace("PIPELINE", f"Agent 5 done. Report written to {result.get('report_path', '?')}")
        return {
            "audit_report": result.get("audit_report"),
            "report_path": result.get("report_path"),
            "github_issue_urls": result.get("github_issue_urls", []),
        }
    except Exception as exc:
        trace("PIPELINE", f"Agent 5 ERROR: {exc}")
        return {"errors": [f"report_synthesizer: {exc}"]}


def build_pipeline() -> StateGraph:
    """Build and compile the full five-agent pipeline."""
    graph = StateGraph(PipelineState)
    graph.add_node("intent_extractor", intent_extractor_node)
    graph.add_node("code_analyst", code_analyst_node)
    graph.add_node("probe_designer", probe_designer_node)
    graph.add_node("probe_selection", probe_selection_node)
    graph.add_node("probe_executor_node", probe_executor_node)
    graph.add_node("report_synthesizer", report_synthesizer_node)

    graph.set_entry_point("intent_extractor")
    graph.add_edge("intent_extractor", "code_analyst")
    graph.add_edge("code_analyst", "probe_designer")
    graph.add_edge("probe_designer", "probe_selection")
    graph.add_conditional_edges("probe_selection", dispatch_probes, ["probe_executor_node"])
    graph.add_edge("probe_executor_node", "report_synthesizer")
    graph.add_edge("report_synthesizer", END)

    return graph.compile()


pipeline = build_pipeline()
