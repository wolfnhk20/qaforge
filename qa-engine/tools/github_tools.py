"""GitHub tools for Agent 1 (Intent Extractor).

Each function is decorated with @tool so LangGraph's ToolNode can invoke them.
All calls go through PyGithub; the GitHub token is read from config.
"""

from typing import List, Optional

from github import Github
from langchain_core.tools import tool

import config
from utils.trace import trace

AGENT = "INTENT_EXTRACTOR"

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_github() -> Github:
    """Return an authenticated PyGithub client."""
    token = config.get_github_token()
    return Github(token)


# ---------------------------------------------------------------------------
# LangChain tools (exposed to the agent via ToolNode)
# ---------------------------------------------------------------------------

@tool
def get_readme(repo: str, module_path: str = "") -> str:
    """Fetch the README (or module-level docstring) for a repo/module.

    Args:
        repo: GitHub repo in 'org/repo' format.
        module_path: Optional sub-path inside the repo (e.g. 'payment-service').

    Returns:
        The decoded text content of the README file.
    """
    module_path = config.normalize_module_path(module_path)
    trace(AGENT, f"Reading README.md for {repo}/{module_path or '(root)'}...")
    gh = _get_github()
    repository = gh.get_repo(repo)

    # Try common README names at the module path
    readme_names = ["README.md", "readme.md", "README.rst", "README"]
    prefix = f"{module_path}/" if module_path else ""

    for name in readme_names:
        try:
            content = repository.get_contents(f"{prefix}{name}")
            return content.decoded_content.decode("utf-8")
        except Exception:
            continue

    return "(No README found at the specified path)"


@tool
def get_commits(repo: str, branch: str = "main", last_n: int = 5) -> List[str]:
    """Fetch the last N commit messages from a branch.

    Args:
        repo: GitHub repo in 'org/repo' format.
        branch: Branch name to read commits from.
        last_n: Number of recent commits to fetch.

    Returns:
        List of formatted commit strings ('sha[:7] — message — author').
    """
    trace(AGENT, f"Reading last {last_n} commits on {branch}...")
    gh = _get_github()
    repository = gh.get_repo(repo)
    commits = repository.get_commits(sha=branch)

    results: List[str] = []
    for commit in commits[:last_n]:
        short_sha = commit.sha[:7]
        message = commit.commit.message.split("\n")[0]  # first line only
        author = commit.commit.author.name if commit.commit.author else "unknown"
        results.append(f"{short_sha} — {message} — {author}")

    trace(AGENT, f"Fetched {len(results)} commits.")
    return results


@tool
def get_pr_description(repo: str, pr_number: int) -> str:
    """Fetch the title, body, and linked issues of a pull request.

    Args:
        repo: GitHub repo in 'org/repo' format.
        pr_number: Pull request number.

    Returns:
        Formatted string with PR title, body, and labels.
    """
    trace(AGENT, f"Reading PR #{pr_number}...")
    gh = _get_github()
    repository = gh.get_repo(repo)
    pr = repository.get_pull(pr_number)

    labels = ", ".join(label.name for label in pr.labels) or "none"
    body = pr.body or "(no body)"

    result = (
        f"PR #{pr_number}: {pr.title}\n"
        f"State: {pr.state}\n"
        f"Labels: {labels}\n"
        f"---\n"
        f"{body}"
    )
    trace(AGENT, f"PR #{pr_number} fetched: '{pr.title}'")
    return result


@tool
def get_diff(repo: str, base_commit: str, head_commit: str) -> str:
    """Fetch the unified diff between two commits.

    Args:
        repo: GitHub repo in 'org/repo' format.
        base_commit: Base commit SHA.
        head_commit: Head commit SHA.

    Returns:
        Unified diff string showing files changed and patch content.
    """
    trace(AGENT, f"Reading diff {base_commit[:7]}..{head_commit[:7]}...")
    gh = _get_github()
    repository = gh.get_repo(repo)
    comparison = repository.compare(base_commit, head_commit)

    diff_parts: List[str] = []
    for f in comparison.files:
        header = f"--- {f.filename} ({f.status}, +{f.additions}/-{f.deletions})"
        diff_parts.append(header)
        if f.patch:
            diff_parts.append(f.patch)
        diff_parts.append("")  # blank line separator

    trace(AGENT, f"Diff fetched: {len(comparison.files)} files changed.")
    return "\n".join(diff_parts)


# ---------------------------------------------------------------------------
# Convenience list for ToolNode binding
# ---------------------------------------------------------------------------

ALL_TOOLS = [get_readme, get_commits, get_pr_description, get_diff]
