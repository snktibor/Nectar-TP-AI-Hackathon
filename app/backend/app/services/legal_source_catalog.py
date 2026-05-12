"""Official legal source catalog used by legal RAG and source endpoints."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.schemas import (
    LegalSource,
    LegalSourceAlias,
    LegalSourceCatalogResponse,
    LegalSourceSection,
)

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
RULESETS_DIR = _BACKEND_ROOT / "rulesets"
OFFICIAL_SOURCE_CATALOG_PATH = RULESETS_DIR / "official_sources.json"

LegalSourceType = Literal[
    "law",
    "decree",
    "guideline",
    "tax_authority_guidance",
    "other",
]
UpdateMode = Literal["manual_cache", "official_download", "disabled"]
AccessStatus = Literal["cached", "needs_manual_fetch_validation", "unavailable"]
AliasKind = Literal["canonical_reference", "legacy_reference", "natural_language", "filename"]


class LegalSourceAliasConfig(BaseModel):
    """Alias entry in the catalog JSON."""

    model_config = ConfigDict(extra="forbid")

    value: str = Field(..., min_length=1)
    kind: AliasKind


class LegalSourceSectionConfig(BaseModel):
    """Named legal section anchor used by the UI and agents."""

    model_config = ConfigDict(extra="forbid")

    section_id: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    page_hint: int | None = Field(default=None, ge=0)
    citation_label: str = Field(..., min_length=1)


class LegalSourceConfig(BaseModel):
    """Internal validated representation of one official source."""

    model_config = ConfigDict(extra="forbid")

    source_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    source_type: LegalSourceType
    jurisdiction: str = Field(..., min_length=1)
    language: str = Field(..., min_length=2, max_length=8)
    official_url: str | None = None
    download_url: str | None = None
    local_path: str | None = None
    index_enabled: bool = True
    update_mode: UpdateMode = "manual_cache"
    access_status: AccessStatus = "cached"
    source_version: str | None = None
    publication_date: str | None = None
    effective_from: str | None = None
    effective_to: str | None = None
    citation_label: str = Field(..., min_length=1)
    agent_scopes: list[str] = Field(default_factory=list)
    priority_topics: list[str] = Field(default_factory=list)
    sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    size_bytes: int | None = Field(default=None, ge=0)
    aliases: list[LegalSourceAliasConfig] = Field(default_factory=list)
    sections: list[LegalSourceSectionConfig] = Field(default_factory=list)

    @field_validator("source_id")
    @classmethod
    def _normalize_source_id(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("source_id must not be blank")
        return normalized

    @field_validator("local_path")
    @classmethod
    def _validate_relative_local_path(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().replace("\\", "/")
        candidate = Path(normalized)
        if candidate.is_absolute() or ".." in candidate.parts:
            raise ValueError("local_path must stay inside the rulesets directory")
        if not normalized.lower().endswith(".pdf"):
            raise ValueError("local_path must point to a PDF file")
        return normalized

    @field_validator("sha256")
    @classmethod
    def _lowercase_sha256(cls, value: str | None) -> str | None:
        return value.lower() if value is not None else None


class LegalSourceCatalog(BaseModel):
    """Validated source catalog with safe path helpers."""

    model_config = ConfigDict(extra="forbid")

    catalog_version: str = Field(..., min_length=1)
    description: str | None = None
    sources: list[LegalSourceConfig] = Field(..., min_length=1)

    @model_validator(mode="after")
    def _validate_unique_ids(self) -> "LegalSourceCatalog":
        source_ids = [source.source_id for source in self.sources]
        if len(source_ids) != len(set(source_ids)):
            raise ValueError("official source catalog contains duplicate source_id values")
        return self

    def iter_indexable_sources(self) -> list[LegalSourceConfig]:
        """Return sources that should be added to the legal_knowledge collection."""
        return [source for source in self.sources if source.index_enabled]

    def get_source(self, source_id: str) -> LegalSourceConfig | None:
        """Find one source by its canonical id."""
        normalized = source_id.strip()
        return next((source for source in self.sources if source.source_id == normalized), None)

    def resolve_local_path(self, source: LegalSourceConfig) -> Path:
        """Resolve and validate a source PDF path under rulesets/."""
        if source.local_path is None:
            raise ValueError(f"source {source.source_id} has no local_path")

        rulesets_root = RULESETS_DIR.resolve()
        candidate = (RULESETS_DIR / source.local_path).resolve()
        try:
            candidate.relative_to(rulesets_root)
        except ValueError as exc:
            raise ValueError(
                f"source {source.source_id} resolves outside rulesets directory"
            ) from exc
        return candidate

    def to_response(self, *, include_disabled: bool = True) -> LegalSourceCatalogResponse:
        """Convert the internal catalog to its public API DTO."""
        sources = self.sources if include_disabled else self.iter_indexable_sources()
        return LegalSourceCatalogResponse(
            catalog_version=self.catalog_version,
            sources=[_to_public_source(source) for source in sources],
            total=len(sources),
        )


class LegalSourceFileStatus(BaseModel):
    """Validation status for one source's local cached PDF."""

    model_config = ConfigDict(extra="forbid")

    source_id: str
    local_filename: str | None
    index_enabled: bool
    exists: bool
    size_bytes: int | None = Field(default=None, ge=0)
    expected_size_bytes: int | None = Field(default=None, ge=0)
    sha256: str | None = None
    expected_sha256: str | None = None
    ok: bool
    issues: list[str] = Field(default_factory=list)


def load_legal_source_catalog(
    catalog_path: Path = OFFICIAL_SOURCE_CATALOG_PATH,
) -> LegalSourceCatalog:
    """Load and validate the official legal source catalog JSON."""
    payload = json.loads(catalog_path.read_text(encoding="utf-8"))
    return LegalSourceCatalog.model_validate(payload)


def validate_source_files(
    catalog: LegalSourceCatalog | None = None,
    *,
    compute_hash: bool = True,
) -> list[LegalSourceFileStatus]:
    """Validate local source files against the catalog's size and SHA-256 pins."""
    source_catalog = catalog or load_legal_source_catalog()
    statuses: list[LegalSourceFileStatus] = []

    for source in source_catalog.sources:
        statuses.append(_validate_one_source(source_catalog, source, compute_hash=compute_hash))

    return statuses


def source_to_chroma_metadata(
    source: LegalSourceConfig,
    *,
    catalog_version: str,
) -> dict[str, str | int | bool]:
    """Return primitive metadata safe for ChromaDB storage."""
    source_url = source.official_url or source.download_url
    metadata: dict[str, str | int | bool | None] = {
        "source_id": source.source_id,
        "source_title": source.title,
        "source_type": source.source_type,
        "source_url": source_url,
        "official_url": source.official_url,
        "download_url": source.download_url,
        "source_version": source.source_version,
        "jurisdiction": source.jurisdiction,
        "language": source.language,
        "citation_label": source.citation_label,
        "publication_date": source.publication_date,
        "effective_from": source.effective_from,
        "effective_to": source.effective_to,
        "sha256": source.sha256,
        "size_bytes": source.size_bytes,
        "agent_scopes": ",".join(source.agent_scopes),
        "priority_topics": ",".join(source.priority_topics),
        "catalog_version": catalog_version,
        "source_kind": "legal",
    }
    return {key: value for key, value in metadata.items() if value is not None}


def source_section_for_page(
    source: LegalSourceConfig,
    page_number: int,
) -> LegalSourceSectionConfig | None:
    """Return the best catalog section anchor for a 1-based PDF page."""
    eligible_sections = [
        section
        for section in source.sections
        if section.page_hint is not None and section.page_hint <= page_number
    ]
    if not eligible_sections:
        return None
    return max(eligible_sections, key=lambda section: section.page_hint or 0)


def compute_sha256(path: Path) -> str:
    """Compute a file's SHA-256 digest without loading it all into memory."""
    digest = hashlib.sha256()
    with path.open("rb") as file_handle:
        for block in iter(lambda: file_handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _validate_one_source(
    catalog: LegalSourceCatalog,
    source: LegalSourceConfig,
    *,
    compute_hash: bool,
) -> LegalSourceFileStatus:
    local_filename = Path(source.local_path).name if source.local_path else None
    issues: list[str] = []

    if not source.index_enabled:
        return LegalSourceFileStatus(
            source_id=source.source_id,
            local_filename=local_filename,
            index_enabled=source.index_enabled,
            exists=False,
            expected_size_bytes=source.size_bytes,
            expected_sha256=source.sha256,
            ok=True,
            issues=[],
        )

    if source.local_path is None:
        return LegalSourceFileStatus(
            source_id=source.source_id,
            local_filename=None,
            index_enabled=source.index_enabled,
            exists=False,
            expected_size_bytes=source.size_bytes,
            expected_sha256=source.sha256,
            ok=False,
            issues=["missing local_path for index-enabled source"],
        )

    path = catalog.resolve_local_path(source)
    if not path.is_file():
        return LegalSourceFileStatus(
            source_id=source.source_id,
            local_filename=local_filename,
            index_enabled=source.index_enabled,
            exists=False,
            expected_size_bytes=source.size_bytes,
            expected_sha256=source.sha256,
            ok=False,
            issues=["local PDF is missing"],
        )

    size_bytes = path.stat().st_size
    if source.size_bytes is not None and source.size_bytes != size_bytes:
        issues.append("size mismatch")

    actual_sha256 = compute_sha256(path) if compute_hash else None
    if compute_hash and source.sha256 is not None and source.sha256 != actual_sha256:
        issues.append("sha256 mismatch")

    return LegalSourceFileStatus(
        source_id=source.source_id,
        local_filename=local_filename,
        index_enabled=source.index_enabled,
        exists=True,
        size_bytes=size_bytes,
        expected_size_bytes=source.size_bytes,
        sha256=actual_sha256,
        expected_sha256=source.sha256,
        ok=not issues,
        issues=issues,
    )


def _to_public_source(source: LegalSourceConfig) -> LegalSource:
    return LegalSource(
        source_id=source.source_id,
        title=source.title,
        source_type=source.source_type,
        jurisdiction=source.jurisdiction,
        language=source.language,
        official_url=source.official_url,
        download_url=source.download_url,
        local_filename=Path(source.local_path).name if source.local_path else None,
        index_enabled=source.index_enabled,
        update_mode=source.update_mode,
        access_status=source.access_status,
        source_version=source.source_version,
        publication_date=source.publication_date,
        effective_from=source.effective_from,
        effective_to=source.effective_to,
        citation_label=source.citation_label,
        agent_scopes=source.agent_scopes,
        priority_topics=source.priority_topics,
        sha256=source.sha256,
        size_bytes=source.size_bytes,
        aliases=[
            LegalSourceAlias(value=alias.value, kind=alias.kind)
            for alias in source.aliases
        ],
        sections=[
            LegalSourceSection(
                section_id=section.section_id,
                label=section.label,
                title=section.title,
                page_hint=section.page_hint,
                citation_label=section.citation_label,
            )
            for section in source.sections
        ],
    )