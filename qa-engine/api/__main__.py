"""Run the FastAPI server without depending on shell PATH activation."""

from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MIN_RUNTIME_VERSION = (3, 11)


def _ensure_supported_python() -> None:
    """Re-run under the local venv interpreter when the active Python is too old."""
    if sys.version_info >= MIN_RUNTIME_VERSION:
        return

    if os.environ.get("QA_ENGINE_API_BOOTSTRAPPED") == "1":
        return

    venv_python = PROJECT_ROOT / "venv" / "Scripts" / "python.exe"
    if not venv_python.exists():
        return

    env = os.environ.copy()
    env["QA_ENGINE_API_BOOTSTRAPPED"] = "1"
    result = subprocess.run(
        [str(venv_python), "-m", "api", *sys.argv[1:]],
        cwd=str(PROJECT_ROOT),
        env=env,
    )
    raise SystemExit(result.returncode)


def main() -> None:
    _ensure_supported_python()

    import uvicorn

    # Render/Railway/Fly set PORT; bind 0.0.0.0 so the platform can route traffic.
    port = int(os.getenv("PORT") or os.getenv("QA_ENGINE_API_PORT", "8000"))
    on_paas = bool(os.getenv("PORT"))
    host = os.getenv("QA_ENGINE_API_HOST") or ("0.0.0.0" if on_paas else "127.0.0.1")
    reload_default = "0" if on_paas else "1"
    reload = os.getenv("QA_ENGINE_API_RELOAD", reload_default) != "0"

    uvicorn.run(
        "api.server:app",
        host=host,
        port=port,
        reload=reload,
    )


if __name__ == "__main__":
    main()
