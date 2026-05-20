"""Shared configuration and repo-root path helpers."""

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent
OUTPUTS_DIR = PROJECT_ROOT / "outputs"
TRACES_DIR = PROJECT_ROOT / "traces"
PROMPTS_DIR = PROJECT_ROOT / "prompts"
API_DIR = PROJECT_ROOT / "api"

load_dotenv(PROJECT_ROOT / ".env")

# --- LLM (Groq) ---
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
MODEL_NAME: str = os.getenv("MODEL_NAME", "llama-3.3-70b-versatile")

# --- GitHub ---
GITHUB_TOKEN: str = os.getenv("GITHUB_TOKEN", "")

# --- Supabase ---
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

# --- Staging ---
STAGING_BASE_URL: str = os.getenv("STAGING_BASE_URL", "http://localhost:8000")

# --- Defaults ---
DEFAULT_BRANCH: str = os.getenv("DEFAULT_BRANCH", "main")
DEFAULT_COMMIT_COUNT: int = int(os.getenv("DEFAULT_COMMIT_COUNT", "5"))

# --- Pipeline limits ---
MAX_FILES_TO_ANALYZE: int = 5
MAX_PROBE_RETRIES: int = 1
PROBE_TIMEOUT_SECONDS: float = 5.0


def normalize_module_path(module_path: str) -> str:
    """Normalize user-provided module paths for GitHub and report helpers."""
    normalized = (module_path or "").strip().replace("\\", "/")
    if normalized in {"", ".", "./", "/"}:
        return ""
    return normalized.strip("/")


def ensure_runtime_dirs() -> None:
    """Create runtime directories that the backend writes into."""
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    TRACES_DIR.mkdir(parents=True, exist_ok=True)


def to_project_relative(path: Path) -> str:
    """Return a project-relative string path when possible."""
    try:
        return path.relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        return str(path)
