"""Probe execution tools for Agent 4 (Probe Executor).

Provides the async HTTP client for firing probes against staging
and a response validator.
"""

import json
import time
from typing import Any, Dict, Optional, Tuple

import httpx

from utils.trace import trace

AGENT = "PROBE_EXECUTOR"


async def execute_api_call(
    base_url: str,
    method: str,
    endpoint: str,
    payload: Dict[str, Any],
    timeout: float = 5.0,
    probe_id: str = "",
) -> Tuple[int, Dict[str, Any], int, Optional[str]]:
    """Fire a single HTTP request against the staging API.

    Args:
        base_url: Staging server base URL (e.g. https://staging.example.com).
        method: HTTP method (GET, POST, PUT, DELETE …).
        endpoint: Full endpoint string like 'POST /payment' — path is extracted.
        payload: JSON body to send.
        timeout: Request timeout in seconds.
        probe_id: For trace logging.

    Returns:
        Tuple of (status_code, response_body, response_time_ms, error_or_None).
    """
    # Extract path from endpoint string like "POST /payment"
    path = endpoint.split(" ", 1)[1] if " " in endpoint else endpoint
    url = f"{base_url.rstrip('/')}{path}"

    payload_summary = json.dumps(payload)
    if len(payload_summary) > 80:
        payload_summary = payload_summary[:77] + "..."

    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=timeout) as http:
            resp = await http.request(method=method, url=url, json=payload)

        actual_status = resp.status_code
        try:
            response_body = resp.json() if resp.content else {}
        except Exception:
            response_body = {"raw": resp.text[:500]}
        error = None

    except httpx.TimeoutException:
        actual_status = 0
        response_body = {}
        error = "TIMEOUT"

    except Exception as e:
        actual_status = 0
        response_body = {}
        error = str(e)

    response_time_ms = int((time.time() - start) * 1000)

    tag = f"PROBE_EXECUTOR:{probe_id}" if probe_id else AGENT
    trace(tag, f"{method} {path} {payload_summary} → {actual_status} ({response_time_ms}ms)")

    if error:
        trace(tag, f"Error: {error}")

    return actual_status, response_body, response_time_ms, error


def validate_response(
    actual_status: int,
    expected_status: int,
    response_body: Dict[str, Any],
    expected_contains: Dict[str, Any],
) -> bool:
    """Check if a response matches expectations.

    Args:
        actual_status: HTTP status code received.
        expected_status: HTTP status code expected.
        response_body: Parsed JSON response.
        expected_contains: Partial dict the response should contain.

    Returns:
        True if status matches AND all expected keys are present in body.
    """
    if actual_status != expected_status:
        return False

    for key, value in expected_contains.items():
        if key not in response_body:
            return False
        # If value is not None, check exact match
        if value is not None and response_body[key] != value:
            return False

    return True
