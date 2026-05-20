"""Utility to safely invoke LLM with error recovery.

Handles two common Groq issues:
1. Model tries to return final JSON as a fake "tool call" → parse from error
2. Rate limit errors → retry with delay
"""

import json
import re
import time
from typing import Optional

from langchain_core.messages import AIMessage, BaseMessage

from utils.trace import trace


def safe_model_invoke(
    model,
    messages: list[BaseMessage],
    agent_name: str = "AGENT",
    max_retries: int = 2,
    retry_delay: float = 5.0,
) -> AIMessage:
    """Invoke an LLM with automatic error recovery.

    Handles:
    - 'tool_use_failed' errors where the model returns JSON as a fake tool call
    - Rate limit (429/413) errors with retry + delay

    Returns:
        AIMessage with the response content.
    """
    last_error: Optional[Exception] = None

    for attempt in range(max_retries + 1):
        try:
            return model.invoke(messages)

        except Exception as e:
            error_str = str(e)
            last_error = e

            # --- Case 1: Model returned JSON as a fake tool call ---
            if "tool_use_failed" in error_str and "failed_generation" in error_str:
                trace(agent_name, "Model returned JSON as tool call — recovering...")
                extracted = _extract_json_from_failed_generation(error_str)
                if extracted:
                    trace(agent_name, "Successfully recovered JSON from failed tool call.")
                    return AIMessage(content=extracted)
                # If extraction failed, re-raise
                raise

            # --- Case 2: Rate limit / request too large ---
            if any(code in error_str for code in ["rate_limit", "429", "413", "too large"]):
                if attempt < max_retries:
                    wait = retry_delay * (attempt + 1)
                    trace(agent_name, f"Rate limited. Waiting {wait}s before retry {attempt + 1}/{max_retries}...")
                    time.sleep(wait)
                    continue
                raise

            # --- Other errors: don't retry ---
            raise

    raise last_error  # type: ignore


def _extract_json_from_failed_generation(error_str: str) -> Optional[str]:
    """Extract the actual JSON content from a 'failed_generation' error.

    The error contains something like:
    'failed_generation': '{"name": "JSON", "arguments": { ...actual data... }}'

    We extract the arguments value.
    """
    try:
        # Find the failed_generation content
        match = re.search(r"'failed_generation':\s*'(.*?)'}", error_str, re.DOTALL)
        if not match:
            return None

        failed_gen = match.group(1)

        # The failed_generation is: {"name": "JSON", "arguments": {<the actual data>}}
        # Try to find the arguments block
        args_match = re.search(r'"arguments":\s*(\{.*)', failed_gen, re.DOTALL)
        if args_match:
            # The arguments JSON goes to the end (minus trailing })
            args_str = args_match.group(1)
            # Remove the outer closing brace that belongs to the wrapper
            # Try parsing as-is first
            try:
                json.loads(args_str)
                return args_str
            except json.JSONDecodeError:
                # Try removing trailing }}
                if args_str.rstrip().endswith("}}"):
                    args_str = args_str.rstrip()[:-1]
                    json.loads(args_str)  # validate
                    return args_str

        # Fallback: try to find any JSON object with "module" key
        json_match = re.search(r'(\{[^{}]*"module"[^{}]*\{.*)', failed_gen, re.DOTALL)
        if json_match:
            return json_match.group(1)

    except Exception:
        pass

    return None
