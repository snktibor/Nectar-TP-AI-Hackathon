"""Structured logging with redaction of confidential document text.

Redaction runs at LogRecord-creation time via a custom record factory, so it
applies to every handler in the process — including pytest caplog. Any
positional arg dict or `extra` field whose key matches `log_redact_keys` has
its value replaced with `"<redacted:N chars>"`.

Output sinks
------------
- **stdout** — always on, formatted for humans/uvicorn console.
- **file** — `settings.log_file_path` if set. Truncated on each process start
  (controlled by ``log_file_truncate_on_start``) and flushed after every record
  so a Ctrl+C still leaves a complete log on disk.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from pathlib import Path
from typing import Final

from app.core.settings import Settings


def rebind_external_loggers() -> None:
    """Force uvicorn / httpx / FastAPI loggers into the root pipeline.

    Uvicorn ships with ``propagate=False`` plus its own handlers, so HTTP
    request lines and startup events normally bypass our file handler.
    This helper flips ``propagate=True`` and strips the dedicated handlers
    so a single root handler set (console + file) captures every record.

    Idempotent — safe to call from FastAPI's startup event AFTER uvicorn
    has applied its own log config (it would otherwise undo configure_logging's
    one-shot setup).
    """
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi", "httpx"):
        ext = logging.getLogger(name)
        ext.propagate = True
        for h in list(ext.handlers):
            ext.removeHandler(h)


class _AutoFlushFileHandler(logging.FileHandler):
    """FileHandler that flushes the underlying stream after every record.

    The default FileHandler buffers writes; if the process is killed (Ctrl+C,
    SIGTERM, segfault) the tail of the log can be lost.  Calling ``flush``
    after each emit costs almost nothing for our log volume but guarantees
    the log on disk is always current.
    """

    def emit(self, record: logging.LogRecord) -> None:  # noqa: D401
        super().emit(record)
        # ``self.stream`` may be None if the handler is in a half-closed state;
        # FileHandler.emit normally guards this, but flush() needs it too.
        if self.stream is not None:
            try:
                self.stream.flush()
            except (ValueError, OSError):
                # Closed stream during interpreter shutdown — nothing to do.
                pass

_REDACTED_PLACEHOLDER: Final[str] = "<redacted>"
_FACTORY_INSTALLED_FLAG: Final[str] = "_nectar_redact_installed"


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


_MAKERECORD_PATCH_FLAG: Final[str] = "_nectar_makeRecord_patched"


def configure_logging(settings: Settings, level: int | None = None) -> None:
    """Install the redaction shim + console + file handlers.

    `extra` keys are populated by `Logger.makeRecord` after the record factory
    runs, so a factory wrapper alone would not redact them. Patching
    `makeRecord` covers the `extra=` and dict-shaped `args=` paths and applies
    process-wide regardless of which handler captures the record (StreamHandler,
    pytest caplog, etc.).

    Handlers attached to the root logger:
      * `StreamHandler(stdout)` — human-readable console output.
      * `_AutoFlushFileHandler` — written to ``settings.log_file_path`` if set;
        truncated on start; flushed after every record (Ctrl+C-safe).
    """
    root = logging.getLogger()

    # Resolve effective level: explicit arg > settings.log_level > INFO.
    if level is None:
        level_name = (settings.log_level or "INFO").upper()
        level = getattr(logging, level_name, logging.INFO)
    root.setLevel(level)

    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s :: %(message)s"
    )

    # Idempotency: re-installing on uvicorn --reload should not stack handlers.
    # Tag our handlers so we can recognise & remove them across reloads.
    _OWNER_TAG = "_nectar_owned"
    for h in list(root.handlers):
        if getattr(h, _OWNER_TAG, False):
            try:
                h.close()
            finally:
                root.removeHandler(h)

    # Console handler — always on.
    console = logging.StreamHandler()
    console.setFormatter(formatter)
    setattr(console, _OWNER_TAG, True)
    root.addHandler(console)

    # File handler — opt-in via settings.
    log_path = settings.log_file_path
    if log_path is not None:
        path = Path(log_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        mode = "w" if settings.log_file_truncate_on_start else "a"
        file_handler = _AutoFlushFileHandler(
            filename=str(path),
            mode=mode,
            encoding="utf-8",
            delay=False,
        )
        file_handler.setFormatter(formatter)
        setattr(file_handler, _OWNER_TAG, True)
        root.addHandler(file_handler)
        # Bootstrap message — confirms the file is being written and gives
        # an unambiguous "new run starts here" anchor for grep.
        logging.getLogger("nectar").info(
            "logging initialised: level=%s file=%s mode=%s",
            logging.getLevelName(level),
            path,
            mode,
        )

    rebind_external_loggers()

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
