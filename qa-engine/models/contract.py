"""Pydantic models for the Functional Contract (Agent 1 output)."""

from enum import Enum
from typing import List

from pydantic import BaseModel, Field


class ScopeType(str, Enum):
    """Scope of the audit analysis."""
    FULL_MODULE = "full_module"
    PR = "pr"
    COMMIT_RANGE = "commit_range"


class FunctionalContract(BaseModel):
    """
    Output of Agent 1 (Intent Extractor).
    Captures what the module is supposed to do based on README, commits, PR, and diffs.
    """
    module: str = Field(..., description="Name of the module being audited")
    repo: str = Field(..., description="GitHub repo in org/repo format")
    scope: ScopeType = Field(..., description="Scope of the analysis")
    intent: str = Field(..., description="High-level description of what the module does")
    recent_changes: List[str] = Field(
        default_factory=list,
        description="Summary of recent changes from commits/PR"
    )
    expected_behaviors: List[str] = Field(
        default_factory=list,
        description="List of expected functional behaviors derived from intent"
    )
    ambiguities: List[str] = Field(
        default_factory=list,
        description="Things unclear from docs alone that a QA engineer would need clarified"
    )
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Agent's confidence in the extracted contract (0.0–1.0)"
    )
