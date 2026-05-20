"""Public tool exports with lazy imports."""

from importlib import import_module

__all__ = [
    "CODE_TOOLS",
    "GITHUB_TOOLS",
    "execute_api_call",
    "file_critical_gaps",
    "get_commits",
    "get_diff",
    "get_pr_description",
    "get_readme",
    "get_swagger",
    "list_files",
    "list_functions",
    "push_github_issue",
    "read_file",
    "trace_imports",
    "validate_response",
    "write_report_to_file",
]

_EXPORTS = {
    "CODE_TOOLS": ("tools.code_tools", "ALL_TOOLS"),
    "GITHUB_TOOLS": ("tools.github_tools", "ALL_TOOLS"),
    "execute_api_call": ("tools.probe_tools", "execute_api_call"),
    "file_critical_gaps": ("tools.report_tools", "file_critical_gaps"),
    "get_commits": ("tools.github_tools", "get_commits"),
    "get_diff": ("tools.github_tools", "get_diff"),
    "get_pr_description": ("tools.github_tools", "get_pr_description"),
    "get_readme": ("tools.github_tools", "get_readme"),
    "get_swagger": ("tools.code_tools", "get_swagger"),
    "list_files": ("tools.code_tools", "list_files"),
    "list_functions": ("tools.code_tools", "list_functions"),
    "push_github_issue": ("tools.report_tools", "push_github_issue"),
    "read_file": ("tools.code_tools", "read_file"),
    "trace_imports": ("tools.code_tools", "trace_imports"),
    "validate_response": ("tools.probe_tools", "validate_response"),
    "write_report_to_file": ("tools.report_tools", "write_report_to_file"),
}


def __getattr__(name: str):
    if name not in _EXPORTS:
        raise AttributeError(name)
    module_name, attr_name = _EXPORTS[name]
    module = import_module(module_name)
    return getattr(module, attr_name)
