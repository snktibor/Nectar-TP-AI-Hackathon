"""Intercompany invoice specialist."""

from __future__ import annotations

from pathlib import Path
from typing import ClassVar

from app.agents.base import DocumentTypeAgent
from app.models.schemas import DocumentType


class InvoiceAgent(DocumentTypeAgent):
    agent_id: ClassVar[str] = "invoice_agent"
    doc_type: ClassVar[DocumentType] = DocumentType.INVOICE
    prompt_path: ClassVar[Path] = Path(__file__).parent / "prompts" / "invoice_v1.md"
    prompt_version: ClassVar[str] = "invoice_v1"
