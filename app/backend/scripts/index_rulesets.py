#!/usr/bin/env python3
"""Build the static legal knowledge base from rulesets/ PDFs.

Run once (and re-run whenever rulesets are updated):

    cd app/backend
    python -m scripts.index_rulesets

Outputs a persistent ChromaDB collection at data/chromadb/ named
``legal_knowledge``. The collection is fully replaced on each run.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pypdf

# Allow running both as ``python scripts/index_rulesets.py`` and
# ``python -m scripts.index_rulesets`` from the backend root.
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.chunker import chunk_document
from app.services.chroma_client import (
    create_persistent_chroma_client,
    create_sentence_transformer_embedding_function,
)
from app.services.legal_source_catalog import (
    load_legal_source_catalog,
    source_section_for_page,
    source_to_chroma_metadata,
    validate_source_files,
)
from app.services.rag_service import CHROMA_PATH, EMBED_MODEL, LEGAL_COLLECTION


def _extract_pages(pdf_path: Path) -> list[tuple[int, str]]:
    """Return [(page_number, text), ...] for all non-empty pages."""
    reader = pypdf.PdfReader(str(pdf_path))
    pages = []
    for page_num, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            pages.append((page_num, text))
    return pages


def _page_number(chapter_or_page: str) -> int:
    """Extract a 1-based page number from chunk metadata like page_23."""
    return int("".join(char for char in chapter_or_page if char.isdigit()) or 0)


def main() -> None:
    catalog = load_legal_source_catalog()
    invalid_sources = [status for status in validate_source_files(catalog) if not status.ok]
    if invalid_sources:
        print("Official source catalog validation failed:")
        for status in invalid_sources:
            print(f"  {status.source_id}: {', '.join(status.issues)}")
        sys.exit(1)

    sources = catalog.iter_indexable_sources()
    if not sources:
        print("No index-enabled legal sources found in official_sources.json. Aborting.")
        sys.exit(1)

    client = create_persistent_chroma_client(CHROMA_PATH)
    embed = create_sentence_transformer_embedding_function(model_name=EMBED_MODEL)

    try:
        client.delete_collection(LEGAL_COLLECTION)
        print(f"Dropped existing '{LEGAL_COLLECTION}' collection.")
    except Exception:
        pass
    collection = client.create_collection(
        LEGAL_COLLECTION,
        embedding_function=embed,
        metadata={"hnsw:space": "cosine"},
    )

    ids: list[str] = []
    documents: list[str] = []
    metadatas: list[dict[str, object]] = []

    for source in sources:
        pdf_path = catalog.resolve_local_path(source)
        print(f"  Parsing: {source.source_id} ({pdf_path.name})")
        pages = _extract_pages(pdf_path)
        chunks = chunk_document(
            pages=pages,
            file_name=pdf_path.name,
            doc_type="legal",
        )
        source_metadata = source_to_chroma_metadata(
            source,
            catalog_version=catalog.catalog_version,
        )
        indexed_chunk_count = 0

        if not chunks:
            summary_parts = [source.title, source.citation_label]
            if source.priority_topics:
                summary_parts.append(f"Topics: {', '.join(source.priority_topics)}")
            if source.sections:
                section_labels = [section.citation_label for section in source.sections[:4]]
                summary_parts.append(f"Sections: {', '.join(section_labels)}")

            summary_text = " | ".join(part for part in summary_parts if part)
            summary_section = source.sections[0] if source.sections else None
            summary_metadata = {
                **source_metadata,
                "source": pdf_path.name,
                "filename": pdf_path.name,
                "file_name": pdf_path.name,
                "page": "page_1",
                "chapter_or_page": "page_1",
                "chunk_index": 0,
                "char_start": 0,
                "char_end": len(summary_text),
                "synthetic_summary": True,
            }
            if summary_section is not None:
                summary_metadata.update(
                    {
                        "section_id": summary_section.section_id,
                        "section_label": summary_section.label,
                        "section_title": summary_section.title,
                        "citation_label": summary_section.citation_label,
                    }
                )
            ids.append(f"{source.source_id}::summary")
            documents.append(summary_text)
            metadatas.append(summary_metadata)
            indexed_chunk_count += 1

        for chunk in chunks:
            section = source_section_for_page(source, _page_number(chunk.chapter_or_page))
            metadata = {
                **source_metadata,
                "source": chunk.file_name,
                "filename": chunk.file_name,
                "file_name": chunk.file_name,
                "page": chunk.chapter_or_page,
                "chapter_or_page": chunk.chapter_or_page,
                "chunk_index": chunk.chunk_index,
                "char_start": chunk.char_start,
                "char_end": chunk.char_end,
            }
            if section is not None:
                metadata.update(
                    {
                        "section_id": section.section_id,
                        "section_label": section.label,
                        "section_title": section.title,
                        "citation_label": section.citation_label,
                    }
                )
            ids.append(chunk.chunk_id)
            documents.append(chunk.text)
            metadatas.append(metadata)
            indexed_chunk_count += 1
        print(f"    > {len(pages)} pages, {len(chunks)} chunks, {indexed_chunk_count} indexed")

    print(f"\nEmbedding and storing {len(ids)} chunks ...")
    batch_size = 100
    for i in range(0, len(ids), batch_size):
        collection.add(
            ids=ids[i:i + batch_size],
            documents=documents[i:i + batch_size],
            metadatas=metadatas[i:i + batch_size],
        )
    print(f"Done. Legal knowledge base ready at: {CHROMA_PATH}")


if __name__ == "__main__":
    main()
