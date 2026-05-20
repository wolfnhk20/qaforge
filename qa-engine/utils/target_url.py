"""Runtime staging/base URL validation for per-audit probe execution."""

from __future__ import annotations

import re
from typing import Optional
from urllib.parse import urlparse

_SCHEME_RE = re.compile(r"^https?://", re.IGNORECASE)
_HOST_RE = re.compile(
    r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"
    r"|^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$"
)


class TargetUrlError(ValueError):
    """Raised when a staging/base URL is missing or invalid."""


def normalize_base_url(raw: str) -> str:
    """Normalize and validate a user-provided staging base URL."""
    candidate = (raw or "").strip()
    if not candidate:
        raise TargetUrlError("Staging base URL is required.")

    if any(ch.isspace() for ch in candidate):
        raise TargetUrlError("Staging base URL must not contain whitespace.")

    if not _SCHEME_RE.match(candidate):
        candidate = f"https://{candidate}"

    parsed = urlparse(candidate)
    if parsed.scheme not in ("http", "https"):
        raise TargetUrlError("Staging base URL must use http or https.")

    hostname = (parsed.hostname or "").strip().lower()
    if not hostname:
        raise TargetUrlError("Staging base URL must include a valid hostname.")

    if hostname == "localhost" or hostname.endswith(".local"):
        pass
    elif re.match(r"^\d{1,3}(\.\d{1,3}){3}$", hostname):
        pass
    elif hostname.startswith("[") and hostname.endswith("]"):
        pass
    elif not _HOST_RE.match(hostname):
        raise TargetUrlError(f"Staging base URL hostname is invalid: {hostname!r}")

    port = parsed.port
    if port is not None and not (1 <= port <= 65535):
        raise TargetUrlError("Staging base URL port must be between 1 and 65535.")

    base = f"{parsed.scheme}://{parsed.netloc}"
    return base.rstrip("/")


def resolve_audit_base_url(
    explicit: Optional[str] = None,
    *,
    fallback: Optional[str] = None,
    required: bool = True,
) -> Optional[str]:
    """Resolve the runtime probe target from request or webhook context."""
    candidate = (explicit or "").strip() or (fallback or "").strip()
    if not candidate:
        if required:
            raise TargetUrlError(
                "Staging base URL is required for runtime probe execution. "
                "Provide base_url in the audit request or persist staging_url by "
                "enabling Auto Audits for this repository in the dashboard."
            )
        return None
    return normalize_base_url(candidate)
