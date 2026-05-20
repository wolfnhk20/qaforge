"""Database adapters for qa-engine."""

from db.supabase import get_latest_audit, save_audit, save_logs

__all__ = ["get_latest_audit", "save_audit", "save_logs"]
