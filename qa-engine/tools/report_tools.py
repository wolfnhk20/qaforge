"""Report tools - write audit report to file and file GitHub issues."""

from datetime import datetime
from typing import List

from github import Github

import config
from utils.trace import trace

AGENT = "REPORT_TOOLS"


def write_report_to_file(report_md: str, module: str) -> str:
    """Write audit report markdown to outputs/ and return a project-relative path."""
    config.ensure_runtime_dirs()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    normalized_module = config.normalize_module_path(module)
    safe_module = (normalized_module or "root").replace("/", "_")
    output_path = config.OUTPUTS_DIR / f"audit_report_{safe_module}_{timestamp}.md"
    output_path.write_text(report_md, encoding="utf-8")
    latest_output_path = config.OUTPUTS_DIR / "audit_report.md"
    latest_output_path.write_text(report_md, encoding="utf-8")
    relative_path = config.to_project_relative(output_path)
    trace(
        AGENT,
        f"Report written -> {relative_path} (latest alias: {config.to_project_relative(latest_output_path)})",
    )
    return relative_path


def push_github_issue(
    repo_name: str,
    gap: dict,
    audit_report_url: str = "",
) -> str:
    """File one GitHub issue for a gap. Returns the issue URL."""
    if not config.GITHUB_TOKEN:
        trace(AGENT, "GITHUB_TOKEN not set - skipping issue filing.")
        return ""

    g = Github(config.GITHUB_TOKEN)
    repo = g.get_repo(repo_name)

    title = (
        f"[AUDITOR] {gap.get('priority', 'HIGH')} | {gap.get('endpoint', '?')} - "
        f"{gap.get('title', gap.get('reasoning', 'Gap detected'))}"
    )

    body = f"""\
## Functional Gap Detected by Contract Auditor Agent

**Endpoint:** `{gap.get('endpoint', '?')}`
**Classification:** `{gap.get('classification', '?')}`
**Priority:** `{gap.get('priority', '?')}`

### What Failed
{gap.get('what_happened', gap.get('reasoning', 'See audit report'))}

### Contract Violation
{gap.get('contract_clause', 'See audit report')}

### Fix
```
{gap.get('fix', gap.get('suggested_fix', 'See audit report'))}
```
**File hint:** `{gap.get('file_hint', 'See module blueprint')}`

---
*Auto-filed by Functional Contract Auditor Agent*
*Full report: {audit_report_url}*
"""
    labels = ["bug", "automated-audit"]
    if gap.get("priority") == "CRITICAL":
        labels.append("priority: critical")

    issue = repo.create_issue(title=title, body=body, labels=labels)
    trace(AGENT, f"Filed issue: {issue.html_url}")
    return issue.html_url


def file_critical_gaps(
    repo_name: str,
    probe_results: dict,
    report_path: str,
) -> List[str]:
    """Parse probe results and file one issue per CRITICAL gap."""
    urls: List[str] = []
    for result in probe_results.values():
        if result.get("priority") == "CRITICAL":
            for gap in result.get("gaps", []):
                gap["endpoint"] = result.get("target_endpoint", "")
                gap["priority"] = result.get("priority", "")
                url = push_github_issue(repo_name, gap, report_path)
                if url:
                    urls.append(url)
    return urls
