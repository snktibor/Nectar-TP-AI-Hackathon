"""Pydantic V2 schemas: request/response DTOs and the standardized API envelope.

All public contracts live here. The envelope below is the single source of truth
for every response shape produced by the API (success and error alike).
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Generic, TypeVar
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class DocumentType(str, Enum):
    """Supported transfer-pricing document categories."""

    MASTER_FILE = "master_file"
    LOCAL_FILE = "local_file"
    CONTRACT = "contract"
    BENCHMARK_STUDY = "benchmark_study"
    OTHER = "other"


class AuditStatus(str, Enum):
    """Lifecycle states for an asynchronous audit task."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class RiskSeverity(str, Enum):
    """Severity classification for audit findings."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ---------------------------------------------------------------------------
# Standard envelope
# ---------------------------------------------------------------------------


T = TypeVar("T")


class ErrorDetail(BaseModel):
    """Structured error payload carried inside the envelope's `error` field."""

    model_config = ConfigDict(extra="forbid")

    code: str = Field(..., description="Stable machine-readable error code.")
    message: str = Field(..., description="Human-readable error description.")
    details: dict[str, Any] | None = Field(
        default=None,
        description="Optional structured context (validation issues, hints, etc.).",
    )


class ResponseMeta(BaseModel):
    """Per-response metadata. Always present on successful responses."""

    model_config = ConfigDict(extra="allow")

    request_id: UUID = Field(default_factory=uuid4)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    api_version: str = Field(default="v1")


class ApiResponse(BaseModel, Generic[T]):
    """Standardized API envelope returned by every endpoint.

    Exactly one of `data` (on success) or `error` (on failure) is populated.
    The schema is intentionally permissive on the data side so it can wrap any
    concrete response payload while keeping a stable outer shape.
    """

    model_config = ConfigDict(extra="forbid")

    success: bool
    data: T | None = None
    error: ErrorDetail | None = None
    meta: ResponseMeta | None = Field(default_factory=ResponseMeta)


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------


class DocumentUploadResponse(BaseModel):
    """Returned after a successful upload."""

    model_config = ConfigDict(extra="forbid")

    document_id: UUID
    session_id: UUID
    document_type: DocumentType
    filename: str
    size_bytes: int = Field(..., ge=0)
    uploaded_at: datetime


class DocumentRecord(BaseModel):
    """Document metadata as returned by the listing endpoint."""

    model_config = ConfigDict(extra="forbid")

    document_id: UUID
    session_id: UUID
    document_type: DocumentType
    filename: str
    size_bytes: int = Field(..., ge=0)
    uploaded_at: datetime


class DocumentListResponse(BaseModel):
    """Listing payload for a session's documents."""

    model_config = ConfigDict(extra="forbid")

    session_id: UUID
    documents: list[DocumentRecord]
    total: int = Field(..., ge=0)


# ---------------------------------------------------------------------------
# Audits
# ---------------------------------------------------------------------------


class AuditStartRequest(BaseModel):
    """Body of POST /audits/start."""

    model_config = ConfigDict(extra="forbid")

    session_id: UUID
    notes: str | None = Field(default=None, max_length=1000)


class AuditStartResponse(BaseModel):
    """Returned immediately when an audit is enqueued (HTTP 202)."""

    model_config = ConfigDict(extra="forbid")

    audit_task_id: UUID
    session_id: UUID
    status: AuditStatus = AuditStatus.PENDING
    accepted_at: datetime


class AuditStatusResponse(BaseModel):
    """Polling payload for GET /audits/status/{id}."""

    model_config = ConfigDict(extra="forbid")

    audit_task_id: UUID
    session_id: UUID
    status: AuditStatus
    progress: int = Field(..., ge=0, le=100, description="Completion percentage.")
    stage: str = Field(..., description="Human-readable current pipeline stage.")
    started_at: datetime
    updated_at: datetime
    error: ErrorDetail | None = None


# --- Final report sub-structures ------------------------------------------------


class ConsistencyError(BaseModel):
    """Inconsistency detected across documents (e.g. mismatched figures)."""

    model_config = ConfigDict(extra="forbid")

    error_id: UUID = Field(default_factory=uuid4)
    description: str
    severity: RiskSeverity
    source_documents: list[UUID] = Field(default_factory=list)
    evidence: str | None = None


class BenchmarkRisk(BaseModel):
    """Risk identified versus comparable benchmark studies."""

    model_config = ConfigDict(extra="forbid")

    risk_id: UUID = Field(default_factory=uuid4)
    metric: str = Field(..., description="E.g. operating margin, markup, royalty rate.")
    observed_value: float
    benchmark_range: tuple[float, float]
    severity: RiskSeverity
    rationale: str


class MissingElement(BaseModel):
    """Mandatory element absent from the documentation set."""

    model_config = ConfigDict(extra="forbid")

    element_id: UUID = Field(default_factory=uuid4)
    name: str
    required_by: str = Field(..., description="Regulation or guideline reference.")
    severity: RiskSeverity


class AuditReport(BaseModel):
    """Final structured audit output returned by GET /audits/results/{id}."""

    model_config = ConfigDict(extra="forbid")

    audit_task_id: UUID
    session_id: UUID
    generated_at: datetime
    consistency_errors: list[ConsistencyError]
    benchmark_risks: list[BenchmarkRisk]
    missing_elements: list[MissingElement]
    overall_risk: RiskSeverity
    summary: str
