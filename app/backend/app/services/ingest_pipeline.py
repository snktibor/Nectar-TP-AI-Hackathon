"""Document ingest pipeline: parse → classify → chunk → enrich → vectorize.

Orchestrates the full ingestion flow for a batch of uploaded files.
Each file is processed independently; failures in one file do not
block the others.
"""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID, uuid4

from app.models.schemas import IngestedDocument
from app.services.chunker import chunk_document
from app.services.document_classifier import classify_document
from app.services.document_parser import parse_document
from app.services.vector_store import store_chunks

logger = logging.getLogger(__name__)


def ingest_single_file(
    session_id: UUID,
    filename: str,
    content: bytes,
) -> IngestedDocument:
    """Run the full ingest pipeline for a single file.

    Steps:
        1. Parse (extract text from PDF/DOCX)
        2. Classify (match keywords against ruleset)
        3. Chunk (split into overlapping segments)
        4. Enrich (extract lightweight knowledge triples per chunk)
        5. Vectorize (store in ChromaDB with metadata and graph links)
    """
    document_id = uuid4()

    parsed = parse_document(filename, content)
    if parsed.error:
        return IngestedDocument(
            document_id=document_id,
            filename=filename,
            size_bytes=len(content),
            detected_type="unknown",
            confidence=0.0,
            page_count=0,
            chunk_count=0,
            status="failed",
            error=parsed.error,
        )

    sample_text = parsed.first_n_pages_text(n=5)
    classification = classify_document(sample_text, filename=filename)

    pages_for_chunking = [(p.page_number, p.text) for p in parsed.pages]
    chunks = chunk_document(
        pages=pages_for_chunking,
        file_name=filename,
        doc_type=classification.doc_type,
    )

    stored_count = store_chunks(
        session_id,
        document_id,
        chunks,
        filename=filename,
        doc_type=classification.doc_type,
    )

    logger.info(
        "Ingested %s → doc_id=%s type=%s confidence=%.2f pages=%d chunks=%d",
        filename,
        document_id,
        classification.doc_type,
        classification.confidence,
        parsed.page_count,
        stored_count,
    )

    return IngestedDocument(
        document_id=document_id,
        filename=filename,
        size_bytes=len(content),
        detected_type=classification.doc_type,
        confidence=classification.confidence,
        page_count=parsed.page_count,
        chunk_count=stored_count,
        status="success",
    )


async def ingest_batch(
    session_id: UUID,
    files: list[tuple[str, bytes]],
) -> list[IngestedDocument]:
    """Process a batch of files through the ingest pipeline.

    Each file is processed sequentially to avoid memory pressure from
    concurrent PDF parsing. Returns results for all files, including
    any that failed.
    """
    results: list[IngestedDocument] = []

    for filename, content in files:
        result = await asyncio.to_thread(ingest_single_file, session_id, filename, content)
        results.append(result)

    return results
