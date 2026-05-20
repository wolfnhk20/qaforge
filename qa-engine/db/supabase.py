"""Supabase persistence helpers for qa-engine."""

from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Dict, Optional

from supabase import Client, create_client

import config


class SupabaseConfigError(RuntimeError):
    """Raised when Supabase environment variables are missing."""


class SupabasePersistenceError(RuntimeError):
    """Raised when Supabase queries fail."""


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_configured() -> bool:
    """Return whether Supabase credentials are available."""
    return bool(config.SUPABASE_URL and config.SUPABASE_KEY)


@lru_cache(maxsize=1)
def get_client() -> Client:
    """Create and cache the Supabase client."""
    if not is_configured():
        raise SupabaseConfigError("SUPABASE_URL and SUPABASE_KEY must be configured.")
    return create_client(config.SUPABASE_URL, config.SUPABASE_KEY)


def save_audit(
    *,
    repo: str,
    module: str,
    status: str,
    probe_count: int,
    findings: list[dict[str, Any]],
    report_markdown: str,
) -> Dict[str, Any]:
    """Persist a completed audit row to Supabase."""
    payload = {
        "repo": repo,
        "module": module,
        "status": status,
        "probe_count": probe_count,
        "findings": findings,
        "report_markdown": report_markdown,
        "created_at": _utc_now_iso(),
    }

    try:
        response = get_client().table("audits").insert(payload).execute()
    except Exception as exc:
        raise SupabasePersistenceError(f"Failed to save audit: {exc}") from exc

    data = getattr(response, "data", None) or []
    if not data:
        raise SupabasePersistenceError("Supabase insert returned no audit record.")
    return data[0]


def get_latest_audit() -> Optional[Dict[str, Any]]:
    """Fetch the latest persisted audit row if available."""
    if not is_configured():
        return None

    try:
        response = (
            get_client()
            .table("audits")
            .select("*")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise SupabasePersistenceError(f"Failed to fetch latest audit: {exc}") from exc

    data = getattr(response, "data", None) or []
    return data[0] if data else None


def save_logs(
    *,
    message: str,
    level: str = "info",
    audit_id: Optional[int] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Persist an application log row to Supabase."""
    if not is_configured():
        return None

    row = {
        "audit_id": audit_id,
        "level": level,
        "message": message,
        "payload": payload or {},
        "created_at": _utc_now_iso(),
    }

    try:
        response = get_client().table("logs").insert(row).execute()
    except Exception as exc:
        raise SupabasePersistenceError(f"Failed to save audit log: {exc}") from exc

    data = getattr(response, "data", None) or []
    return data[0] if data else None
