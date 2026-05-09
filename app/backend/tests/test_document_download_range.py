"""Unit tests for byte-range document download responses."""

from __future__ import annotations

import pytest
from fastapi import HTTPException, status

from app.api.v1.endpoints.documents import _build_file_response, _parse_byte_range


def test_parse_byte_range_supports_open_ended_ranges() -> None:
    assert _parse_byte_range("bytes=4-", 10) == (4, 9)


def test_parse_byte_range_supports_suffix_ranges() -> None:
    assert _parse_byte_range("bytes=-4", 10) == (6, 9)


def test_build_file_response_returns_partial_content() -> None:
    response = _build_file_response(
        payload=b"0123456789",
        filename="sample.pdf",
        media_type="application/pdf",
        range_header="bytes=2-5",
    )

    assert response.status_code == status.HTTP_206_PARTIAL_CONTENT
    assert response.body == b"2345"
    assert response.headers["content-range"] == "bytes 2-5/10"
    assert response.headers["accept-ranges"] == "bytes"
    assert response.headers["content-length"] == "4"


def test_build_file_response_rejects_invalid_range() -> None:
    with pytest.raises(HTTPException) as exc_info:
        _build_file_response(
            payload=b"0123456789",
            filename="sample.pdf",
            media_type="application/pdf",
            range_header="bytes=30-40",
        )

    assert exc_info.value.status_code == status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE
    assert exc_info.value.headers == {"Content-Range": "bytes */10"}
