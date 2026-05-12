"""Settings + redaction filter unit tests."""

from __future__ import annotations

import logging

import pytest

from app.core.logging import RedactingFilter, configure_logging
from app.core.settings import Settings, get_settings


def test_settings_loads_from_env(monkeypatch) -> None:
    monkeypatch.setenv("NECTAR_ANTHROPIC_API_KEY", "key-xyz")
    monkeypatch.setenv("NECTAR_AGENT_TIMEOUT_S", "12.5")
    monkeypatch.setenv("NECTAR_USE_REAL_AGENTS", "false")

    get_settings.cache_clear()
    s = get_settings()

    assert s.anthropic_api_key is not None
    assert s.anthropic_api_key.get_secret_value() == "key-xyz"
    assert s.agent_timeout_s == pytest.approx(12.5)
    assert s.use_real_agents is False
    assert s.model_doc_agent.startswith("claude-")


def test_settings_accepts_anthropic_api_key_alias(monkeypatch) -> None:
    monkeypatch.delenv("NECTAR_ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "alias-key")

    get_settings.cache_clear()
    s = get_settings()

    assert s.anthropic_api_key is not None
    assert s.anthropic_api_key.get_secret_value() == "alias-key"


def test_settings_optional_key_does_not_crash(monkeypatch) -> None:
    """Missing key must not crash imports — only call-time errors are acceptable.

    Construct Settings directly with `_env_file=None` so the developer's local
    `.env` (which legitimately contains an API key) cannot leak into this test.
    """
    monkeypatch.delenv("NECTAR_ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    s = Settings(_env_file=None)  # type: ignore[call-arg]
    assert s.anthropic_api_key is None


def test_settings_treats_blank_anthropic_key_as_missing(monkeypatch) -> None:
    monkeypatch.setenv("NECTAR_ANTHROPIC_API_KEY", "   ")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    get_settings.cache_clear()
    s = get_settings()

    assert s.anthropic_api_key is None
    assert s.has_anthropic_credentials is False


def test_settings_defaults_to_mock_agents_without_env(monkeypatch) -> None:
    monkeypatch.delenv("NECTAR_USE_REAL_AGENTS", raising=False)
    monkeypatch.delenv("NECTAR_ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    s = Settings(_env_file=None)  # type: ignore[call-arg]

    assert s.use_real_agents is False
    assert s.has_anthropic_credentials is False
    assert s.chroma_anonymized_telemetry is False


def test_settings_default_output_paths_use_logs_folder() -> None:
    s = Settings(_env_file=None)  # type: ignore[call-arg]

    assert s.log_file_path is not None
    assert s.audit_report_dir is not None
    assert s.log_file_path.parts[-2:] == ("logs", "logs.txt")
    assert s.audit_report_dir.parts[-2:] == ("logs", "audit_reports")


def test_redacting_filter_masks_known_keys(caplog) -> None:
    settings = Settings(anthropic_api_key=None)  # type: ignore[arg-type]
    configure_logging(settings)

    logger = logging.getLogger("nectar.test_redact")
    with caplog.at_level(logging.INFO, logger="nectar.test_redact"):
        logger.info("evt", extra={"text": "TOP-SECRET-DOC", "agent_id": "master_file_agent"})

    record = caplog.records[-1]
    masked = getattr(record, "text", None)
    assert masked == "<redacted:14 chars>", masked
    assert getattr(record, "agent_id", None) == "master_file_agent"  # not redacted


def test_redacting_filter_handles_dict_args() -> None:
    f = RedactingFilter(("text", "quote"))
    rec = logging.LogRecord(
        name="x",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="m",
        args={"text": "hello", "agent_id": "a"},
        exc_info=None,
    )
    f.filter(rec)
    assert isinstance(rec.args, dict)
    assert rec.args["text"] == "<redacted:5 chars>"
    assert rec.args["agent_id"] == "a"
