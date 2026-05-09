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
        default="claude-haiku-4-5-20251001",
        description=(
            "Claude model used by per-document-type specialist agents. "
            "Haiku is the default: ~10× cheaper than Sonnet and has a much higher "
            "TPM rate limit, which matters when 6 agents run sequentially. "
            "Override with REDLINE_MODEL_DOC_AGENT=claude-sonnet-4-6 for higher quality."
        ),
    )
    model_aggregator: str = Field(
        default="claude-sonnet-4-6",
        description="Claude model reserved for the future risk aggregator.",
    )

    # ---- Runtime budgets --------------------------------------------------
    agent_timeout_s: float = Field(default=300.0, ge=1.0, le=600.0)
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
        default=5,
        ge=1,
        le=50,
        description=(
            "Hard cap on tool-use turns per agent. Each turn adds tokens to the "
            "conversation history; 5 gives 2-3 search_context calls + 1-2 "
            "record_finding calls, which is enough for focused PoC findings "
            "without exploding token spend."
        ),
    )
    inter_turn_delay_s: float = Field(
        default=3.0,
        ge=0.0,
        le=30.0,
        description=(
            "Seconds to sleep between consecutive LLM turns within a single agent. "
            "Haiku Tier-1 allows 25 RPM (= 2.4 s/req minimum). A 3 s delay keeps "
            "throughput at ~20 RPM and prevents cascading 429s during the tool-use "
            "loop. Set to 0 to disable when using a higher-tier API key."
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
    llm_max_tokens: int = Field(default=2048, ge=256, le=64000)

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
