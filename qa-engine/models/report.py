"""Pydantic models for the Audit Report (Agent 5 output)."""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class GapSeverity(str, Enum):
    """Severity level of a functional gap."""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class Gap(BaseModel):
    """A single functional gap discovered during the audit."""
    severity: GapSeverity = Field(..., description="Severity level of the gap")
    endpoint: str = Field(..., description="The API endpoint affected")
    title: str = Field(..., description="Short title, e.g. 'Missing Validation'")
    what_happened: str = Field(..., description="Description of the observed behavior")
    fix: str = Field(..., description="Suggested fix")
    github_issue_url: Optional[str] = Field(
        default=None,
        description="URL of the filed GitHub issue, if any"
    )


class ScalabilityRisk(BaseModel):
    """A scalability risk identified via static analysis."""
    description: str = Field(..., description="Description of the risk")


class PassedCheck(BaseModel):
    """A check that passed during the audit."""
    description: str = Field(..., description="Description of what passed")


class AuditReport(BaseModel):
    """
    Output of Agent 5 (Report Synthesizer).
    Structured representation of the full audit report.
    """
    module: str = Field(..., description="Name of the audited module")
    generated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp when the report was generated"
    )
    apis_audited: int = Field(default=0, description="Number of APIs audited")
    probes_run: int = Field(default=0, description="Number of probes executed")
    gaps_found: int = Field(default=0, description="Number of gaps discovered")
    overall_confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Overall confidence percentage (0.0–1.0)"
    )
    functional_gaps: List[Gap] = Field(
        default_factory=list,
        description="List of functional gaps found"
    )
    scalability_risks: List[ScalabilityRisk] = Field(
        default_factory=list,
        description="Scalability risks from static analysis"
    )
    passed_checks: List[PassedCheck] = Field(
        default_factory=list,
        description="Checks that passed successfully"
    )
