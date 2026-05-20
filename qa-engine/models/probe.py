"""Pydantic models for Probe Plan and Probe Results (Agents 3 & 4)."""

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Agent 3: Probe Designer output
# ---------------------------------------------------------------------------

class Priority(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"


class ProbeCase(BaseModel):
    """A single test case (positive, negative, or edge)."""
    case_id: str = Field(..., description="e.g. 'P01_POS_01'")
    desc: str = Field(..., description="Human-readable description")
    payload: Dict[str, Any] = Field(default_factory=dict)
    expected_status: int = Field(..., description="Expected HTTP status code")
    expected_response_contains: Dict[str, Any] = Field(
        default_factory=dict, description="Partial response match"
    )


class ProbeObject(BaseModel):
    """A probe targeting a specific API endpoint."""
    probe_id: str = Field(..., description="e.g. 'P01'")
    target_endpoint: str = Field(..., description="e.g. 'POST /payment'")
    method: str = Field(..., description="HTTP method")
    priority: Priority = Field(...)
    gap_hypothesis: str = Field(..., description="What you suspect is broken")
    positive_cases: List[ProbeCase] = Field(default_factory=list)
    negative_cases: List[ProbeCase] = Field(default_factory=list)
    edge_cases: List[ProbeCase] = Field(default_factory=list)
    scalability_flags: List[str] = Field(default_factory=list)


class ProbePlan(BaseModel):
    """Output of Agent 3 (Probe Designer)."""
    probes: List[ProbeObject] = Field(default_factory=list)
    total_probes: int = Field(default=0)
    designer_notes: str = Field(default="")


# ---------------------------------------------------------------------------
# Agent 4: Probe Executor output
# ---------------------------------------------------------------------------

class ProbeDecision(str, Enum):
    PASS = "PASS"
    FAIL_RETRY = "FAIL_RETRY"
    FAIL_CONFIRMED = "FAIL_CONFIRMED"


class GapClassification(str, Enum):
    FUNCTIONAL_GAP = "FUNCTIONAL_GAP"
    MISSING_VALIDATION = "MISSING_VALIDATION"
    SCALABILITY_RISK = "SCALABILITY_RISK"


class CaseDecision(BaseModel):
    """LLM reasoning output for a single executed case."""
    case_id: str = Field(...)
    decision: ProbeDecision = Field(...)
    actual_status: int = Field(default=0)
    expected_status: int = Field(default=0)
    response_time_ms: int = Field(default=0)
    reasoning: str = Field(default="")
    classification: Optional[GapClassification] = Field(default=None)
    suggested_fix: Optional[str] = Field(default=None)
    retry_payload: Optional[Dict[str, Any]] = Field(default=None)


class GapDetail(BaseModel):
    """A confirmed gap from probe execution."""
    case_id: str = Field(...)
    classification: GapClassification = Field(...)
    reasoning: str = Field(default="")
    suggested_fix: str = Field(default="")


class ProbeResult(BaseModel):
    """Aggregated result for one probe (all cases)."""
    probe_id: str = Field(...)
    target_endpoint: str = Field(default="")
    priority: str = Field(default="")
    gap_hypothesis: str = Field(default="")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    total_cases: int = Field(default=0)
    passed: int = Field(default=0)
    failed: int = Field(default=0)
    gaps: List[GapDetail] = Field(default_factory=list)
    scalability_flags: List[str] = Field(default_factory=list)


class ProbeResults(BaseModel):
    """Output of Agent 4 — maps probe_id → ProbeResult."""
    results: Dict[str, ProbeResult] = Field(default_factory=dict)
