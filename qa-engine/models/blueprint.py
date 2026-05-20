"""Pydantic models for the Module Blueprint (Agent 2 output)."""

from typing import Any, Dict, List

from pydantic import BaseModel, Field


class FunctionDetail(BaseModel):
    """Detailed info about a function traced during code analysis."""
    params: Dict[str, str] = Field(default_factory=dict, description="param: type")
    returns: str = Field(default="", description="Return type")
    side_effects: List[str] = Field(default_factory=list, description="DB write, external call, event emit")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class APIEndpoint(BaseModel):
    """A single API endpoint discovered during code analysis."""
    endpoint: str = Field(..., description="Route path, e.g. 'POST /payment'")
    method: str = Field(..., description="HTTP method")
    handler_function: str = Field(default="", description="Route handler function name")
    payload_schema: Dict[str, str] = Field(default_factory=dict)
    response_schema: Dict[str, str] = Field(default_factory=dict)
    functions_called: List[str] = Field(default_factory=list)
    function_details: Dict[str, FunctionDetail] = Field(default_factory=dict)


class ModuleBlueprint(BaseModel):
    """Output of Agent 2 (Code Analyst)."""
    module: str = Field(..., description="Name of the module being analyzed")
    apis: List[APIEndpoint] = Field(default_factory=list)
    files_analyzed: List[str] = Field(default_factory=list)
    files_not_analyzed: List[str] = Field(default_factory=list)
    analyst_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
