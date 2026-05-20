"""FastAPI server exposing the qa-engine audit pipeline."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import config
from api.service import (
    AuditPersistenceError,
    AuditPipelineError,
    InvalidRepoError,
    MalformedAuditOutputError,
    ReportNotFoundError,
    build_audit_response,
    build_latest_audit_response,
    persist_audit_result,
    run_audit_pipeline,
)
from db.supabase import SupabaseConfigError, SupabasePersistenceError, save_logs


class AuditRequest(BaseModel):
    """Incoming payload for POST /audit."""

    repo: str = Field(..., examples=["owner/repo"])
    module: str = Field(default=".", examples=["."])
    scope: Literal["full_module", "pr", "commit_range"] = "full_module"
    pr_number: Optional[int] = None
    base_commit: Optional[str] = None
    head_commit: Optional[str] = None
    branch: str = config.DEFAULT_BRANCH


class AuditResponse(BaseModel):
    """Structured audit response for the frontend."""

    audit_id: Optional[int] = None
    status: str
    repo: str
    probe_count: int
    findings: List[Dict[str, Any]]
    report_markdown: str
    report_path: str


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


@app.get("/health")
async def health() -> Dict[str, str]:
    """Basic health check endpoint."""
    return {"status": "ok"}


@app.post("/audit", response_model=AuditResponse)
async def create_audit(request: AuditRequest) -> AuditResponse:
    """Trigger the existing LangGraph audit pipeline and persist the result."""
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
