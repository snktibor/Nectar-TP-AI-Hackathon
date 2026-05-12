"""Helpers for browser-friendly original file responses."""

from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, status
from fastapi.responses import Response

_FILE_CACHE_CONTROL = "private, max-age=300"


def build_file_response(
    payload: bytes,
    filename: str,
    media_type: str,
    range_header: str | None,
) -> Response:
    """Build a full or byte-range response for inline document viewing."""
    headers = _file_response_headers(filename, len(payload))
    if range_header is None or len(payload) == 0:
        return Response(content=payload, media_type=media_type, headers=headers)

    byte_range = parse_byte_range(range_header, len(payload))
    if byte_range is None:
        raise HTTPException(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            detail={"code": "INVALID_RANGE", "message": "Requested byte range is not satisfiable."},
            headers={"Content-Range": f"bytes */{len(payload)}"},
        )

    start, end = byte_range
    partial = payload[start : end + 1]
    headers["Content-Length"] = str(len(partial))
    headers["Content-Range"] = f"bytes {start}-{end}/{len(payload)}"
    return Response(
        content=partial,
        media_type=media_type,
        headers=headers,
        status_code=status.HTTP_206_PARTIAL_CONTENT,
    )


def parse_byte_range(range_header: str, size_bytes: int) -> tuple[int, int] | None:
    """Parse a single HTTP byte range into inclusive start/end offsets."""
    if not range_header.startswith("bytes=") or "," in range_header:
        return None

    range_spec = range_header.removeprefix("bytes=").strip()
    if "-" not in range_spec:
        return None

    start_text, end_text = range_spec.split("-", 1)
    if not start_text and not end_text:
        return None

    try:
        if not start_text:
            suffix_length = int(end_text)
            if suffix_length <= 0:
                return None
            start = max(size_bytes - suffix_length, 0)
            end = size_bytes - 1
        else:
            start = int(start_text)
            end = int(end_text) if end_text else size_bytes - 1
    except ValueError:
        return None

    if start < 0 or end < start or start >= size_bytes:
        return None

    return start, min(end, size_bytes - 1)


def _file_response_headers(filename: str, size_bytes: int) -> dict[str, str]:
    safe_filename = Path(filename).name.replace('"', "")
    return {
        "Accept-Ranges": "bytes",
        "Cache-Control": _FILE_CACHE_CONTROL,
        "Content-Disposition": f'inline; filename="{safe_filename}"',
        "Content-Length": str(size_bytes),
    }
