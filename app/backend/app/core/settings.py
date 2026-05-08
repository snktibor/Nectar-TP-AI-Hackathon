"""Process-wide configuration.

Single source of truth for environment-driven knobs. Every service that needs a
secret, a model id, or a budget reads it from `get_settings()` — never from
`os.environ` directly.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


_BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Strongly-typed runtime settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="REDLINE_",
        extra="ignore",
        case_sensitive=False,
    )

    # ---- Secrets ----------------------------------------------------------
    anthropic_api_key: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("REDLINE_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY"),
        description=(
            "Anthropic API key. Read once at startup; never logged. Optional at "
            "load time so imports succeed in dev/CI environments without the key; "
            "LlmClient.create() raises a clear error if it is missing at call time."
        ),
    )

    # ---- LLM tier ---------------------------------------------------------
    model_doc_agent: str = Field(
        default="claude-sonnet-4-6",
        description="Claude model used by per-document-type specialist agents.",
    )
    model_aggregator: str = Field(
        default="claude-opus-4-7",
        description="Claude model reserved for the future risk aggregator.",
    )

    # ---- Runtime budgets --------------------------------------------------
    agent_timeout_s: float = Field(default=90.0, ge=1.0, le=600.0)
    max_tool_iterations: int = Field(default=12, ge=1, le=50)
    llm_max_retries: int = Field(default=3, ge=0, le=10)
    llm_max_tokens: int = Field(default=4096, ge=256, le=64000)

    # ---- Feature flags ----------------------------------------------------
    use_real_agents: bool = Field(
        default=True,
        description="When False, /audits/* falls back to the legacy mock pipeline.",
    )

    # ---- Paths (read-only references; RAG layer is owned elsewhere) -------
    chroma_path: Path = Field(default=_BACKEND_ROOT / "data" / "chromadb")

    # ---- Logging redaction ------------------------------------------------
    log_redact_keys: tuple[str, ...] = Field(
        default=("text", "quote", "document", "content"),
        description="Field names whose values are redacted in structured log records.",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a process-wide singleton. Cached so env is read exactly once."""
    return Settings()  # type: ignore[call-arg]
