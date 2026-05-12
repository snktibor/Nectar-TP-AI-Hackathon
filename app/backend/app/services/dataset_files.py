"""Dataset-backed document byte lookup helpers."""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def load_from_datasets(datasets_root: Path, filename: str) -> bytes | None:
    """Return bytes for a dataset file matched by basename, ignoring filename case."""
    if not datasets_root.is_dir():
        return None

    needle = Path(filename).name
    for subdir in datasets_root.iterdir():
        if not subdir.is_dir():
            continue

        exact_payload = read_dataset_file(datasets_root, filename, subdir / needle)
        if exact_payload is not None:
            return exact_payload

        fallback_candidate = find_case_insensitive_dataset_file(subdir, needle)
        if fallback_candidate is None:
            continue

        fallback_payload = read_dataset_file(datasets_root, filename, fallback_candidate)
        if fallback_payload is not None:
            return fallback_payload

    return None


def find_case_insensitive_dataset_file(subdir: Path, filename: str) -> Path | None:
    needle_normalized = normalize_dataset_filename(filename)
    for candidate in subdir.iterdir():
        if candidate.is_file() and normalize_dataset_filename(candidate.name) == needle_normalized:
            return candidate
    return None


def normalize_dataset_filename(filename: str) -> str:
    return "".join(char for char in filename.lower() if char.isalnum())


def read_dataset_file(datasets_root: Path, requested_filename: str, candidate: Path) -> bytes | None:
    if not candidate.is_file():
        return None

    try:
        candidate.resolve().relative_to(datasets_root.resolve())
        logger.info("datasets fallback: serving '%s' from %s", requested_filename, candidate)
        return candidate.read_bytes()
    except ValueError:
        logger.warning("path traversal attempt blocked: %s", candidate)
        return None