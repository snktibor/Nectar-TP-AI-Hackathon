"""Master File specialist."""

from __future__ import annotations

from pathlib import Path
from typing import ClassVar

from app.agents.base import DocumentTypeAgent
from app.models.schemas import DocumentType


class MasterFileAgent(DocumentTypeAgent):
    agent_id: ClassVar[str] = "master_file_agent"
    doc_type: ClassVar[DocumentType] = DocumentType.MASTER_FILE
    prompt_path: ClassVar[Path] = Path(__file__).parent / "prompts" / "master_file_v1.md"
    prompt_version: ClassVar[str] = "master_file_v1"
