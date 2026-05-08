"""Benchmark Study specialist."""

from __future__ import annotations

from pathlib import Path
from typing import ClassVar

from app.agents.base import DocumentTypeAgent
from app.models.schemas import DocumentType


class BenchmarkAgent(DocumentTypeAgent):
    agent_id: ClassVar[str] = "benchmark_agent"
    doc_type: ClassVar[DocumentType] = DocumentType.BENCHMARK_STUDY
    prompt_path: ClassVar[Path] = Path(__file__).parent / "prompts" / "benchmark_v1.md"
    prompt_version: ClassVar[str] = "benchmark_v1"
