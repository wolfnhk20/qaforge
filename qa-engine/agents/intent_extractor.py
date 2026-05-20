"""Agent 1: Intent Extractor."""

import json
from typing import Annotated, Any, Dict, Optional, TypedDict

from langchain_groq import ChatGroq
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

import config
from tools.github_tools import get_commits, get_diff, get_pr_description, get_readme
from utils.llm_helpers import safe_model_invoke
from utils.trace import trace

AGENT_NAME = "INTENT_EXTRACTOR"

BASE_SYSTEM_PROMPT = """\
You are the Intent Extractor agent in a Functional Contract Auditor system.

Your job is to understand what a software module is supposed to do, not what it does.
You read developer-written artifacts: README, commit messages, PR descriptions, and code diffs.
You extract the functional contract: the behaviors the module is expected to guarantee.

Rules:
1. Always call get_readme first. It is the primary source of intent.
2. Always call get_commits to understand recent changes and drift from original intent.
3. Only call get_pr_description when a PR number is provided and the audit scope is `pr`.
4. Only call get_diff when both commits are provided and the audit scope is `commit_range`.
5. Do not read source code. That is the Code Analyst's job.
6. Do not infer behavior from implementation. Only from developer-written documentation.
7. If intent is ambiguous or missing, explicitly flag it as LOW_CONFIDENCE in your output.

Output only valid JSON matching the FunctionalContract schema. No explanation outside JSON.

FunctionalContract schema:
{
  "module": string,
  "repo": string,
  "scope": "full_module" | "pr" | "commit_range",
  "intent": string,
  "recent_changes": [string],
  "expected_behaviors": [string],
  "ambiguities": [string],
  "confidence": float
}
"""


def _select_tools(
    scope: str,
    pr_number: Optional[int],
    base_commit: Optional[str],
    head_commit: Optional[str],
) -> list:
    """Expose only the GitHub tools that are valid for the current scope."""
    tools = [get_readme, get_commits]
    if scope == "pr" and pr_number is not None:
        tools.append(get_pr_description)
    if scope == "commit_range" and base_commit and head_commit:
        tools.append(get_diff)
    return tools


def _build_system_prompt(available_tools: list) -> str:
    tool_descriptions = {
        "get_readme": "get_readme(repo, module_path) -> returns README or module-level docstring",
        "get_commits": "get_commits(repo, branch, last_n) -> returns list of commit messages and authors",
        "get_pr_description": "get_pr_description(repo, pr_number) -> returns PR title, body, and labels",
        "get_diff": "get_diff(repo, base_commit, head_commit) -> returns unified diff of changes",
    }
    tool_lines = "\n".join(f"- {tool_descriptions[tool.name]}" for tool in available_tools)
    return f"{BASE_SYSTEM_PROMPT}\nYou have access to the following tools:\n{tool_lines}\n"


def _build_user_prompt(
    repo: str,
    module_path: str,
    scope: str,
    branch: str = "main",
    pr_number: Optional[int] = None,
    base_commit: Optional[str] = None,
    head_commit: Optional[str] = None,
) -> str:
    return f"""\
Extract the functional contract for the following target.

Repo: {repo}
Module path: {module_path}
Scope: {scope}
PR number (if scope=pr): {pr_number or 'N/A'}
Base commit (if scope=commit_range): {base_commit or 'N/A'}
Head commit (if scope=commit_range): {head_commit or 'N/A'}
Branch: {branch}

Steps to follow:
1. Call get_readme for this module. Extract what it promises to do.
2. Call get_commits (last 5). Identify what has changed recently and why.
3. If scope is `pr` and a PR number is provided, call get_pr_description.
4. If scope is `commit_range` and both commits are provided, call get_diff.
5. Synthesize into a FunctionalContract JSON.
6. List expected behaviors that are testable as discrete API or function-level assertions.
7. List ambiguities that a QA engineer would need a developer to clarify.

Return only the FunctionalContract JSON.
"""


class IntentExtractorState(TypedDict):
    """State that flows through the Intent Extractor graph."""

    messages: Annotated[list[BaseMessage], add_messages]


def _build_model(available_tools: list) -> ChatGroq:
    llm = ChatGroq(
        model=config.MODEL_NAME,
        api_key=config.GROQ_API_KEY,
        temperature=0,
        max_tokens=4096,
    )
    return llm.bind_tools(available_tools)


def agent_node(state: IntentExtractorState, available_tools: list) -> Dict[str, Any]:
    trace(AGENT_NAME, "Thinking...")
    model = _build_model(available_tools)
    response = safe_model_invoke(model, state["messages"], agent_name=AGENT_NAME)
    return {"messages": [response]}


def should_continue(state: IntentExtractorState) -> str:
    last_message: AIMessage = state["messages"][-1]
    if last_message.tool_calls:
        tool_names = [tool_call["name"] for tool_call in last_message.tool_calls]
        trace(AGENT_NAME, f"Calling tools: {', '.join(tool_names)}")
        return "tools"
    trace(AGENT_NAME, "Final answer ready.")
    return END


def build_intent_extractor_graph(available_tools: list) -> StateGraph:
    tool_node = ToolNode(available_tools)

    graph = StateGraph(IntentExtractorState)
    graph.add_node("agent", lambda state: agent_node(state, available_tools))
    graph.add_node("tools", tool_node)

    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")

    return graph.compile()


def run_intent_extractor(
    repo: str,
    module_path: str,
    scope: str = "full_module",
    branch: str = "main",
    pr_number: Optional[int] = None,
    base_commit: Optional[str] = None,
    head_commit: Optional[str] = None,
) -> Dict[str, Any]:
    """Run the Intent Extractor agent and return the FunctionalContract dict."""
    trace(AGENT_NAME, f"Starting intent extraction for {repo}/{module_path} (scope={scope})")
    available_tools = _select_tools(scope, pr_number, base_commit, head_commit)

    initial_state: IntentExtractorState = {
        "messages": [
            SystemMessage(content=_build_system_prompt(available_tools)),
            HumanMessage(
                content=_build_user_prompt(
                    repo=repo,
                    module_path=module_path,
                    scope=scope,
                    branch=branch,
                    pr_number=pr_number,
                    base_commit=base_commit,
                    head_commit=head_commit,
                )
            ),
        ]
    }

    compiled_graph = build_intent_extractor_graph(available_tools)
    final_state = compiled_graph.invoke(initial_state)

    last_message = final_state["messages"][-1]
    raw_content = last_message.content

    json_str = raw_content
    if "```json" in json_str:
        json_str = json_str.split("```json")[1].split("```")[0]
    elif "```" in json_str:
        json_str = json_str.split("```")[1].split("```")[0]

    contract = json.loads(json_str.strip())
    trace(
        AGENT_NAME,
        f"Contract extracted. {len(contract.get('expected_behaviors', []))} expected behaviors. "
        f"Confidence: {contract.get('confidence', 'N/A')}",
    )
    return contract
