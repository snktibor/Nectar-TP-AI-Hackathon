"""Intercompany contract specialist."""

from __future__ import annotations

from pathlib import Path
from typing import ClassVar

from app.agents.base import DocumentTypeAgent
from app.models.schemas import DocumentType


class ContractAgent(DocumentTypeAgent):
    agent_id: ClassVar[str] = "contract_agent"
    doc_type: ClassVar[DocumentType] = DocumentType.CONTRACT
    prompt_path: ClassVar[Path] = Path(__file__).parent / "prompts" / "contract_v1.md"
    prompt_version: ClassVar[str] = "contract_v1"
