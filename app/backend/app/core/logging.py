"""Structured logging with redaction of confidential document text.

Redaction runs at LogRecord-creation time via a custom record factory, so it
applies to every handler in the process — including pytest caplog. Any
positional arg dict or `extra` field whose key matches `log_redact_keys` has
its value replaced with `"<redacted:N chars>"`.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Final

from app.core.settings import Settings

_REDACTED_PLACEHOLDER: Final[str] = "<redacted>"
_FACTORY_INSTALLED_FLAG: Final[str] = "_redline_redact_installed"


def _mask(value: object) -> str:
    if value is None:
        return _REDACTED_PLACEHOLDER
    text = value if isinstance(value, str) else str(value)
    return f"<redacted:{len(text)} chars>"


def _scrub_args(args: object, keys: frozenset[str]) -> object:
    if isinstance(args, Mapping):
        return {
            k: (_mask(v) if str(k).lower() in keys else v)
            for k, v in args.items()
        }
    if isinstance(args, tuple):
        return tuple(_scrub_args(item, keys) for item in args)
    return args


# Standard LogRecord attributes — never redact these even if they happen to
# match a key (e.g. "message" is the formatted log line itself).
_LOGRECORD_BUILTIN_KEYS: Final[frozenset[str]] = frozenset(
    {
        "name",
        "msg",
        "args",
        "levelname",
        "levelno",
        "pathname",
        "filename",
        "module",
        "exc_info",
        "exc_text",
        "stack_info",
        "lineno",
        "funcName",
        "created",
        "msecs",
        "relativeCreated",
        "thread",
        "threadName",
        "processName",
        "process",
        "message",
        "asctime",
    }
)


class RedactingFilter(logging.Filter):
    """Standalone Filter form — kept for direct use against record dicts."""

    def __init__(self, redact_keys: tuple[str, ...]) -> None:
        super().__init__()
        self._keys = frozenset(k.lower() for k in redact_keys)

    def filter(self, record: logging.LogRecord) -> bool:
        record.args = _scrub_args(record.args, self._keys)
        for key in list(record.__dict__.keys()):
            if key in _LOGRECORD_BUILTIN_KEYS:
                continue
            if key.lower() in self._keys:
                record.__dict__[key] = _mask(record.__dict__[key])
        return True


_MAKERECORD_PATCH_FLAG: Final[str] = "_redline_makeRecord_patched"


def configure_logging(settings: Settings, level: int = logging.INFO) -> None:
    """Install the redaction shim on `Logger.makeRecord` + a default handler.

    `extra` keys are populated by `Logger.makeRecord` after the record factory
    runs, so a factory wrapper alone would not redact them. Patching
    `makeRecord` covers the `extra=` and dict-shaped `args=` paths and applies
    process-wide regardless of which handler captures the record (StreamHandler,
    pytest caplog, etc.).
    """
    root = logging.getLogger()
    root.setLevel(level)

    if not root.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(name)s :: %(message)s")
        )
        root.addHandler(handler)

    keys = frozenset(k.lower() for k in settings.log_redact_keys)

    if getattr(logging.Logger, _MAKERECORD_PATCH_FLAG, False):
        return

    original_make_record = logging.Logger.makeRecord

    def _patched_make_record(  # type: ignore[no-untyped-def]
        self,
        name,
        level,
        fn,
        lno,
        msg,
        args,
        exc_info,
        func=None,
        extra=None,
        sinfo=None,
    ):
        scrubbed_args = _scrub_args(args, keys)
        scrubbed_extra = (
            {k: (_mask(v) if k.lower() in keys else v) for k, v in extra.items()}
            if extra
            else extra
        )
        return original_make_record(
            self, name, level, fn, lno, msg, scrubbed_args, exc_info, func, scrubbed_extra, sinfo
        )

    logging.Logger.makeRecord = _patched_make_record  # type: ignore[method-assign]
    setattr(logging.Logger, _MAKERECORD_PATCH_FLAG, True)
