"""Pydantic V2 schemas: request/response DTOs and the standardized API envelope.

All public contracts live here. The envelope below is the single source of truth
for every response shape produced by the API (success and error alike).
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Generic, Literal, Optional, TypeVar
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
    INVOICE = "invoice"
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


# ---------------------------------------------------------------------------
# Document Ingest
# ---------------------------------------------------------------------------


class ChunkMetadata(BaseModel):
    """Metadata attached to every vector chunk for traceability."""

    model_config = ConfigDict(extra="forbid")

    chunk_id: UUID = Field(default_factory=uuid4)
    file_name: str
    doc_type: str
    chapter_or_page: str
    chunk_index: int = Field(..., ge=0)
    char_start: int = Field(..., ge=0)
    char_end: int = Field(..., ge=0)


class IngestedDocument(BaseModel):
    """Result for a single file processed by the ingest pipeline."""

    model_config = ConfigDict(extra="forbid")

    document_id: UUID = Field(default_factory=uuid4)
    filename: str
    size_bytes: int = Field(..., ge=0)
    detected_type: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    page_count: int = Field(..., ge=0)
    chunk_count: int = Field(..., ge=0)
    status: str = Field(default="success")
    error: str | None = None


class IngestResponse(BaseModel):
    """Returned after the batch ingest pipeline completes."""

    model_config = ConfigDict(extra="forbid")

    session_id: UUID
    total_files: int = Field(..., ge=0)
    processed: int = Field(..., ge=0)
    failed: int = Field(..., ge=0)
    documents: list[IngestedDocument]


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
    agent_progress: dict[str, str] | None = Field(
        default=None,
        description=(
            "Per-agent progress map keyed by agent_id (e.g. 'master_file_agent'). "
            "Values are Literal['pending','running','ok','timeout','error']. "
            "Optional so the legacy mock pipeline can leave it null."
        ),
    )


# --- Finding attribution (Phase 2 deltas) --------------------------------------


class EvidenceChunk(BaseModel):
    """A single retrieved chunk used to support a finding.

    Citation contract: every emitted finding must reference at least one
    chunk that was actually returned by the agent's RAG calls during the run.
    The dispatcher rejects any citation not present in the per-run `seen_chunks`
    set.
    """

    model_config = ConfigDict(extra="forbid")

    filename: str = Field(..., min_length=1)
    page: int = Field(..., ge=0)
    chunk_index: int = Field(..., ge=0)
    quote: str | None = Field(default=None, max_length=500)


class FindingAttribution(BaseModel):
    """Per-finding provenance: which agent emitted it, with what confidence."""

    model_config = ConfigDict(extra="forbid")

    agent_id: str = Field(..., min_length=1)
    doc_type_scope: DocumentType
    confidence: float = Field(..., ge=0.0, le=1.0)
    evidence_chunks: list[EvidenceChunk] = Field(..., min_length=1)
    rule_id: str | None = None
    prompt_version: str | None = None


# --- Final report sub-structures ------------------------------------------------


class ErrorLocation(BaseModel):
    """Precise source location of a finding within the document set."""

    model_config = ConfigDict(extra="forbid")

    filename: str = Field(..., description="Name of the file containing the issue.")
    line_numbers: Optional[list[int]] = Field(
        default=None,
        description="Line numbers where the issue occurs; null if it spans the whole document.",
    )


class ConsistencyError(BaseModel):
    """Inconsistency detected across documents (e.g. mismatched figures)."""

    model_config = ConfigDict(extra="forbid")

    error_id: UUID = Field(default_factory=uuid4)
    description: str
    severity: RiskSeverity
    locations: list[ErrorLocation] = Field(
        default_factory=list,
        description="Source locations involved in the contradiction (one per compared document).",
    )
    evidence: str | None = None
    attribution: FindingAttribution | None = None


class BenchmarkRisk(BaseModel):
    """Risk identified versus comparable benchmark studies."""

    model_config = ConfigDict(extra="forbid")

    risk_id: UUID = Field(default_factory=uuid4)
    metric: str = Field(..., description="E.g. operating margin, markup, royalty rate.")
    observed_value: float
    benchmark_range: tuple[float, float]
    severity: RiskSeverity
    rationale: str
    locations: list[ErrorLocation] = Field(
        default_factory=list,
        description="Contract or invoice files that contain the deviating pricing data.",
    )
    attribution: FindingAttribution | None = None


class MissingElement(BaseModel):
    """Mandatory element absent from the documentation set."""

    model_config = ConfigDict(extra="forbid")

    element_id: UUID = Field(default_factory=uuid4)
    description: str = Field(..., description="Human-readable explanation of what is missing.")
    expected_in: str = Field(..., description="Document where the element should appear (e.g. 'local_file.pdf').")
    required_by: str = Field(..., description="Regulation or guideline reference.")
    severity: RiskSeverity
    attribution: FindingAttribution | None = None


# --- Per-agent run record ------------------------------------------------------


AgentRunStatus = Literal["ok", "timeout", "error"]


class AgentRunResult(BaseModel):
    """Telemetry + findings for a single specialist agent run.

    Aggregated into `AuditReport.agent_runs` so the UI/operator can see which
    agents succeeded, how much they spent, and which ones failed without taking
    the audit down.
    """

    model_config = ConfigDict(extra="forbid")

    agent_id: str
    doc_type_scope: DocumentType
    prompt_version: str
    model: str
    started_at: datetime
    finished_at: datetime
    tool_calls: int = Field(default=0, ge=0)
    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)
    cache_read_tokens: int = Field(default=0, ge=0)
    cache_creation_tokens: int = Field(default=0, ge=0)
    consistency_errors: list[ConsistencyError] = Field(default_factory=list)
    benchmark_risks: list[BenchmarkRisk] = Field(default_factory=list)
    missing_elements: list[MissingElement] = Field(default_factory=list)
    status: AgentRunStatus
    error: ErrorDetail | None = None


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
    agent_runs: list[AgentRunResult] = Field(default_factory=list)
