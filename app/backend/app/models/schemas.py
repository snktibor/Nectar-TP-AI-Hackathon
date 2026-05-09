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
    CROSS_DOCUMENT = "cross_document"


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

    Highlighting contract: `char_start` / `char_end` are character offsets into
    the parsed document text (computed at ingest time and stored in ChromaDB
    metadata). The UI uses them to draw the highlight/circle on the source
    viewer when the user clicks a finding. `source_kind` lets the UI route the
    deep-link to the correct viewer — uploaded documents open in the document
    viewer, legal corpus chunks open in the legal viewer.
    """

    model_config = ConfigDict(extra="forbid")

    filename: str = Field(..., min_length=1)
    page: int = Field(..., ge=0)
    chunk_index: int = Field(..., ge=0)
    quote: str | None = Field(default=None, max_length=500)
    char_start: int | None = Field(
        default=None,
        ge=0,
        description=(
            "Character offset of the chunk start in the parsed document text. "
            "The UI uses this with char_end to highlight the exact span. "
            "Optional because legacy / non-indexed sources may not expose it."
        ),
    )
    char_end: int | None = Field(
        default=None,
        ge=0,
        description="Character offset of the chunk end (exclusive).",
    )
    source_kind: Literal["document", "legal"] = Field(
        default="document",
        description=(
            "Where this chunk lives. 'document' → uploaded TP package file "
            "(opens in the document viewer). 'legal' → legal_knowledge "
            "collection (NGM 32/2017, OECD TPG, HU Act LXXXI; opens in the "
            "legal viewer). Drives the click-through routing."
        ),
    )


class FindingAttribution(BaseModel):
    """Per-finding provenance: which agent emitted it, with what confidence,
    on what basis, and whether the agent itself flags the finding for human
    review.

    Designed to satisfy the project's traceability requirements:
    every finding can be reconstructed from `evidence_chunks`, the agent's
    `reasoning`, the cited `legal_references`, and the operator can use
    `requires_human_review` and `uncertainty_notes` to decide whether to
    accept the finding as-is or escalate it.
    """

    model_config = ConfigDict(extra="forbid")

    agent_id: str = Field(..., min_length=1)
    doc_type_scope: DocumentType
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description=(
            "Calibrated confidence in [0,1]. Below 0.6 the agent SHOULD set "
            "requires_human_review=True; below 0.5 the agent SHOULD NOT record "
            "the finding at all and keep searching for evidence."
        ),
    )
    evidence_chunks: list[EvidenceChunk] = Field(..., min_length=1)
    reasoning: str | None = Field(
        default=None,
        max_length=2000,
        description=(
            "Plain-language reasoning chain — how the agent moved from the "
            "cited evidence to the recorded finding. Optional for backward "
            "compatibility, but strongly recommended; the UI surfaces this "
            "in the explainability panel so the human reviewer can audit "
            "the inference."
        ),
    )
    uncertainty_notes: str | None = Field(
        default=None,
        max_length=1000,
        description=(
            "Explicit caveats: ambiguity in the source text, missing context, "
            "limits of the retrieved evidence. Use this to avoid false "
            "certainty when a confident-looking finding still has known gaps."
        ),
    )
    requires_human_review: bool = Field(
        default=True,
        description=(
            "Agent's recommendation that a human expert validates this "
            "finding before action. Defaults to True — agents lower it to "
            "False only for high-confidence findings (≥0.9) that map "
            "cleanly to a cited legal reference."
        ),
    )
    rule_id: str | None = Field(
        default=None,
        description=(
            "Primary regulation anchor (e.g. 'NGM_32_2017.section_4'). "
            "Use legal_references for additional supporting citations."
        ),
    )
    legal_references: list[str] = Field(
        default_factory=list,
        description=(
            "Additional regulation / guideline citations beyond rule_id "
            "(e.g. ['OECD_TPG_2022.Ch_VI', 'HU_Act_LXXXI_1996.§31_B'])."
        ),
    )
    prompt_version: str | None = None


# --- Final report sub-structures ------------------------------------------------


class ErrorLocation(BaseModel):
    """Precise source location of a finding within the document set.

    Uses ``extra="ignore"`` on purpose: agent-generated payloads frequently
    duplicate fields from evidence_chunks (most often ``page`` and
    ``chunk_index``) inside locations entries.  Treating those as fatal
    rejection costs an entire iteration without changing the substance of
    the finding, so we silently drop unknown keys here.
    """

    model_config = ConfigDict(extra="ignore")

    filename: str = Field(..., description="Name of the file containing the issue.")
    line_numbers: Optional[list[int]] = Field(
        default=None,
        description="Line numbers where the issue occurs; null if it spans the whole document.",
    )


class ConsistencyError(BaseModel):
    """Inconsistency detected across documents (e.g. mismatched figures).

    Uses ``extra="ignore"`` so schema-noise in agent payloads (e.g. extra
    ``page`` or ``chunk_index`` fields the model carries over from evidence
    chunks) does not silently lose otherwise valid findings.
    """

    model_config = ConfigDict(extra="ignore")

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

    model_config = ConfigDict(extra="ignore")

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

    model_config = ConfigDict(extra="ignore")

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
