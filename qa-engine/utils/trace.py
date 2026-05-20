"""Shared trace logger for all agents."""

import sys
from datetime import datetime
import contextvars
from typing import Any, Callable, Optional

import config

event_emitter: contextvars.ContextVar[Optional[Callable[[str, Any], None]]] = contextvars.ContextVar("event_emitter", default=None)


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

    emitter = event_emitter.get()
    if emitter is not None:
        try:
            emitter("log", {"agent": agent, "message": msg, "timestamp": timestamp})
        except Exception:
            pass
