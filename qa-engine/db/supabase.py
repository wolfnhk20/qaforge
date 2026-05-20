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
    origin: str = "manual",
) -> Dict[str, Any]:
    """Persist a completed audit row to Supabase."""
    payload = {
        "repo": repo,
        "module": module,
        "status": status,
        "probe_count": probe_count,
        "findings": findings,
        "report_markdown": report_markdown,
        "origin": origin,
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


def get_webhook(repo: str) -> Optional[Dict[str, Any]]:
    """Retrieve webhook configuration for a repo if available."""
    if not is_configured():
        return None
    try:
        response = get_client().table("webhooks").select("*").eq("repo", repo).execute()
        data = getattr(response, "data", None) or []
        return data[0] if data else None
    except Exception as exc:
        raise SupabasePersistenceError(f"Failed to fetch webhook: {exc}") from exc


def save_webhook(
    *,
    repo: str,
    webhook_id: int,
    webhook_secret: str,
    enabled: bool = True,
) -> Dict[str, Any]:
    """Persist/update webhook metadata in Supabase."""
    row = {
        "repo": repo,
        "webhook_id": webhook_id,
        "webhook_secret": webhook_secret,
        "enabled": enabled,
        "created_at": _utc_now_iso(),
    }
    try:
        response = get_client().table("webhooks").upsert(row).execute()
        data = getattr(response, "data", None) or []
        if not data:
            raise SupabasePersistenceError("Supabase upsert returned no webhook record.")
        return data[0]
    except Exception as exc:
        raise SupabasePersistenceError(f"Failed to save webhook: {exc}") from exc


def update_webhook_status(*, repo: str, enabled: bool) -> Optional[Dict[str, Any]]:
    """Enable/disable a webhook in Supabase."""
    try:
        response = get_client().table("webhooks").update({"enabled": enabled}).eq("repo", repo).execute()
        data = getattr(response, "data", None) or []
        return data[0] if data else None
    except Exception as exc:
        raise SupabasePersistenceError(f"Failed to update webhook status: {exc}") from exc


def update_webhook_timestamps(
    *,
    repo: str,
    last_push_received: Optional[str] = None,
    last_auto_audit: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Update webhook push and audit run timestamps in Supabase."""
    payload: Dict[str, Any] = {}
    if last_push_received:
        payload["last_push_received"] = last_push_received
    if last_auto_audit:
        payload["last_auto_audit"] = last_auto_audit
    if not payload:
        return None
    try:
        response = get_client().table("webhooks").update(payload).eq("repo", repo).execute()
        data = getattr(response, "data", None) or []
        return data[0] if data else None
    except Exception as exc:
        raise SupabasePersistenceError(f"Failed to update webhook timestamps: {exc}") from exc

