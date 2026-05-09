"""Unit tests for keyword and filename-based document classification."""

from __future__ import annotations

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
    assert result.confidence >= 0.3


def test_tp_report_filename_override_forces_other() -> None:
    sample_text = "\n".join(
        [
            "Benchmark analysis summary",
            "Interquartile range and median references",
            "Comparability notes and TNMM outcomes",
        ]
    )

    result = classify_document(sample_text, filename="RedlinePhantom_TP_Report_12665118_2026-05-09.pdf")

    assert result.doc_type == "other"
    assert result.label == "Other"
    assert result.matched_keywords == ["filename:redlinephantom_tp_report"]
