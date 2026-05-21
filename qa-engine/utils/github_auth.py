"""GitHub OAuth provider token resolution without persisting tokens in Supabase."""

from __future__ import annotations

import threading
import time
from typing import Dict, Optional, Tuple

# In-memory cache: repo_name -> (provider_token, expires_at_unix)
# Populated when a user enables Auto Audits with a live OAuth token.
# Not persisted; re-enable Auto Audits after server restarts if needed.
_REPO_TOKEN_CACHE: Dict[str, Tuple[str, float]] = {}
_CACHE_LOCK = threading.Lock()
_DEFAULT_TTL_SECONDS = 8 * 60 * 60  # 8 hours


class GitHubAuthError(RuntimeError):
    """Raised when no valid GitHub OAuth provider token is available."""


def cache_repo_provider_token(
    repo_name: str,
    provider_token: str,
    *,
    ttl_seconds: int = _DEFAULT_TTL_SECONDS,
) -> None:
    """Remember the user's GitHub OAuth token for webhook background tasks."""
    normalized = (repo_name or "").strip()
    token = (provider_token or "").strip()
    if not normalized or not token:
        return
    expires_at = time.time() + ttl_seconds
    with _CACHE_LOCK:
        _REPO_TOKEN_CACHE[normalized] = (token, expires_at)


def get_cached_repo_provider_token(repo_name: str) -> Optional[str]:
    """Return a cached provider token for the repo if still valid."""
    normalized = (repo_name or "").strip()
    if not normalized:
        return None
    with _CACHE_LOCK:
        entry = _REPO_TOKEN_CACHE.get(normalized)
        if not entry:
            return None
        token, expires_at = entry
        if time.time() >= expires_at:
            _REPO_TOKEN_CACHE.pop(normalized, None)
            return None
        return token


def clear_repo_provider_token(repo_name: str) -> None:
    """Drop cached OAuth token when Auto Audits are disabled."""
    normalized = (repo_name or "").strip()
    if not normalized:
        return
    with _CACHE_LOCK:
        _REPO_TOKEN_CACHE.pop(normalized, None)


def resolve_provider_token_for_repo(
    repo_name: str,
    *,
    explicit: Optional[str] = None,
) -> str:
    """Resolve GitHub OAuth token from explicit input or in-memory repo cache."""
    token = (explicit or "").strip() or get_cached_repo_provider_token(repo_name)
    if not token:
        raise GitHubAuthError(
            f"No active GitHub OAuth session for repository '{repo_name}'. "
            "Sign in via the dashboard and re-enable Auto Audits to refresh credentials."
        )
    return token


def verify_github_repo_access(repo_name: str, provider_token: str) -> None:
    """Ensure the OAuth token can access the target repository."""
    from github import Github
    from github.GithubException import BadCredentialsException, GithubException

    normalized = (repo_name or "").strip()
    try:
        gh = Github(provider_token)
        gh.get_repo(normalized)
    except BadCredentialsException as exc:
        raise GitHubAuthError(
            "GitHub OAuth session has expired or was revoked. Sign in again and re-enable Auto Audits."
        ) from exc
    except GithubException as exc:
        if exc.status in (403, 404):
            raise GitHubAuthError(
                f"GitHub token cannot access repository '{normalized}'. "
                "Confirm repository ownership and OAuth repo scope."
            ) from exc
        raise GitHubAuthError(f"GitHub API error while verifying repository access: {exc}") from exc
    except GitHubAuthError:
        raise
    except Exception as exc:
        raise GitHubAuthError(f"Failed to verify repository access: {exc}") from exc
