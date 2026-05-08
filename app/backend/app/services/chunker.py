"""Semantic text chunking for vector storage.

Splits document text into overlapping chunks along paragraph/section
boundaries. Each chunk carries metadata for source traceability.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4


@dataclass(frozen=True)
class TextChunk:
    """A single chunk of text with traceability metadata."""

    chunk_id: str
    text: str
    file_name: str
    doc_type: str
    chapter_or_page: str
    chunk_index: int
    char_start: int
    char_end: int


_DEFAULT_CHUNK_SIZE = 1000
_DEFAULT_CHUNK_OVERLAP = 200
_SEPARATORS = ["\n\n", "\n", ". ", " "]


def _split_text(
    text: str,
    chunk_size: int = _DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = _DEFAULT_CHUNK_OVERLAP,
) -> list[str]:
    """Recursively split text using separator hierarchy, similar to LangChain's RecursiveCharacterTextSplitter."""
    if len(text) <= chunk_size:
        return [text] if text.strip() else []

    for separator in _SEPARATORS:
        parts = text.split(separator)
        if len(parts) <= 1:
            continue

        chunks: list[str] = []
        current = ""

        for part in parts:
            candidate = f"{current}{separator}{part}" if current else part
            if len(candidate) > chunk_size and current:
                chunks.append(current.strip())
                overlap_text = current[-chunk_overlap:] if len(current) > chunk_overlap else current
                current = f"{overlap_text}{separator}{part}"
            else:
                current = candidate

        if current.strip():
            chunks.append(current.strip())

        return chunks

    chunks = []
    for i in range(0, len(text), chunk_size - chunk_overlap):
        chunk = text[i : i + chunk_size]
        if chunk.strip():
            chunks.append(chunk.strip())
    return chunks


def chunk_document(
    pages: list[tuple[int, str]],
    file_name: str,
    doc_type: str,
    chunk_size: int = _DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = _DEFAULT_CHUNK_OVERLAP,
) -> list[TextChunk]:
    """Split document pages into chunks with traceability metadata.

    Args:
        pages: List of (page_number, text) tuples.
        file_name: Original filename for metadata.
        doc_type: Classified document type.
        chunk_size: Target chunk size in characters.
        chunk_overlap: Overlap between consecutive chunks.

    Returns:
        List of TextChunk objects ready for vector storage.
    """
    all_chunks: list[TextChunk] = []
    global_index = 0
    running_offset = 0

    for page_num, page_text in pages:
        if not page_text.strip():
            running_offset += len(page_text)
            continue

        splits = _split_text(page_text, chunk_size, chunk_overlap)

        local_offset = 0
        for split in splits:
            char_start = running_offset + local_offset
            char_end = char_start + len(split)

            all_chunks.append(
                TextChunk(
                    chunk_id=str(uuid4()),
                    text=split,
                    file_name=file_name,
                    doc_type=doc_type,
                    chapter_or_page=f"page_{page_num}",
                    chunk_index=global_index,
                    char_start=char_start,
                    char_end=char_end,
                )
            )
            global_index += 1
            local_offset = page_text.find(split, local_offset)
            if local_offset == -1:
                local_offset = char_end - running_offset

        running_offset += len(page_text)

    return all_chunks
