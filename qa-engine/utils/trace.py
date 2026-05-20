"""Shared trace logger for all agents."""

import sys
from datetime import datetime

import config


def trace(agent: str, msg: str) -> None:
    """Emit a trace line to stderr and append it to traces/trace.log."""
    timestamp = datetime.utcnow().strftime("%H:%M:%S")
    line = f"[{timestamp}] [{agent}] {msg}"
    print(line, file=sys.stderr, flush=True)

    config.ensure_runtime_dirs()
    trace_log = config.TRACES_DIR / "trace.log"
    try:
        with trace_log.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except OSError:
        pass
