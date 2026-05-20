"""Persistent per-repository runtime configuration in Supabase."""

from __future__ import annotations

from typing import Any, Dict, Optional

from db.supabase import SupabasePersistenceError, _utc_now_iso, get_client, is_configured


def get_repository_config(repo_name: str) -> Optional[Dict[str, Any]]:
    """Fetch runtime configuration for a repository."""
    if not is_configured():
        return None
    try:
        response = (
            get_client()
            .table("repository_configs")
            .select("*")
            .eq("repo_name", repo_name)
            .execute()
        )
        data = getattr(response, "data", None) or []
        return data[0] if data else None
    except Exception as exc:
        raise SupabasePersistenceError(f"Failed to fetch repository config: {exc}") from exc


def save_repository_config(
    *,
    repo_name: str,
    branch: str,
    staging_url: str,
    webhook_enabled: bool,
    created_by: Optional[str] = None,
) -> Dict[str, Any]:
    """Create or update repository runtime configuration."""
    now = _utc_now_iso()
    existing = get_repository_config(repo_name)
    row: Dict[str, Any] = {
        "repo_name": repo_name,
        "branch": branch,
        "staging_url": staging_url,
        "webhook_enabled": webhook_enabled,
        "updated_at": now,
    }
    if created_by:
        row["created_by"] = created_by
    if not existing:
        row["created_at"] = now

    try:
        response = get_client().table("repository_configs").upsert(row).execute()
    except Exception as exc:
        raise SupabasePersistenceError(f"Failed to save repository config: {exc}") from exc

    data = getattr(response, "data", None) or []
    if not data:
        raise SupabasePersistenceError("Supabase upsert returned no repository config record.")
    return data[0]


def set_repository_webhook_enabled(*, repo_name: str, enabled: bool) -> Optional[Dict[str, Any]]:
    """Toggle webhook_enabled without removing stored staging URL or branch."""
    if not is_configured():
        return None
    try:
        response = (
            get_client()
            .table("repository_configs")
            .update({"webhook_enabled": enabled, "updated_at": _utc_now_iso()})
            .eq("repo_name", repo_name)
            .execute()
        )
        data = getattr(response, "data", None) or []
        return data[0] if data else None
    except Exception as exc:
        raise SupabasePersistenceError(f"Failed to update repository webhook flag: {exc}") from exc
