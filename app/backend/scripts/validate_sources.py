#!/usr/bin/env python3
"""Validate cached official legal source PDFs against the pinned catalog."""

from __future__ import annotations

import sys
from pathlib import Path

# Allow running both as ``python scripts/validate_sources.py`` and
# ``python -m scripts.validate_sources`` from the backend root.
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.legal_source_catalog import validate_source_files


def main() -> None:
    statuses = validate_source_files(compute_hash=True)
    failed = [status for status in statuses if not status.ok]

    for status in statuses:
        marker = "OK" if status.ok else "FAIL"
        size_text = "n/a" if status.size_bytes is None else str(status.size_bytes)
        sha_text = "n/a" if status.sha256 is None else status.sha256
        print(
            f"{marker}\t{status.source_id}\t{status.local_filename or '-'}\t"
            f"size={size_text}\tsha256={sha_text}"
        )
        for issue in status.issues:
            print(f"  - {issue}")

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()