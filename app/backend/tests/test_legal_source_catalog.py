"""Tests for pinned official legal source catalog handling."""

from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from app.models.schemas import EvidenceChunk
from app.services.legal_source_catalog import (
    load_legal_source_catalog,
    source_to_chroma_metadata,
    validate_source_files,
)
from app.services.rag_service import RagService


def test_catalog_loads_index_enabled_sources_and_hashes_match() -> None:
    catalog = load_legal_source_catalog()

    source_ids = {source.source_id for source in catalog.iter_indexable_sources()}
    assert source_ids == {
        "HU_TAO_ACT_1996_LXXXI",
        "HU_NGM_DECREE_45_2025",
        "HU_NAV_TP_DATA_SERVICE_GUIDE_2024",
        "HU_NAV_INFO_BOOKLET_41_TAO_2026",
        "HU_MAGYAR_KOZLONY_2025_157",
        "OECD_TPG_2010_HU",
        "OECD_TPG_2022",
    }

    statuses = validate_source_files(catalog)
    assert all(status.ok for status in statuses)


def test_catalog_rejects_paths_outside_rulesets(tmp_path) -> None:
    payload = {
        "catalog_version": "test",
        "sources": [
            {
                "source_id": "BAD_SOURCE",
                "title": "Bad source",
                "source_type": "law",
                "jurisdiction": "HU",
                "language": "hu",
                "local_path": "../secret.pdf",
                "index_enabled": True,
                "update_mode": "manual_cache",
                "access_status": "cached",
                "citation_label": "Bad",
            }
        ],
    }
    catalog_path = tmp_path / "official_sources.json"
    catalog_path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ValidationError):
        load_legal_source_catalog(catalog_path)


def test_source_metadata_round_trips_through_rag_parser() -> None:
    catalog = load_legal_source_catalog()
    source = catalog.get_source("OECD_TPG_2022")
    assert source is not None

    metadata = source_to_chroma_metadata(
        source,
        catalog_version=catalog.catalog_version,
    )
    assert "benchmark_study" in str(metadata["agent_scopes"])
    assert "comparability analysis" in str(metadata["priority_topics"])
    metadata.update(
        {
            "source": "oecd_tpg_2022_en.pdf",
            "page": "page_160",
            "chunk_index": 12,
            "char_start": 120,
            "char_end": 240,
            "section_id": "OECD_TPG_2022.Ch_V",
        }
    )
    results = {
        "documents": [["Chapter V documentation text"]],
        "metadatas": [[metadata]],
        "distances": [[0.25]],
    }

    chunk = RagService._parse_results(results, source_kind="legal")[0]

    assert chunk.source_id == "OECD_TPG_2022"
    assert chunk.source_title == source.title
    assert chunk.source_url == source.official_url
    assert chunk.source_version == "2022"
    assert chunk.citation_label == "OECD TPG 2022"
    assert chunk.section_id == "OECD_TPG_2022.Ch_V"
    assert "benchmark_study" in chunk.agent_scopes
    assert "comparability analysis" in chunk.priority_topics
    assert chunk.page == 160
    assert chunk.score == pytest.approx(0.75)

    evidence = EvidenceChunk(
        filename=chunk.source,
        page=chunk.page,
        chunk_index=chunk.chunk_index,
        quote=chunk.text,
        char_start=chunk.char_start,
        char_end=chunk.char_end,
        source_kind="legal",
        source_id=chunk.source_id,
        source_title=chunk.source_title,
        source_url=chunk.source_url,
        source_version=chunk.source_version,
        citation_label=chunk.citation_label,
    )
    assert evidence.source_id == "OECD_TPG_2022"