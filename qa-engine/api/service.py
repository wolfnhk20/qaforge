"""Service helpers for the FastAPI audit layer."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

import config
from db.supabase import (
    SupabaseConfigError,
    SupabasePersistenceError,
    get_latest_audit as get_latest_audit_record,
    is_configured as is_supabase_configured,
    save_audit,
    save_logs,
)
from graph.pipeline import build_pipeline
from utils.target_url import TargetUrlError, resolve_audit_base_url

LATEST_REPORT_PATH = config.OUTPUTS_DIR / "audit_report.md"
LATEST_PROBE_RESULTS_PATH = config.OUTPUTS_DIR / "probe_results.json"
LATEST_CONTRACT_PATH = config.OUTPUTS_DIR / "functional_contract.json"
REPO_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


class InvalidRepoError(ValueError):
    """Raised when the incoming repository string is malformed."""


class AuditPipelineError(RuntimeError):
    """Raised when the LangGraph pipeline reports execution errors."""

    def __init__(self, errors: List[str], partial_state: Optional[Dict[str, Any]] = None) -> None:
        super().__init__("; ".join(errors))
        self.errors = errors
        self.partial_state = partial_state or {}


class AuditPersistenceError(RuntimeError):
    """Raised when audit persistence to Supabase fails."""


class ReportNotFoundError(FileNotFoundError):
    """Raised when a report markdown file cannot be found."""


class MalformedAuditOutputError(ValueError):
    """Raised when audit artifacts do not match the expected shape."""


class InvalidTargetUrlError(ValueError):
    """Raised when the per-audit staging/base URL is missing or invalid."""


class RepoConfigNotFoundError(ValueError):
    """Raised when no persisted repository runtime configuration exists."""


class RepoConfigMismatchError(ValueError):
    """Raised when webhook state and repository configuration are inconsistent."""


def resolve_webhook_audit_target(
    *,
    repo_name: str,
    push_branch: Optional[str] = None,
) -> tuple[str, str]:
    """Resolve staging URL and audit branch for a webhook-triggered run."""
    from db.repo_config import get_repository_config
    from db.supabase import get_webhook

    normalized_repo = (repo_name or "").strip()
    if not normalized_repo:
        raise RepoConfigMismatchError("Webhook payload did not include a valid repository name.")

    repo_config = get_repository_config(normalized_repo)
    if not repo_config:
        raise RepoConfigNotFoundError(
            f"No runtime configuration found for repository '{normalized_repo}'. "
            "Enable Auto Audits in the dashboard to persist staging URL and branch."
        )

    if not repo_config.get("webhook_enabled"):
        raise RepoConfigMismatchError(
            f"Auto Audits are disabled in repository configuration for '{normalized_repo}'."
        )

    webhook = get_webhook(normalized_repo)
    if not webhook:
        raise RepoConfigMismatchError(
            f"GitHub webhook credentials are missing for '{normalized_repo}'. "
            "Re-enable Auto Audits to restore webhook registration."
        )
    if not webhook.get("enabled"):
        raise RepoConfigMismatchError(
            f"GitHub webhook is disabled for '{normalized_repo}' while repository config expects "
            "webhook-enabled audits. Re-enable Auto Audits to reconcile state."
        )
    webhook_repo = (webhook.get("repo") or webhook.get("repo_name") or "").strip()
    if webhook_repo and webhook_repo != normalized_repo:
        raise RepoConfigMismatchError(
            f"Webhook repository mismatch: expected '{normalized_repo}', found '{webhook_repo}'."
        )

    staging_url = repo_config.get("staging_url")
    try:
        base_url = resolve_audit_base_url(staging_url, required=True)
    except TargetUrlError as exc:
        raise InvalidTargetUrlError(str(exc)) from exc

    config_branch = (repo_config.get("branch") or "main").strip() or "main"
    audit_branch = (push_branch or "").strip() or config_branch
    return base_url, audit_branch


def validate_repo(repo: str) -> str:
    """Validate GitHub repository format and accessibility."""
    normalized = (repo or "").strip()
    if not REPO_PATTERN.match(normalized):
        raise InvalidRepoError("Repository must be in 'owner/repo' format.")
    
    try:
        from github import Github
        from github.GithubException import BadCredentialsException, GithubException

        token = config.get_github_token()
        gh = Github(token)
        gh.get_repo(normalized)
    except RuntimeError as exc:
        raise InvalidRepoError(str(exc)) from exc
    except BadCredentialsException as exc:
        raise InvalidRepoError(
            f"GitHub OAuth session has expired or was revoked for repository '{normalized}'."
        ) from exc
    except GithubException as exc:
        if exc.status in (403, 404):
            raise InvalidRepoError(
                f"Repository '{normalized}' is not accessible with the current GitHub OAuth session."
            ) from exc
        raise InvalidRepoError(
            f"Repository '{normalized}' is not accessible or does not exist on GitHub. (Details: {exc})"
        ) from exc
    except InvalidRepoError:
        raise
    except Exception as exc:
        raise InvalidRepoError(
            f"Repository '{normalized}' is not accessible or does not exist on GitHub. (Details: {exc})"
        ) from exc
        
    return normalized


def flatten_findings(probe_results: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Flatten probe result gaps into a frontend-friendly findings list."""
    findings: List[Dict[str, Any]] = []
    for probe_id, result in probe_results.items():
        for gap in result.get("gaps", []):
            findings.append(
                {
                    "probe_id": probe_id,
                    "endpoint": result.get("target_endpoint", ""),
                    "priority": result.get("priority", ""),
                    "classification": gap.get("classification", ""),
                    "reasoning": gap.get("reasoning", ""),
                    "suggested_fix": gap.get("suggested_fix", ""),
                    "case_id": gap.get("case_id", ""),
                }
            )
    return findings


def _read_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _safe_save_log(
    *,
    message: str,
    level: str = "info",
    audit_id: Optional[int] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> None:
    """Best-effort log persistence that never masks the main request outcome."""
    try:
        save_logs(message=message, level=level, audit_id=audit_id, payload=payload)
    except SupabasePersistenceError:
        pass


def resolve_report_markdown_path(report_path: Optional[str] = None) -> Path:
    """Resolve the most appropriate report markdown path."""
    candidates: List[Path] = []
    if report_path:
        candidate = Path(report_path)
        if not candidate.is_absolute():
            candidate = config.PROJECT_ROOT / report_path
        candidates.append(candidate)
    candidates.append(LATEST_REPORT_PATH)

    timestamped_reports = sorted(config.OUTPUTS_DIR.glob("audit_report_*.md"), reverse=True)
    candidates.extend(timestamped_reports)

    for candidate in candidates:
        if candidate.exists():
            return candidate

    raise ReportNotFoundError("No audit report markdown file is available yet.")


def read_report_markdown(report_path: Optional[str] = None) -> tuple[str, str]:
    """Read report markdown and return its content plus project-relative path."""
    resolved_path = resolve_report_markdown_path(report_path)
    markdown = resolved_path.read_text(encoding="utf-8")
    if not markdown.strip():
        raise MalformedAuditOutputError("Report markdown file is empty.")
    if resolved_path != LATEST_REPORT_PATH:
        config.ensure_runtime_dirs()
        LATEST_REPORT_PATH.write_text(markdown, encoding="utf-8")
    return markdown, config.to_project_relative(resolved_path)


async def run_audit_pipeline(
    *,
    repo: str,
    module_path: str,
    scope: str,
    branch: str,
    pr_number: Optional[int] = None,
    base_commit: Optional[str] = None,
    head_commit: Optional[str] = None,
    base_url: Optional[str] = None,
    origin: str = "manual",
) -> Dict[str, Any]:
    """Run the existing LangGraph pipeline in API-safe auto mode."""
    config.ensure_runtime_dirs()
    pipeline = build_pipeline()
    normalized_repo = validate_repo(repo)
    normalized_module = config.normalize_module_path(module_path)

    try:
        resolved_base_url = resolve_audit_base_url(base_url, required=True)
    except TargetUrlError as exc:
        raise InvalidTargetUrlError(str(exc)) from exc

    initial_state = {
        "repo": normalized_repo,
        "module_path": normalized_module,
        "scope": scope,
        "pr_number": pr_number,
        "base_commit": base_commit,
        "head_commit": head_commit,
        "branch": branch,
        "auto_run": True,
        "probe_results": {},
        "errors": [],
        "base_url": resolved_base_url,
        "origin": origin,
    }

    final_state = await pipeline.ainvoke(initial_state)
    errors = final_state.get("errors", [])
    if errors:
        raise AuditPipelineError(errors, partial_state=final_state)
    return final_state


def build_audit_response(final_state: Dict[str, Any], repo: str) -> Dict[str, Any]:
    """Build the JSON payload returned by POST /audit."""
    report_markdown, _ = read_report_markdown(final_state.get("report_path"))
    probe_results = final_state.get("probe_results", {}) or {}
    findings = flatten_findings(probe_results)
    if not isinstance(findings, list):
        raise MalformedAuditOutputError("Findings payload is malformed.")
    probe_plan = final_state.get("probe_plan") or {}

    return {
        "status": "completed",
        "repo": repo,
        "probe_count": len(probe_results) or len(probe_plan.get("probes", [])),
        "findings": findings,
        "report_markdown": report_markdown,
        "report_path": config.to_project_relative(LATEST_REPORT_PATH),
        "origin": final_state.get("origin", "manual"),
    }


def persist_audit_result(
    *,
    repo: str,
    module_path: str,
    audit_response: Dict[str, Any],
) -> int:
    """Save audit payload to Supabase and return the audit id."""
    if not is_supabase_configured():
        raise SupabaseConfigError("SUPABASE_URL and SUPABASE_KEY must be configured for /audit.")

    try:
        record = save_audit(
            repo=repo,
            module=module_path,
            status=audit_response["status"],
            probe_count=audit_response["probe_count"],
            findings=audit_response["findings"],
            report_markdown=audit_response["report_markdown"],
            origin=audit_response.get("origin", "manual"),
        )
    except SupabasePersistenceError as exc:
        raise AuditPersistenceError(str(exc)) from exc

    audit_id = record.get("id")
    if audit_id is None:
        raise AuditPersistenceError("Supabase audit record did not include an id.")

    _safe_save_log(
        audit_id=audit_id,
        message="audit_completed",
        level="info",
        payload={"repo": repo, "module": module_path, "probe_count": audit_response["probe_count"]},
    )
    return int(audit_id)


def build_latest_audit_response() -> Dict[str, Any]:
    """Return the latest audit from Supabase, or fall back to local artifacts."""
    latest_db_audit = None
    if is_supabase_configured():
        latest_db_audit = get_latest_audit_record()

    if latest_db_audit:
        findings = latest_db_audit.get("findings", [])
        if not isinstance(findings, list):
            raise MalformedAuditOutputError("Latest Supabase audit findings are malformed.")
        report_markdown = latest_db_audit.get("report_markdown")
        if not isinstance(report_markdown, str):
            report_markdown = ""
        
        status = latest_db_audit.get("status", "completed")
        # Only require non-empty report markdown if status is completed
        if status == "completed" and not report_markdown.strip():
            report_markdown = "Audit completed, but no report markdown was generated."

        return {
            "audit_id": latest_db_audit.get("id"),
            "status": status,
            "repo": latest_db_audit.get("repo", ""),
            "probe_count": latest_db_audit.get("probe_count", 0),
            "findings": findings,
            "report_markdown": report_markdown,
            "report_path": config.to_project_relative(LATEST_REPORT_PATH),
            "origin": latest_db_audit.get("origin", "manual"),
        }

    report_markdown, _ = read_report_markdown()
    probe_results = _read_json(LATEST_PROBE_RESULTS_PATH)
    contract = _read_json(LATEST_CONTRACT_PATH)
    findings = flatten_findings(probe_results)

    return {
        "audit_id": None,
        "status": "completed",
        "repo": contract.get("repo", ""),
        "probe_count": len(probe_results),
        "findings": findings,
        "report_markdown": report_markdown,
        "report_path": config.to_project_relative(LATEST_REPORT_PATH),
        "origin": "manual",
    }
