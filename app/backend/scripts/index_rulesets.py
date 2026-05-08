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

import chromadb
import pypdf
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

# Allow running both as ``python scripts/index_rulesets.py`` and
# ``python -m scripts.index_rulesets`` from the backend root.
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.chunker import chunk_document
from app.services.rag_service import CHROMA_PATH, EMBED_MODEL, LEGAL_COLLECTION

RULESETS_DIR = Path(__file__).parent.parent / "rulesets"


def _extract_pages(pdf_path: Path) -> list[tuple[int, str]]:
    """Return [(page_number, text), ...] for all non-empty pages."""
    reader = pypdf.PdfReader(str(pdf_path))
    pages = []
    for page_num, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            pages.append((page_num, text))
    return pages


def main() -> None:
    CHROMA_PATH.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    embed = SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)

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

    pdf_paths = sorted(RULESETS_DIR.glob("*.pdf"))
    if not pdf_paths:
        print(f"No PDFs found in {RULESETS_DIR}. Aborting.")
        sys.exit(1)

    ids: list[str] = []
    documents: list[str] = []
    metadatas: list[dict[str, object]] = []

    for pdf_path in pdf_paths:
        print(f"  Parsing: {pdf_path.name}")
        pages = _extract_pages(pdf_path)
        chunks = chunk_document(
            pages=pages,
            file_name=pdf_path.name,
            doc_type="legal",
        )
        for chunk in chunks:
            ids.append(chunk.chunk_id)
            documents.append(chunk.text)
            metadatas.append({
                "source": chunk.file_name,
                "page": chunk.chapter_or_page,
                "chunk_index": chunk.chunk_index,
                "char_start": chunk.char_start,
                "char_end": chunk.char_end,
            })
        print(f"    > {len(pages)} pages, {len(chunks)} chunks")

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
