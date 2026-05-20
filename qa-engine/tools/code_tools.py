"""Code analysis tools for Agent 2 (Code Analyst)."""

import ast
import re
from typing import Any, Dict, List, Optional

from github import Github
from langchain_core.tools import tool

import config
from utils.trace import trace

AGENT = "CODE_ANALYST"
HTTP_METHODS = {"get", "post", "put", "delete", "patch", "options", "head"}


def _get_github() -> Github:
    token = config.get_github_token()
    return Github(token)


def _list_repository_files(repo: str, module_path: str) -> List[str]:
    """List repository files recursively from a module path."""
    module_path = config.normalize_module_path(module_path)
    gh = _get_github()
    repository = gh.get_repo(repo)
    try:
        contents = repository.get_contents(module_path)
    except Exception as exc:
        return [f"Error: Could not list contents of {module_path}. Exception: {str(exc)}"]

    if not isinstance(contents, list):
        contents = [contents]

    files: List[str] = []
    while contents:
        item = contents.pop(0)
        if item.type == "dir":
            contents.extend(repository.get_contents(item.path))
        else:
            files.append(item.path)
    return files


def _read_repository_file(repository, file_path: str) -> str:
    """Read and decode a repository file."""
    content = repository.get_contents(file_path)
    if isinstance(content, list):
        raise IsADirectoryError(file_path)
    return content.decoded_content.decode("utf-8")


def _extract_string_literal(node: Optional[ast.AST]) -> Optional[str]:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _extract_methods(node: Optional[ast.AST], default: Optional[List[str]] = None) -> List[str]:
    if default is None:
        default = ["GET"]
    if node is None:
        return default
    if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        methods: List[str] = []
        for element in node.elts:
            value = _extract_string_literal(element)
            if value:
                methods.append(value.upper())
        return methods or default
    value = _extract_string_literal(node)
    if value:
        return [value.upper()]
    return default


def _find_keyword(call: ast.Call, keyword_name: str) -> Optional[ast.AST]:
    for keyword in call.keywords:
        if keyword.arg == keyword_name:
            return keyword.value
    return None


def _extract_routes_from_content(file_path: str, file_content: str) -> List[Dict[str, Any]]:
    """Extract Flask and FastAPI style routes from Python source."""
    try:
        tree = ast.parse(file_content)
    except SyntaxError:
        return []

    routes: List[Dict[str, Any]] = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue

        for decorator in node.decorator_list:
            if not isinstance(decorator, ast.Call) or not isinstance(decorator.func, ast.Attribute):
                continue

            attr = decorator.func.attr.lower()
            endpoint: Optional[str] = None
            methods: List[str] = []

            if attr == "route":
                endpoint = _extract_string_literal(decorator.args[0]) if decorator.args else None
                if endpoint is None:
                    endpoint = _extract_string_literal(_find_keyword(decorator, "rule"))
                methods = _extract_methods(_find_keyword(decorator, "methods"))
            elif attr == "api_route":
                endpoint = _extract_string_literal(decorator.args[0]) if decorator.args else None
                if endpoint is None:
                    endpoint = _extract_string_literal(_find_keyword(decorator, "path"))
                methods = _extract_methods(_find_keyword(decorator, "methods"))
            elif attr in HTTP_METHODS:
                endpoint = _extract_string_literal(decorator.args[0]) if decorator.args else None
                if endpoint is None:
                    endpoint = _extract_string_literal(_find_keyword(decorator, "path"))
                methods = [attr.upper()]

            if not endpoint:
                continue

            for method in methods:
                routes.append(
                    {
                        "endpoint": endpoint,
                        "method": method,
                        "handler_function": node.name,
                        "payload_schema": {},
                        "response_schema": {},
                        "functions_called": [node.name],
                        "function_details": {},
                        "source_file": file_path,
                    }
                )

    return routes


def extract_detected_apis(repo: str, module_path: str) -> List[Dict[str, Any]]:
    """Deterministically scan repository Python files for HTTP routes."""
    try:
        files = _list_repository_files(repo, module_path)
        gh = _get_github()
        repository = gh.get_repo(repo)
    except Exception as exc:
        trace(AGENT, f"Static API detection skipped: {exc}")
        return []

    detected: List[Dict[str, Any]] = []
    for file_path in files:
        if not file_path.endswith(".py"):
            continue
        try:
            file_content = _read_repository_file(repository, file_path)
        except Exception:
            continue
        detected.extend(_extract_routes_from_content(file_path, file_content))

    deduped: Dict[tuple[str, str, str], Dict[str, Any]] = {}
    for route in detected:
        key = (route["endpoint"], route["method"], route["handler_function"])
        deduped[key] = route

    results = list(deduped.values())
    if results:
        trace(AGENT, f"Detected {len(results)} API route(s) via static scan.")
    return results


def enrich_blueprint_with_detected_apis(
    repo: str,
    module_path: str,
    blueprint: Dict[str, Any],
) -> Dict[str, Any]:
    """Merge deterministic route detection into the LLM-authored blueprint."""
    enriched = dict(blueprint)
    existing_apis = list(enriched.get("apis") or [])
    detected_apis = extract_detected_apis(repo, module_path)
    if not detected_apis:
        return enriched

    existing_keys = {
        (
            api.get("endpoint", ""),
            api.get("method", "").upper(),
            api.get("handler_function", ""),
        )
        for api in existing_apis
    }

    merged_apis = list(existing_apis)
    for api in detected_apis:
        key = (api["endpoint"], api["method"].upper(), api["handler_function"])
        if key not in existing_keys:
            merged_apis.append(api)
            existing_keys.add(key)

    enriched["apis"] = merged_apis

    detected_files = sorted({api["source_file"] for api in detected_apis})
    files_analyzed = list(enriched.get("files_analyzed") or [])
    for file_path in detected_files:
        if file_path not in files_analyzed:
            files_analyzed.append(file_path)
    if files_analyzed:
        enriched["files_analyzed"] = files_analyzed

    files_not_analyzed = [
        file_path
        for file_path in (enriched.get("files_not_analyzed") or [])
        if file_path not in detected_files
    ]
    enriched["files_not_analyzed"] = files_not_analyzed

    if merged_apis and enriched.get("analyst_confidence", 0) < 0.5:
        enriched["analyst_confidence"] = 0.5

    for api in merged_apis:
        api.pop("source_file", None)

    trace(AGENT, f"Blueprint API coverage updated to {len(merged_apis)} endpoint(s).")
    return enriched


@tool
def list_files(repo: str, module_path: str) -> List[str]:
    """List all files in a module directory recursively."""
    module_path = config.normalize_module_path(module_path)
    trace(AGENT, f"Listing files in {repo}/{module_path or '(root)'}...")
    files = _list_repository_files(repo, module_path)
    if files and not files[0].startswith("Error:"):
        trace(AGENT, f"Found {len(files)} files.")
    return files


@tool
def read_file(repo: str, file_path: str) -> str:
    """Read the raw content of a file from the repository."""
    trace(AGENT, f"Reading {file_path}...")
    gh = _get_github()
    repository = gh.get_repo(repo)
    try:
        return _read_repository_file(repository, file_path)
    except IsADirectoryError:
        return f"Error: {file_path} is a directory, not a file."
    except Exception as exc:
        return f"Error: Could not read file {file_path}. Exception: {str(exc)}"


@tool
def list_functions(file_content: str) -> str:
    """Extract function or method names and line numbers from source code."""
    functions: List[str] = []
    try:
        tree = ast.parse(file_content)
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                args = [arg.arg for arg in node.args.args]
                functions.append(f"L{node.lineno}: def {node.name}({', '.join(args)})")
    except SyntaxError:
        for line_number, line in enumerate(file_content.splitlines(), 1):
            match = re.match(
                r"\s*(?:async\s+)?(?:def|function|func|fn|export\s+(?:default\s+)?function)\s+(\w+)",
                line,
            )
            if match:
                functions.append(f"L{line_number}: {match.group(0).strip()}")
    return "\n".join(functions) if functions else "No functions found."


@tool
def get_swagger(repo: str, swagger_path: str) -> str:
    """Fetch an OpenAPI or Swagger spec file from the repository."""
    trace(AGENT, f"Reading swagger spec at {swagger_path}...")
    gh = _get_github()
    repository = gh.get_repo(repo)
    try:
        return _read_repository_file(repository, swagger_path)
    except Exception:
        return "(No swagger/openapi file found at this path)"


@tool
def trace_imports(file_content: str) -> str:
    """Extract imported modules and local dependencies from source code."""
    imports: List[str] = []
    try:
        tree = ast.parse(file_content)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(f"import {alias.name}")
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                names = ", ".join(alias.name for alias in node.names)
                imports.append(f"from {module} import {names}")
    except SyntaxError:
        for line in file_content.splitlines():
            if re.match(r"^\s*(import |from .+ import |require\(|const .+ = require)", line):
                imports.append(line.strip())
    return "\n".join(imports) if imports else "No imports found."


ALL_TOOLS = [list_files, read_file, list_functions, get_swagger, trace_imports]
