"""Semantic text chunking for vector storage.

Splits document text into overlapping chunks along paragraph/section
boundaries. Each chunk carries metadata for source traceability.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from uuid import uuid4

from app.services.knowledge_graph import (
    KnowledgeTriple,
    KnowledgeTripleExtractor,
    RuleBasedKnowledgeTripleExtractor,
)

logger = logging.getLogger(__name__)


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
    knowledge_triples: tuple[KnowledgeTriple, ...] = ()


_DEFAULT_CHUNK_SIZE = 1000
_DEFAULT_CHUNK_OVERLAP = 200
_SEPARATORS = ["\n\n", "\n", ". ", " "]
_DEFAULT_TRIPLE_EXTRACTOR = RuleBasedKnowledgeTripleExtractor()


def _split_text(
    text: str,
    chunk_size: int = _DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = _DEFAULT_CHUNK_OVERLAP,
) -> list[str]:
    """Recursively split text using separator hierarchy, similar to LangChain's RecursiveCharacterTextSplitter."""
    if len(text) <= chunk_size:
        return [text] if text.strip() else []

    for separator in _SEPARATORS:
        chunks = _split_with_separator(text, separator, chunk_size, chunk_overlap)
        if chunks is not None:
            return chunks

    return _split_fixed_width(text, chunk_size, chunk_overlap)


def _split_with_separator(
    text: str,
    separator: str,
    chunk_size: int,
    chunk_overlap: int,
) -> list[str] | None:
    parts = text.split(separator)
    if len(parts) <= 1:
        return None

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


def _split_fixed_width(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    chunks: list[str] = []
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
    triple_extractor: KnowledgeTripleExtractor | None = None,
) -> list[TextChunk]:
    """Split document pages into chunks with traceability metadata.

    Args:
        pages: List of (page_number, text) tuples.
        file_name: Original filename for metadata.
        doc_type: Classified document type.
        chunk_size: Target chunk size in characters.
        chunk_overlap: Overlap between consecutive chunks.
        triple_extractor: Optional strategy for lightweight GraphRAG extraction.

    Returns:
        List of TextChunk objects ready for vector storage.
    """
    all_chunks: list[TextChunk] = []
    global_index = 0
    running_offset = 0
    extractor = triple_extractor or _DEFAULT_TRIPLE_EXTRACTOR

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
                    knowledge_triples=_extract_triples(extractor, split, doc_type),
                )
            )
            global_index += 1
            local_offset = page_text.find(split, local_offset)
            if local_offset == -1:
                local_offset = char_end - running_offset

        running_offset += len(page_text)

    return all_chunks


def _extract_triples(
    extractor: KnowledgeTripleExtractor,
    text: str,
    doc_type: str,
) -> tuple[KnowledgeTriple, ...]:
    try:
        return extractor.extract(text, doc_type)
    except Exception as exc:  # noqa: BLE001 - GraphRAG must not block ingest.
        logger.warning(
            "knowledge triple extraction skipped: doc_type=%s error=%s",
            doc_type,
            type(exc).__name__,
        )
        return ()
