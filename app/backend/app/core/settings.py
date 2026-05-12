"""Process-wide configuration.

Single source of truth for environment-driven knobs. Every service that needs a
secret, a model id, or a budget reads it from `get_settings()` — never from
`os.environ` directly.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_OUTPUT_ROOT = _BACKEND_ROOT.parent.parent / "logs"


class Settings(BaseSettings):
    """Strongly-typed runtime settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="NECTAR_",
        extra="ignore",
        case_sensitive=False,
        protected_namespaces=("settings_",),
    )

    # ---- Secrets ----------------------------------------------------------
    anthropic_api_key: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("NECTAR_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY"),
        description=(
            "Anthropic API key. Read once at startup; never logged. Optional at "
            "load time so imports succeed in dev/CI environments without the key; "
            "LlmClient.create() raises a clear error if it is missing at call time."
        ),
    )

    @field_validator("anthropic_api_key", mode="before")
    @classmethod
    def _normalize_optional_secret(
        cls, value: SecretStr | str | None
    ) -> SecretStr | str | None:
        if value is None:
            return None
        if isinstance(value, SecretStr):
            return value if value.get_secret_value().strip() else None
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        return value

    @property
    def has_anthropic_credentials(self) -> bool:
        """Return True only when a non-empty Anthropic credential is configured."""
        return bool(
            self.anthropic_api_key
            and self.anthropic_api_key.get_secret_value().strip()
        )

    # ---- LLM tier ---------------------------------------------------------
    model_doc_agent: str = Field(
        default="claude-haiku-4-5-20251001",
        description=(
            "Claude model used by per-document-type specialist agents. "
            "Haiku is the default: ~10× cheaper than Sonnet and has a much higher "
            "TPM rate limit, which matters when 6 agents run sequentially. "
            "Override with NECTAR_MODEL_DOC_AGENT=claude-sonnet-4-6 for higher quality."
        ),
    )
    model_aggregator: str = Field(
        default="claude-sonnet-4-6",
        description="Claude model reserved for the future risk aggregator.",
    )

    # ---- Runtime budgets --------------------------------------------------
    agent_timeout_s: float = Field(default=600.0, ge=1.0, le=1200.0)
    agent_max_concurrency: int = Field(
        default=1,
        ge=1,
        le=6,
        description=(
            "Maximum number of specialist agents allowed to call the LLM API "
            "simultaneously. Default 1 (serialized) keeps token-per-minute "
            "consumption predictable on low-tier API keys. Increase only when "
            "the account has sufficient TPM headroom."
        ),
    )
    max_tool_iterations: int = Field(
        default=10,
        ge=1,
        le=50,
        description=(
            "Hard cap on tool-use turns per agent. Headroom for: (a) 3-4 "
            "search_context calls to build evidence (cross-doc agent fans out "
            "and may need extra), (b) 2-4 record_finding calls (one per detected "
            "issue), (c) optional verify_tax_number for invoice/contract agents, "
            "(d) a final end_turn. 10 leaves slack even when the model retries "
            "after a hallucinated-citation rejection."
        ),
    )
    min_call_interval_s: float = Field(
        default=10.0,
        ge=0.0,
        le=60.0,
        description=(
            "Minimum seconds between consecutive LLM API calls — applied GLOBALLY "
            "across all agents in the same process. Haiku Tier-1 allows 5 000 OTPM "
            "(output tokens / minute); with ~750 output tokens per turn, 10 s "
            "spacing keeps us at ~4 500 OTPM, comfortably under the limit and "
            "preventing cascading 429s. Set to 0 on tier-2+ keys with higher OTPM "
            "headroom; raise to 12-15 s if 429s persist."
        ),
    )
    rag_n_results: int = Field(
        default=3,
        ge=1,
        le=20,
        description=(
            "Default number of chunks returned per search_context query. "
            "Lower = less tokens per turn; the agent can always issue more queries."
        ),
    )
    llm_max_retries: int = Field(default=3, ge=0, le=10)
    llm_max_tokens: int = Field(
        default=2048,
        ge=256,
        le=64000,
        description=(
            "Per-call output cap. Must fit a record_finding tool call: reasoning "
            "(≤2000 chars ≈ 500 t), uncertainty_notes (≤1000 chars ≈ 250 t), "
            "evidence_chunks (~150 t each), payload (~300 t), plus intra-turn "
            "deliberation. 1024 is too tight — record_finding gets truncated "
            "mid-call (stop_reason=max_tokens), the partial tool_use is discarded, "
            "and the finding is silently lost. 2048 covers typical record_finding "
            "calls while keeping average output-TPM consumption near 4 500/min."
        ),
    )

    # ---- Feature flags ----------------------------------------------------
    use_real_agents: bool = Field(
        default=False,
        description=(
            "When True, /audits/* uses real LLM agents and requires a non-empty "
            "Anthropic API key. Default False keeps local PoC runs deterministic "
            "and token-free via the mock pipeline."
        ),
    )
    mock_report_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "NECTAR_MOCK_REPORT_ENABLED", "MOCK_REPORT_ENABLED"
        ),
        description=(
            "When True, the report download endpoint serves the prebuilt "
            "datasets/mock_document.pdf with a freshly timestamped filename."
        ),
    )

    # ---- API hardening ----------------------------------------------------
    cors_allowed_origins: tuple[str, ...] = Field(
        default=(
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ),
        description=(
            "Explicit CORS allowlist. Keep this tight in production and avoid '*'"
            " to prevent cross-origin abuse."
        ),
    )
    cors_allow_origin_regex: str | None = Field(
        default=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        description=(
            "Regex-based CORS allowlist for local development ports. "
            "Set to empty to disable regex matching and rely only on explicit origins."
        ),
    )

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def _normalize_cors_allowed_origins(
        cls, value: tuple[str, ...] | list[str] | str
    ) -> tuple[str, ...]:
        if isinstance(value, tuple):
            return value
        if isinstance(value, list):
            return tuple(value)
        if isinstance(value, str):
            parts = [part.strip() for part in value.split(",") if part.strip()]
            return tuple(parts)
        raise TypeError("cors_allowed_origins must be a tuple, list, or comma-separated string")

    @field_validator("cors_allow_origin_regex", mode="before")
    @classmethod
    def _normalize_cors_allow_origin_regex(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        raise TypeError("cors_allow_origin_regex must be a string or None")

    # ---- Paths (read-only references; RAG layer is owned elsewhere) -------
    chroma_path: Path = Field(default=_BACKEND_ROOT / "data" / "chromadb")
    chroma_anonymized_telemetry: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "NECTAR_CHROMA_ANONYMIZED_TELEMETRY",
            "ANONYMIZED_TELEMETRY",
        ),
        description=(
            "Controls ChromaDB anonymized telemetry. Default False avoids noisy "
            "PostHog telemetry failures and is safer for confidential tax material."
        ),
    )

    # ---- Logging redaction ------------------------------------------------
    log_redact_keys: tuple[str, ...] = Field(
        default=("text", "quote", "document", "content"),
        description="Field names whose values are redacted in structured log records.",
    )

    # ---- File logging ----------------------------------------------------
    log_file_path: Path | None = Field(
        default=_OUTPUT_ROOT / "logs.txt",
        description=(
            "Absolute path of the structured log file. The file is truncated "
            "on every process start and each record is flushed immediately, "
            "so a Ctrl+C still leaves a complete log on disk. Set to None to "
            "disable file logging entirely (stdout still works)."
        ),
    )
    log_file_truncate_on_start: bool = Field(
        default=True,
        description=(
            "Open the log file with mode='w' on startup so each run begins "
            "with an empty file. Set to False to append across runs."
        ),
    )
    log_level: str = Field(
        default="INFO",
        description=(
            "Root log level. DEBUG adds Anthropic SDK request/response details "
            "and very verbose internal traces."
        ),
    )

    # ---- Audit report persistence ----------------------------------------
    audit_report_dir: Path | None = Field(
        default=_OUTPUT_ROOT / "audit_reports",
        description=(
            "Directory where every completed (or failed) audit report is "
            "auto-dumped as a timestamped JSON file. Filename pattern: "
            "audit_<YYYY-MM-DD_HH-MM-SS>_<task_id_first8>.json. "
            "Set to None to disable."
        ),
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a process-wide singleton. Cached so env is read exactly once."""
    settings = Settings()  # type: ignore[call-arg]
    if settings.anthropic_api_key is not None:
        return settings

    fallback_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not fallback_key:
        return settings

    return settings.model_copy(
        update={"anthropic_api_key": SecretStr(fallback_key)},
    )
