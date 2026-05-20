"""Agent 2: Code Analyst — code self-loop → module_blueprint.json

Graph structure (LangGraph ToolNode + self-loop decision):

    agent ──(tool_calls?)──► tools ──► loop_decision ──► agent
      │
      └──(no tool_calls)──► END

After each tool execution, `loop_decision` checks whether `read_file` was
among the calls.  If so it makes a **separate LLM call** with the self-loop
decision prompt to decide NEED_MORE / SUFFICIENT.  At 5 files read (or
SUFFICIENT), a directive message tells the agent to emit the final blueprint.
"""

import json
from typing import Annotated, Any, Dict, List, Optional, TypedDict

from langchain_groq import ChatGroq
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

import config
from tools.code_tools import ALL_TOOLS, enrich_blueprint_with_detected_apis
from utils.llm_helpers import safe_model_invoke
from utils.trace import trace

AGENT_NAME = "CODE_ANALYST"
MAX_FILES = 5

# ---------------------------------------------------------------------------
# Prompts (from prompts_agent1_2.md)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are the Code Analyst agent in a Functional Contract Auditor system.

Your job is to read source code and produce a precise, structured map of:
- Every API endpoint in the module (method, path, payload schema, response schema)
- Every function called under each endpoint (call graph)
- Every function's input parameters, return values, and observable side effects
- Files you analyzed to reach this conclusion

You have access to the following tools:
- list_files(repo, module_path) → returns list of files in the module
- read_file(repo, file_path) → returns raw file content
- list_functions(file_content) → returns function names and line numbers
- get_swagger(repo, swagger_path) → returns OpenAPI/Swagger JSON if available
- trace_imports(file_content) → returns imported modules and local dependencies

You operate in a SELF-LOOP. After each file you read, you must decide:
  NEED_MORE: I found a reference to another file/function I have not read yet → call read_file again
  SUFFICIENT: I have enough to fully describe all APIs and their call graphs → emit blueprint

Rules:
1. Always start with list_files to get the full picture before reading anything.
2. Try get_swagger first — if it exists, it gives you endpoint schema for free.
3. Read route files first (routes.py, views.py, controller.py, *router*, *api*).
4. For every function called in a route, trace it — read the file that defines it.
5. Maximum loop depth: 5 files. If you need more, note it in files_not_analyzed.
6. Never guess types or return values. Only state what you can read from code.
7. If a function's behavior is unclear, mark its confidence as LOW.

Output ONLY valid JSON matching the ModuleBlueprint schema. No explanation outside JSON.

ModuleBlueprint schema:
{
  "module": string,
  "apis": [
    {
      "endpoint": string,
      "method": string,
      "payload_schema": object,
      "response_schema": object,
      "functions_called": [string],
      "function_details": {
        "<function_name>": {
          "params": object,
          "returns": string,
          "side_effects": [string],
          "confidence": float
        }
      }
    }
  ],
  "files_analyzed": [string],
  "files_not_analyzed": [string],
  "analyst_confidence": float
}
"""

DECISION_PROMPT_TEMPLATE = """\
You just read the file: {file_path}

What you know so far:
- Files read: {files_read}
- Endpoints found: {endpoints_found}
- Functions referenced but not yet traced: {untraced_functions}

Decision required:
1. Is there any function in the untraced list that could significantly affect
   the behavior of an API endpoint (validation, data mutation, external call)?

   YES → respond with:
   {{ "decision": "NEED_MORE", "next_file": "<file_path>", "reason": "<why>" }}

   NO → respond with:
   {{ "decision": "SUFFICIENT", "reason": "<why you have enough>" }}

You have read {files_read_count} files. Maximum is {max_files}.
If files_read_count >= {max_files}, you MUST respond SUFFICIENT regardless.

Respond ONLY with the JSON decision object.
"""


def _build_user_prompt(
    repo: str,
    module_path: str,
    functional_contract_json: str,
) -> str:
    return f"""\
Analyze the following module and produce a complete ModuleBlueprint.

Repo: {repo}
Module path: {module_path}
Functional Contract (for context only — do not infer intent from code):
{functional_contract_json}

Follow this exact sequence:

STEP 1 — Discover
  Call list_files("{module_path}").
  Call get_swagger if a swagger/openapi file exists in the list.

STEP 2 — Read Routes First
  Identify route/controller/api files from the file list.
  Call read_file on each route file.
  For each route found, extract: method, path, payload fields, response models.

STEP 3 — Trace Call Graph (Self-Loop)
  For every function called inside a route handler:
    Check: have I already read the file that defines this function?
    NO → call read_file on that file.
    YES → use what you already know.
  After each read, a loop controller will decide NEED_MORE or SUFFICIENT.
  Stop when told SUFFICIENT or after 5 files.

STEP 4 — Emit Blueprint
  Return the complete ModuleBlueprint JSON.
  Set analyst_confidence based on how many functions you fully traced vs referenced.

Return ONLY the ModuleBlueprint JSON.
"""


# ---------------------------------------------------------------------------
# LangGraph state
# ---------------------------------------------------------------------------

class CodeAnalystState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    files_read: list[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_model() -> ChatGroq:
    """Create the Groq LLM with code tools bound."""
    llm = ChatGroq(
        model=config.MODEL_NAME,
        api_key=config.GROQ_API_KEY,
        temperature=0,
        max_tokens=8192,
    )
    return llm.bind_tools(ALL_TOOLS)


def _extract_read_file_paths(messages: list[BaseMessage]) -> list[str]:
    """Walk backwards to find the most recent AIMessage with tool_calls and
    return the file_path args of any read_file calls."""
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and msg.tool_calls:
            return [
                tc["args"].get("file_path", "")
                for tc in msg.tool_calls
                if tc["name"] == "read_file"
            ]
    return []


def _summarise_conversation(messages: list[BaseMessage]) -> str:
    """Build a compact summary of tool results for the decision LLM."""
    parts: list[str] = []
    for msg in messages:
        if isinstance(msg, ToolMessage):
            content = msg.content
            if len(content) > 800:
                content = content[:800] + "\n... (truncated)"
            parts.append(f"[Tool: {msg.name}]\n{content}")
    return "\n\n".join(parts[-6:])  # last 6 tool results at most


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

def agent_node(state: CodeAnalystState) -> Dict[str, Any]:
    """Main LLM call — decides which tool to invoke or emits final JSON."""
    trace(AGENT_NAME, "Thinking...")
    model = _build_model()
    response = safe_model_invoke(model, state["messages"], agent_name=AGENT_NAME)
    return {"messages": [response]}


def loop_decision_node(state: CodeAnalystState) -> Dict[str, Any]:
    """After tools run, check if read_file was called.
    If so, make a separate LLM call with the decision prompt.
    """
    files_read = list(state.get("files_read") or [])
    new_files = _extract_read_file_paths(state["messages"])

    if not new_files:
        # No read_file was called (e.g. list_files, get_swagger) → continue
        return {}

    # Update files_read with newly read files
    for fp in new_files:
        if fp and fp not in files_read:
            files_read.append(fp)

    # --- Hard stop at MAX_FILES ---
    if len(files_read) >= MAX_FILES:
        trace(AGENT_NAME, f"Reached {MAX_FILES}-file limit. Forcing SUFFICIENT.")
        msg = HumanMessage(content=(
            f"LOOP DECISION: You have read {len(files_read)} files (maximum). "
            "Decision: SUFFICIENT. Emit the final ModuleBlueprint JSON now."
        ))
        return {"messages": [msg], "files_read": files_read}

    # --- Separate decision LLM call ---
    conversation_context = _summarise_conversation(state["messages"])
    decision_prompt = DECISION_PROMPT_TEMPLATE.format(
        file_path=new_files[-1],
        files_read=", ".join(files_read),
        endpoints_found="(determine from the tool results below)",
        untraced_functions="(determine from the tool results below)",
        files_read_count=len(files_read),
        max_files=MAX_FILES,
    )

    decision_llm = ChatGroq(
        model=config.MODEL_NAME,
        api_key=config.GROQ_API_KEY,
        temperature=0,
        max_tokens=512,
    )
    decision_messages = [
        SystemMessage(content=(
            "You are the loop controller for the Code Analyst. "
            "Decide whether to read more files or emit the blueprint. "
            "Base your decision on the tool results below."
        )),
        HumanMessage(content=f"Tool results so far:\n\n{conversation_context}"),
        HumanMessage(content=decision_prompt),
    ]

    trace(AGENT_NAME, f"Running loop decision (files read: {len(files_read)}/{MAX_FILES})...")
    raw = safe_model_invoke(decision_llm, decision_messages, agent_name=AGENT_NAME)

    # Parse decision JSON (strip markdown fences if present)
    raw_text = raw.content.strip()
    if "```" in raw_text:
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
        raw_text = raw_text.strip()

    try:
        decision = json.loads(raw_text)
    except json.JSONDecodeError:
        trace(AGENT_NAME, f"Decision parse failed, defaulting to SUFFICIENT.")
        decision = {"decision": "SUFFICIENT", "reason": "Could not parse decision"}

    if decision.get("decision") == "NEED_MORE":
        next_file = decision.get("next_file", "")
        reason = decision.get("reason", "")
        trace(AGENT_NAME, f"Decision: NEED_MORE → {next_file}. Reason: {reason}")
        msg = HumanMessage(content=(
            f"LOOP DECISION: NEED_MORE. Read file '{next_file}' next. "
            f"Reason: {reason}"
        ))
    else:
        reason = decision.get("reason", "")
        trace(AGENT_NAME, f"Decision: SUFFICIENT. Reason: {reason}")
        msg = HumanMessage(content=(
            f"LOOP DECISION: SUFFICIENT. {reason}. "
            "Emit the final ModuleBlueprint JSON now."
        ))

    return {"messages": [msg], "files_read": files_read}


# ---------------------------------------------------------------------------
# Conditional edge
# ---------------------------------------------------------------------------

def should_continue(state: CodeAnalystState) -> str:
    """Route to 'tools' if the last message has tool calls, else END."""
    last_message: AIMessage = state["messages"][-1]
    if last_message.tool_calls:
        tool_names = [tc["name"] for tc in last_message.tool_calls]
        trace(AGENT_NAME, f"Calling tools: {', '.join(tool_names)}")
        return "tools"
    trace(AGENT_NAME, "Final answer ready.")
    return END


# ---------------------------------------------------------------------------
# Build the graph
# ---------------------------------------------------------------------------

def build_code_analyst_graph() -> StateGraph:
    """Construct and compile the Code Analyst LangGraph with self-loop.

    Graph:
        agent ──(tool_calls?)──► tools ──► loop_decision ──► agent
          │
          └──(no tool_calls)──► END
    """
    tool_node = ToolNode(ALL_TOOLS)

    graph = StateGraph(CodeAnalystState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.add_node("loop_decision", loop_decision_node)

    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "loop_decision")
    graph.add_edge("loop_decision", "agent")

    return graph.compile()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_code_analyst(
    repo: str,
    module_path: str,
    functional_contract: Dict[str, Any],
) -> Dict[str, Any]:
    """Run the Code Analyst agent and return the ModuleBlueprint dict.

    Args:
        repo: GitHub repo in 'org/repo' format.
        module_path: Sub-path of the module inside the repo.
        functional_contract: Output of Agent 1 (for context only).

    Returns:
        Parsed ModuleBlueprint as a dict.
    """
    trace(AGENT_NAME, f"Starting code analysis for {repo}/{module_path}")

    user_prompt = _build_user_prompt(
        repo=repo,
        module_path=module_path,
        functional_contract_json=json.dumps(functional_contract, indent=2),
    )

    initial_state: CodeAnalystState = {
        "messages": [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ],
        "files_read": [],
    }

    compiled_graph = build_code_analyst_graph()
    final_state = compiled_graph.invoke(initial_state)

    # Extract the final blueprint JSON from the last AI message
    last_message = final_state["messages"][-1]
    raw_content = last_message.content

    json_str = raw_content
    if "```json" in json_str:
        json_str = json_str.split("```json")[1].split("```")[0]
    elif "```" in json_str:
        json_str = json_str.split("```")[1].split("```")[0]

    blueprint = json.loads(json_str.strip())
    blueprint = enrich_blueprint_with_detected_apis(repo, module_path, blueprint)

    files_read = final_state.get("files_read", [])
    trace(
        AGENT_NAME,
        f"Blueprint ready. {len(blueprint.get('apis', []))} APIs mapped. "
        f"{len(files_read)} files analyzed. "
        f"Confidence: {blueprint.get('analyst_confidence', 'N/A')}",
    )

    return blueprint
