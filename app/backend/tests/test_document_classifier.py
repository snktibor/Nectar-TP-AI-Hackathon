"""Unit tests for keyword and filename-based document classification."""

from __future__ import annotations

import pytest

from app.services.document_classifier import classify_document


def test_benchmark_text_classifies_as_benchmark_study() -> None:
    sample_text = "\n".join(
        [
            "Benchmark tanulmány",
            "Comparable companies were selected using a database search.",
            "The interquartile range (IQR) and median were computed.",
            "TNMM method was applied for comparability.",
        ]
    )

    result = classify_document(sample_text, filename="third_party_benchmark_study.pdf")

    assert result.doc_type == "benchmark_study"
    assert result.confidence >= 0.8


def test_tp_report_filename_override_forces_other() -> None:
    sample_text = "\n".join(
        [
            "Benchmark analysis summary",
            "Interquartile range and median references",
            "Comparability notes and TNMM outcomes",
        ]
    )

    result = classify_document(sample_text, filename="NectarTP_Report_12665118_2026-05-09.pdf")

    assert result.doc_type == "other"
    assert result.label == "Other"
    assert result.confidence == pytest.approx(0.2, abs=1e-9)
    assert result.matched_keywords == ["filename:nectartp_report"]


def test_low_confidence_required_type_falls_back_to_other() -> None:
    sample_text = "\n".join(
        [
            "Local file",
            "Functional analysis",
            "Controlled transaction",
        ]
    )

    result = classify_document(sample_text, filename="tp_unknown_input.pdf")

    assert result.doc_type == "other"
    assert result.confidence < 0.8


def test_local_file_filename_override_classifies_as_local_file() -> None:
    sample_text = "Random content with weak signals"

    result = classify_document(sample_text, filename="HIG_LocalFile_2024_FAULTY.pdf")

    assert result.doc_type == "local_file"
    assert result.confidence == pytest.approx(0.97, abs=1e-9)
    assert result.matched_keywords == ["filename:localfile"]


def test_keyword_confidence_is_capped_below_100_percent() -> None:
    sample_text = "\n".join(
        [
            "master file",
            "fődokumentum",
            "transzferár fődokumentum",
            "organisational structure",
            "szervezeti felépítés",
            "csoport szervezeti",
            "intangibles",
            "immateriális javak",
            "intercompany financial activities",
        ]
    )

    result = classify_document(sample_text, filename="group_master_document.pdf")

    assert result.doc_type == "master_file"
    assert result.confidence == pytest.approx(0.99, abs=1e-9)


def test_megfelelosegi_report_filename_override_forces_other() -> None:
    sample_text = "\n".join(
        [
            "Benchmark analysis summary",
            "Interquartile range and median references",
            "Comparability notes and TNMM outcomes",
        ]
    )

    result = classify_document(sample_text, filename="HIG_TP_Megfelelosegi_Jelentes_2024.pdf")

    assert result.doc_type == "other"
    assert result.label == "Other"
    assert result.confidence == pytest.approx(0.2, abs=1e-9)
    assert result.matched_keywords == ["filename:megfelelosegi_jelentes"]
