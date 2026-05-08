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

from app.services.rag_service import (
    CHROMA_PATH,
    EMBED_MODEL,
    LEGAL_COLLECTION,
    chunk_text,
    _batch_add,
)

RULESETS_DIR = Path(__file__).parent.parent / "rulesets"


def _extract_pages(pdf_path: Path) -> list[tuple[int, str]]:
    """Return ``[(page_number, text), ...]`` for all non-empty pages."""
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

    # Full rebuild — safe because this is a static collection.
    try:
        client.delete_collection(LEGAL_COLLECTION)
        print(f"Dropped existing '{LEGAL_COLLECTION}' collection.")
    except Exception:
        pass
    collection = client.create_collection(LEGAL_COLLECTION, embedding_function=embed)

    pdf_paths = sorted(RULESETS_DIR.glob("*.pdf"))
    if not pdf_paths:
        print(f"No PDFs found in {RULESETS_DIR}. Aborting.")
        sys.exit(1)

    ids: list[str] = []
    texts: list[str] = []
    metadatas: list[dict[str, object]] = []
    global_idx = 0

    for pdf_path in pdf_paths:
        print(f"  Parsing: {pdf_path.name}")
        pages = _extract_pages(pdf_path)
        file_chunks = 0

        for page_num, page_text in pages:
            for chunk_idx, chunk in enumerate(chunk_text(page_text)):
                ids.append(f"legal_{global_idx}")
                texts.append(chunk)
                metadatas.append(
                    {
                        "source": pdf_path.name,
                        "page": page_num,
                        "chunk_index": chunk_idx,
                    }
                )
                global_idx += 1
                file_chunks += 1

        print(f"    > {len(pages)} pages, {file_chunks} chunks")

    print(f"\nEmbedding and storing {global_idx} chunks …")
    _batch_add(collection, ids, texts, metadatas)
    print(f"Done. Legal knowledge base ready at: {CHROMA_PATH}")


if __name__ == "__main__":
    main()
