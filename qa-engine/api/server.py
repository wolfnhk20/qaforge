"""FastAPI server exposing the qa-engine audit pipeline."""

from __future__ import annotations

import asyncio
import json
import secrets
import hmac
import hashlib
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import config
from api.service import (
    AuditPersistenceError,
    AuditPipelineError,
    InvalidRepoError,
    InvalidTargetUrlError,
    MalformedAuditOutputError,
    RepoConfigMismatchError,
    RepoConfigNotFoundError,
    ReportNotFoundError,
    build_audit_response,
    build_latest_audit_response,
    persist_audit_result,
    resolve_webhook_audit_target,
    run_audit_pipeline,
)
from utils.github_auth import (
    GitHubAuthError,
    cache_repo_provider_token,
    clear_repo_provider_token,
    resolve_provider_token_for_repo,
    verify_github_repo_access,
)
from utils.target_url import TargetUrlError, resolve_audit_base_url
from db.repo_config import get_repository_config, save_repository_config, set_repository_webhook_enabled
from db.supabase import (
    SupabaseConfigError,
    SupabasePersistenceError,
    save_logs,
    get_webhook,
    save_webhook,
    update_webhook_status,
    update_webhook_timestamps,
    save_audit,
)


class AuditRequest(BaseModel):
    """Incoming payload for POST /audit."""

    repo: str = Field(..., examples=["owner/repo"])
    module: str = Field(default=".", examples=["."])
    scope: Literal["full_module", "pr", "commit_range"] = "full_module"
    pr_number: Optional[int] = None
    base_commit: Optional[str] = None
    head_commit: Optional[str] = None
    branch: str = config.DEFAULT_BRANCH
    base_url: Optional[str] = None
    github_token: Optional[str] = None


class AuditResponse(BaseModel):
    """Structured audit response for the frontend."""

    audit_id: Optional[int] = None
    status: str
    repo: str
    probe_count: int
    findings: List[Dict[str, Any]]
    report_markdown: str
    report_path: str
    origin: Optional[str] = "manual"


class WebhookActionRequest(BaseModel):
    """Incoming payload for POST /repos/{owner}/{repo}/webhook."""

    github_token: str  # GitHub OAuth provider_token from the signed-in user session (not stored in DB)
    action: Literal["enable", "disable"]
    staging_url: Optional[str] = None
    branch: str = config.DEFAULT_BRANCH
    created_by: Optional[str] = None


class RepoConfigRequest(BaseModel):
    """Persist repository runtime configuration (staging URL, branch)."""

    staging_url: str
    branch: str = config.DEFAULT_BRANCH
    created_by: Optional[str] = None



app = FastAPI(title="qa-engine API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _save_log_best_effort(message: str, *, level: str = "info", payload: Optional[Dict[str, Any]] = None) -> None:
    try:
        save_logs(message=message, level=level, payload=payload)
    except (SupabaseConfigError, SupabasePersistenceError):
        pass


@app.get("/")
@app.head("/")
async def root() -> Dict[str, str]:
    """Root health probe for platform load balancers (e.g. Render HEAD /)."""
    return {"status": "ok", "service": "qa-engine"}


@app.get("/health")
async def health() -> Dict[str, str]:
    """Basic health check endpoint."""
    return {"status": "ok"}


@app.post("/audit", response_model=AuditResponse)
async def create_audit(request: AuditRequest) -> AuditResponse:
    """Trigger the existing LangGraph audit pipeline and persist the result."""
    token_token = config.github_token_var.set(request.github_token)
    try:
        if request.scope == "pr" and request.pr_number is None:
            raise HTTPException(status_code=422, detail="`pr_number` is required when scope='pr'.")
        if request.scope == "commit_range" and (not request.base_commit or not request.head_commit):
            raise HTTPException(
                status_code=422,
                detail="`base_commit` and `head_commit` are required when scope='commit_range'.",
            )

        _save_log_best_effort(
            "audit_requested",
            payload={"repo": request.repo, "module": request.module, "scope": request.scope},
        )

        final_state = await run_audit_pipeline(
            repo=request.repo,
            module_path=request.module,
            scope=request.scope,
            branch=request.branch,
            pr_number=request.pr_number,
            base_commit=request.base_commit,
            head_commit=request.head_commit,
            base_url=request.base_url,
        )
        payload = build_audit_response(final_state, request.repo)
        payload["audit_id"] = persist_audit_result(
            repo=request.repo,
            module_path=request.module,
            audit_response=payload,
        )
        return AuditResponse(**payload)

    except InvalidRepoError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except InvalidTargetUrlError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ReportNotFoundError as exc:
        _save_log_best_effort("audit_report_missing", level="error", payload={"error": str(exc)})
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except MalformedAuditOutputError as exc:
        _save_log_best_effort("audit_output_malformed", level="error", payload={"error": str(exc)})
        raise HTTPException(status_code=500, detail={"message": str(exc)}) from exc
    except AuditPipelineError as exc:
        _save_log_best_effort("audit_pipeline_failed", level="error", payload={"errors": exc.errors})
        raise HTTPException(
            status_code=502,
            detail={"message": "Audit pipeline execution failed.", "errors": exc.errors},
        ) from exc
    except (SupabaseConfigError, AuditPersistenceError, SupabasePersistenceError) as exc:
        _save_log_best_effort("audit_persistence_failed", level="error", payload={"error": str(exc)})
        raise HTTPException(
            status_code=503,
            detail={"message": "Supabase persistence failed.", "error": str(exc)},
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        _save_log_best_effort("audit_server_error", level="error", payload={"error": str(exc)})
        raise HTTPException(
            status_code=500,
            detail={"message": "Unexpected server error during audit execution.", "error": str(exc)},
        ) from exc
    finally:
        config.github_token_var.reset(token_token)


@app.post("/audit/stream")
async def stream_audit(request: AuditRequest):
    """Trigger the LangGraph audit pipeline and stream progress logs and findings."""
    if request.scope == "pr" and request.pr_number is None:
        raise HTTPException(status_code=422, detail="`pr_number` is required when scope='pr'.")
    if request.scope == "commit_range" and (not request.base_commit or not request.head_commit):
        raise HTTPException(
            status_code=422,
            detail="`base_commit` and `head_commit` are required when scope='commit_range'.",
        )

    token_token = config.github_token_var.set(request.github_token)
    try:
        from api.service import validate_repo
        validate_repo(request.repo)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    finally:
        config.github_token_var.reset(token_token)

    queue = asyncio.Queue()

    def emitter(event_type: str, data: Any):
        queue.put_nowait({"type": event_type, "data": data})

    async def run_pipeline_task():
        from utils.trace import event_emitter
        event_emitter.set(emitter)
        config.github_token_var.set(request.github_token)
        try:
            _save_log_best_effort(
                "audit_requested",
                payload={"repo": request.repo, "module": request.module, "scope": request.scope},
            )
            final_state = await run_audit_pipeline(
                repo=request.repo,
                module_path=request.module,
                scope=request.scope,
                branch=request.branch,
                pr_number=request.pr_number,
                base_commit=request.base_commit,
                head_commit=request.head_commit,
                base_url=request.base_url,
            )
            payload = build_audit_response(final_state, request.repo)
            payload["audit_id"] = persist_audit_result(
                repo=request.repo,
                module_path=request.module,
                audit_response=payload,
            )
            queue.put_nowait({"type": "complete", "data": payload})
        except InvalidTargetUrlError as exc:
            queue.put_nowait({"type": "error", "data": {"message": str(exc), "errors": []}})
        except Exception as exc:
            from api.service import AuditPipelineError
            err_msg = str(exc)
            errors = []
            if isinstance(exc, AuditPipelineError):
                err_msg = "Audit pipeline execution failed."
                errors = exc.errors
            queue.put_nowait({"type": "error", "data": {"message": err_msg, "errors": errors}})
        finally:
            queue.put_nowait(None)

    asyncio.create_task(run_pipeline_task())

    async def event_generator():
        while True:
            item = await queue.get()
            if item is None:
                break
            yield f"data: {json.dumps(item)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )



@app.get("/audits")
async def list_audits(limit: int = 50):
    """Return all persisted audit records ordered newest-first."""
    try:
        from db.supabase import get_all_audits
        records = get_all_audits(limit=limit)
        return records
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to list audits: {exc}")


@app.get("/audit/{audit_id}", response_model=AuditResponse)
async def get_audit_by_id(audit_id: int) -> AuditResponse:
    """Return a single audit record by id."""
    try:
        from db.supabase import get_audit_by_id
        record = get_audit_by_id(audit_id)
        if not record:
            raise HTTPException(status_code=404, detail=f"Audit {audit_id} not found.")
        return AuditResponse(
            audit_id=record.get("id"),
            status=record.get("status", "unknown"),
            repo=record.get("repo", ""),
            probe_count=record.get("probe_count", 0),
            findings=record.get("findings") or [],
            report_markdown=record.get("report_markdown") or "",
            report_path="",
            origin=record.get("origin", "manual"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit: {exc}")


@app.get("/audit/latest", response_model=AuditResponse)
async def get_latest_audit() -> AuditResponse:
    """Return the latest persisted audit report markdown and findings."""
    try:
        payload = build_latest_audit_response()
        return AuditResponse(**payload)
    except ReportNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except MalformedAuditOutputError as exc:
        raise HTTPException(status_code=500, detail={"message": str(exc)}) from exc
    except SupabasePersistenceError as exc:
        raise HTTPException(
            status_code=503,
            detail={"message": "Failed to fetch latest audit from Supabase.", "error": str(exc)},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": "Unexpected server error while reading latest audit.", "error": str(exc)},
        ) from exc


@app.get("/audit/{audit_id}/logs")
async def get_audit_logs(audit_id: int):
    """Retrieve database logs for a given audit id."""
    try:
        from db.supabase import get_client
        response = get_client().table("logs").select("*").eq("audit_id", audit_id).order("created_at", desc=False).execute()
        return getattr(response, "data", None) or []
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit logs: {exc}")


@app.get("/repos/{owner}/{repo}/webhook")
async def get_repo_webhook(owner: str, repo: str):
    """Get webhook configuration and status from Supabase."""
    repo_name = f"{owner}/{repo}"
    try:
        webhook = get_webhook(repo_name)
        repo_config = get_repository_config(repo_name)
        if not webhook and not repo_config:
            return {"enabled": False}
        enabled = bool(
            (repo_config or {}).get("webhook_enabled")
            or (webhook or {}).get("enabled", False)
        )
        return {
            "enabled": enabled,
            "webhook_id": (webhook or {}).get("webhook_id"),
            "staging_url": (repo_config or {}).get("staging_url"),
            "branch": (repo_config or {}).get("branch", config.DEFAULT_BRANCH),
            "created_at": (webhook or {}).get("created_at") or (repo_config or {}).get("created_at"),
            "updated_at": (repo_config or {}).get("updated_at"),
            "last_push_received": (webhook or {}).get("last_push_received"),
            "last_auto_audit": (webhook or {}).get("last_auto_audit"),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve webhook configuration: {exc}")


@app.put("/repos/{owner}/{repo}/config")
async def save_repo_runtime_config(owner: str, repo: str, request: RepoConfigRequest) -> Dict[str, Any]:
    """Save staging URL and branch to repository_configs without toggling the GitHub webhook."""
    repo_name = f"{owner}/{repo}"
    try:
        resolved_staging_url = resolve_audit_base_url(request.staging_url, required=True)
    except TargetUrlError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    audit_branch = (request.branch or config.DEFAULT_BRANCH).strip() or config.DEFAULT_BRANCH
    existing_config = get_repository_config(repo_name)
    webhook = get_webhook(repo_name)
    webhook_enabled = bool(
        (existing_config or {}).get("webhook_enabled")
        or (webhook or {}).get("enabled", False)
    )

    try:
        save_repository_config(
            repo_name=repo_name,
            branch=audit_branch,
            staging_url=resolved_staging_url,
            webhook_enabled=webhook_enabled,
            created_by=request.created_by,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save repository runtime configuration: {exc}",
        ) from exc

    return {
        "status": "success",
        "repo": repo_name,
        "staging_url": resolved_staging_url,
        "branch": audit_branch,
        "webhook_enabled": webhook_enabled,
    }


@app.post("/repos/{owner}/{repo}/webhook")
async def toggle_repo_webhook(owner: str, repo: str, request: WebhookActionRequest):
    """Enable or disable GitHub webhooks for the given repository."""
    repo_name = f"{owner}/{repo}"
    provider_token = (request.github_token or "").strip()
    action = request.action

    if not provider_token:
        raise HTTPException(
            status_code=401,
            detail="GitHub OAuth session is required. Sign in and try again.",
        )

    from github import Github
    from github.GithubException import GithubException, UnknownObjectException

    try:
        verify_github_repo_access(repo_name, provider_token)
        gh = Github(provider_token)
        gh_repo = gh.get_repo(repo_name)
    except GitHubAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail=f"Failed to authenticate with GitHub or repository '{repo_name}' is inaccessible: {exc}",
        ) from exc

    if action == "enable":
        webhook = get_webhook(repo_name)
        existing_config = get_repository_config(repo_name)
        try:
            resolved_staging_url = resolve_audit_base_url(
                request.staging_url,
                fallback=(existing_config or {}).get("staging_url"),
                required=True,
            )
        except TargetUrlError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        audit_branch = (request.branch or config.DEFAULT_BRANCH).strip() or config.DEFAULT_BRANCH
        
        # If enabled in DB, check GitHub side
        webhook_id = webhook.get("webhook_id") if webhook else None
        webhook_secret = webhook.get("webhook_secret") if webhook else secrets.token_hex(20)

        # Build webhook config
        webhook_url = f"{config.WEBHOOK_URL_BASE.rstrip('/')}/webhook/github"
        config_dict = {
            "url": webhook_url,
            "content_type": "json",
            "secret": webhook_secret,
        }

        # Check if webhook already exists on GitHub to prevent duplicates
        github_hook = None
        if webhook_id:
            try:
                github_hook = gh_repo.get_hook(webhook_id)
                if github_hook.config.get("url") != webhook_url:
                    try:
                        github_hook.delete()
                    except Exception:
                        pass
                    github_hook = None
            except UnknownObjectException:
                github_hook = None

        if not github_hook:
            try:
                hooks = gh_repo.get_hooks()
                for h in hooks:
                    if h.config.get("url") == webhook_url:
                        github_hook = h
                        webhook_id = h.id
                        break
            except Exception:
                pass

        if not github_hook:
            try:
                github_hook = gh_repo.create_hook(
                    name="web",
                    config=config_dict,
                    events=["push"],
                    active=True
                )
                webhook_id = github_hook.id
            except GithubException as exc:
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to create GitHub webhook. Ensure you have admin access to the repository: {exc}"
                )

        try:
            save_webhook(
                repo=repo_name,
                webhook_id=webhook_id,
                webhook_secret=webhook_secret,
                enabled=True,
            )
            save_repository_config(
                repo_name=repo_name,
                branch=audit_branch,
                staging_url=resolved_staging_url,
                webhook_enabled=True,
                created_by=request.created_by,
            )
            cache_repo_provider_token(repo_name, provider_token)
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save repository runtime configuration: {exc}",
            ) from exc

        return {
            "status": "success",
            "message": f"Webhook successfully enabled for {repo_name}",
            "webhook_id": webhook_id,
        }

    else:  # action == "disable"
        webhook = get_webhook(repo_name)
        if not webhook or not webhook.get("enabled"):
            return {"status": "success", "message": "Webhook is already disabled"}

        webhook_id = webhook.get("webhook_id")
        
        if webhook_id:
            try:
                github_hook = gh_repo.get_hook(webhook_id)
                github_hook.delete()
            except UnknownObjectException:
                pass
            except Exception as exc:
                print(f"Failed to delete hook from GitHub: {exc}")

        try:
            update_webhook_status(repo=repo_name, enabled=False)
            set_repository_webhook_enabled(repo_name=repo_name, enabled=False)
            clear_repo_provider_token(repo_name)
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to disable webhook configuration in database: {exc}",
            ) from exc

        return {
            "status": "success",
            "message": f"Webhook successfully disabled for {repo_name}",
        }


async def background_audit_runner(
    repo: str,
    branch: str,
    base_commit: str,
    head_commit: str,
    audit_id: int,
    base_url: Optional[str] = None,
):
    """Background task to execute the audit pipeline for a webhook push event."""
    from utils.trace import event_emitter
    from db.supabase import save_logs, get_client
    import asyncio

    try:
        provider_token = resolve_provider_token_for_repo(repo)
        config.github_token_var.set(provider_token)
    except GitHubAuthError as exc:
        report_md = (
            "# Auto Audit Execution Failed\n\n"
            f"**Reason:** {exc}\n\n"
            "**Remediation:** Sign in to the QAForge dashboard with GitHub and "
            "re-enable Auto Audits for this repository to refresh the OAuth session."
        )
        try:
            get_client().table("audits").update({
                "status": "error",
                "report_markdown": report_md,
            }).eq("id", audit_id).execute()
            save_logs(message=str(exc), level="error", audit_id=audit_id)
        except Exception:
            pass
        return

    findings_lock = asyncio.Lock()
    findings_list = []

    def db_log_emitter(event_type: str, data: Any):
        if event_type == "log":
            try:
                msg = data["message"]
                level = "info"
                if "error" in msg.lower():
                    level = "error"
                elif any(x in msg.lower() for x in ["done", "complete", "final answer"]):
                    level = "success"

                save_logs(
                    message=msg,
                    level=level,
                    audit_id=audit_id,
                    payload={"agent": data.get("agent")}
                )
            except Exception as e:
                print("Failed to save background log:", e)
        elif event_type == "findings":
            async def update_findings():
                async with findings_lock:
                    findings_list.extend(data)
                    try:
                        get_client().table("audits").update({"findings": findings_list}).eq("id", audit_id).execute()
                    except Exception as e:
                        print("Failed to update findings in background:", e)
            asyncio.create_task(update_findings())

    event_emitter.set(db_log_emitter)

    try:
        from db.supabase import update_webhook_timestamps
        from datetime import datetime, timezone
        update_webhook_timestamps(repo=repo, last_auto_audit=datetime.now(timezone.utc).isoformat())
    except Exception as e:
        print("Failed to update last_auto_audit timestamp:", e)

    try:
        is_new_branch = base_commit == "0000000000000000000000000000000000000000" or not base_commit
        scope = "full_module" if is_new_branch else "commit_range"
        
        save_logs(
            message=f"Starting Auto Audit. Scope: {scope} · Branch: {branch} · Head: {head_commit[:7] if head_commit else 'N/A'}",
            level="info",
            audit_id=audit_id
        )

        final_state = await run_audit_pipeline(
            repo=repo,
            module_path=".",
            scope=scope,
            branch=branch,
            base_commit=None if is_new_branch else base_commit,
            head_commit=None if is_new_branch else head_commit,
            base_url=base_url,
            origin="github_push",
        )

        payload = build_audit_response(final_state, repo)

        get_client().table("audits").update({
            "status": "completed",
            "probe_count": payload["probe_count"],
            "findings": payload["findings"],
            "report_markdown": payload["report_markdown"]
        }).eq("id", audit_id).execute()

        save_logs(
            message="Auto Audit completed successfully.",
            level="success",
            audit_id=audit_id
        )

    except GitHubAuthError as exc:
        err_msg = str(exc)
        report_md = (
            "# Auto Audit Execution Failed\n\n"
            f"**Reason:** {err_msg}\n\n"
            "**Remediation:** Sign in with GitHub and re-enable Auto Audits to refresh OAuth credentials."
        )
        try:
            get_client().table("audits").update({
                "status": "error",
                "report_markdown": report_md,
            }).eq("id", audit_id).execute()
            save_logs(message=f"Auto Audit execution failed: {err_msg}", level="error", audit_id=audit_id)
        except Exception as db_exc:
            print(f"Failed to update error status in DB: {db_exc}")
        return
    except (InvalidTargetUrlError, RepoConfigNotFoundError, RepoConfigMismatchError) as exc:
        err_msg = str(exc)
        report_md = (
            "# Auto Audit Execution Failed\n\n"
            f"**Reason:** {err_msg}\n\n"
            "**Remediation:** Open the dashboard, set a valid staging URL, and re-enable "
            "Auto Audits so repository runtime configuration is persisted in Supabase."
        )
        try:
            get_client().table("audits").update({
                "status": "error",
                "report_markdown": report_md,
            }).eq("id", audit_id).execute()
            save_logs(
                message=f"Auto Audit execution failed: {err_msg}",
                level="error",
                audit_id=audit_id,
            )
        except Exception as db_exc:
            print(f"Failed to update error status in DB: {db_exc}")
        return
    except Exception as exc:
        print(f"Auto Audit run failed: {exc}")
        err_msg = str(exc)
        report_md = f"# Auto Audit Execution Failed\n\n{err_msg}"

        # Check for GitHub-specific auth/permission errors
        from github.GithubException import BadCredentialsException, GithubException
        if isinstance(exc, BadCredentialsException) or "bad credentials" in err_msg.lower():
            err_msg = "GitHub OAuth session has expired or been revoked."
            report_md = (
                "# Auto Audit Execution Failed\n\n"
                "**Reason:** The authenticated GitHub OAuth session has expired or was revoked.\n\n"
                "**Remediation:** Please log into the QAForge dashboard again and toggle "
                "'Auto Audits' off and on for this repository to refresh the webhook credentials."
            )
        elif isinstance(exc, GithubException) and exc.status in (403, 404):
            err_msg = "GitHub repository is inaccessible or has insufficient permissions."
            report_md = (
                "# Auto Audit Execution Failed\n\n"
                "**Reason:** The repository is inaccessible or the OAuth token has insufficient permissions.\n\n"
                "**Remediation:** Ensure that you still have access to this repository and that the OAuth session "
                "grants the necessary scopes to read repository files and branches."
            )

        try:
            get_client().table("audits").update({
                "status": "error",
                "report_markdown": report_md
            }).eq("id", audit_id).execute()

            save_logs(
                message=f"Auto Audit execution failed: {err_msg}",
                level="error",
                audit_id=audit_id
            )
        except Exception as db_exc:
            print(f"Failed to update error status in DB: {db_exc}")


@app.post("/webhook/github")
async def github_webhook_receiver(request: Request, background_tasks: BackgroundTasks):
    """Handle incoming GitHub webhook events."""
    event_type = request.headers.get("X-GitHub-Event")
    if not event_type:
        raise HTTPException(status_code=400, detail="X-GitHub-Event header missing")

    if event_type == "ping":
        return {"status": "pong"}

    if event_type != "push":
        raise HTTPException(status_code=400, detail=f"Unsupported event type: {event_type}")

    body_bytes = await request.body()
    try:
        payload = json.loads(body_bytes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    repo_name = payload.get("repository", {}).get("full_name")
    if not repo_name:
        raise HTTPException(status_code=400, detail="Repository full name missing from payload")

    webhook = get_webhook(repo_name)
    if not webhook:
        raise HTTPException(
            status_code=404,
            detail=f"GitHub webhook credentials not found for repository '{repo_name}'.",
        )

    webhook_secret = webhook.get("webhook_secret")

    signature_header = request.headers.get("X-Hub-Signature-256")
    if not signature_header or not signature_header.startswith("sha256="):
        raise HTTPException(status_code=401, detail="X-Hub-Signature-256 header missing or invalid")

    expected_signature = signature_header[7:]
    mac = hmac.new(
        webhook_secret.encode("utf-8"),
        msg=body_bytes,
        digestmod=hashlib.sha256
    )
    computed_signature = mac.hexdigest()

    if not hmac.compare_digest(expected_signature, computed_signature):
        raise HTTPException(status_code=403, detail="Invalid webhook signature")

    ref = payload.get("ref", "")
    if not ref.startswith("refs/heads/"):
        return {"status": "ignored", "reason": "Not a branch push event"}

    branch = ref.replace("refs/heads/", "")
    head_commit = payload.get("after")
    base_commit = payload.get("before")

    try:
        resolved_base_url, audit_branch = resolve_webhook_audit_target(
            repo_name=repo_name,
            push_branch=branch,
        )
    except RepoConfigNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (RepoConfigMismatchError, InvalidTargetUrlError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    try:
        from datetime import datetime, timezone
        update_webhook_timestamps(repo=repo_name, last_push_received=datetime.now(timezone.utc).isoformat())
    except Exception as e:
        print("Failed to update last_push_received timestamp:", e)

    try:
        record = save_audit(
            repo=repo_name,
            module=".",
            status="running",
            probe_count=0,
            findings=[],
            report_markdown="",
            origin="github_push"
        )
        audit_id = record.get("id")
        if not audit_id:
            raise SupabasePersistenceError("Audit record did not return an id")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to initialize audit record: {exc}")

    try:
        save_logs(
            message="Auto Audit triggered by Git Push.",
            level="info",
            audit_id=audit_id
        )
    except Exception:
        pass

    background_tasks.add_task(
        background_audit_runner,
        repo=repo_name,
        branch=audit_branch,
        base_commit=base_commit,
        head_commit=head_commit,
        audit_id=audit_id,
        base_url=resolved_base_url,
    )

    return {
        "status": "triggered",
        "audit_id": audit_id,
        "repo": repo_name,
        "branch": audit_branch,
    }

