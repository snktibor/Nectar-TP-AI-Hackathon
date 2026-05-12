"""Factory helpers for ChromaDB clients.

Centralising Chroma construction keeps telemetry, persistence path, and future
client options consistent across ingest, RAG queries, and maintenance scripts.
"""

from __future__ import annotations

import os
from pathlib import Path

# Chroma reads telemetry settings during import/client setup. Keep this before
# importing chromadb to avoid noisy PostHog failures in local confidential runs.
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

import chromadb
from chromadb.config import Settings as ChromaSettings
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

from app.core.settings import Settings, get_settings

_POSTHOG_TELEMETRY_IMPL = "chromadb.telemetry.product.posthog.Posthog"
_NOOP_TELEMETRY_IMPL = "app.services.chroma_telemetry.NoopProductTelemetry"


def create_persistent_chroma_client(
    path: Path | None = None,
    settings: Settings | None = None,
) -> chromadb.ClientAPI:
    """Create a configured persistent ChromaDB client.

    Chroma telemetry is disabled by default in local/dev because this project
    handles confidential tax documents and older Chroma/PostHog combinations
    emit noisy telemetry failures in logs.
    """
    app_settings = settings or get_settings()
    target_path = path or app_settings.chroma_path
    target_path.mkdir(parents=True, exist_ok=True)

    return chromadb.PersistentClient(
        path=str(target_path),
        settings=_build_chroma_settings(app_settings),
    )


def create_ephemeral_chroma_client(settings: Settings | None = None) -> chromadb.ClientAPI:
    """Create a configured in-memory ChromaDB client for integration tests."""
    return chromadb.EphemeralClient(settings=_build_chroma_settings(settings or get_settings()))


def _build_chroma_settings(app_settings: Settings) -> ChromaSettings:
    telemetry_impl = (
        _POSTHOG_TELEMETRY_IMPL
        if app_settings.chroma_anonymized_telemetry
        else _NOOP_TELEMETRY_IMPL
    )

    return ChromaSettings(
        anonymized_telemetry=app_settings.chroma_anonymized_telemetry,
        chroma_product_telemetry_impl=telemetry_impl,
        chroma_telemetry_impl=telemetry_impl,
    )


def create_sentence_transformer_embedding_function(
    model_name: str,
) -> SentenceTransformerEmbeddingFunction:
    """Create the shared sentence-transformer embedding function."""
    return SentenceTransformerEmbeddingFunction(model_name=model_name)
