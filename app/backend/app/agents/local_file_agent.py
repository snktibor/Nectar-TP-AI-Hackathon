"""Local File specialist."""

from __future__ import annotations

from pathlib import Path
from typing import ClassVar

from app.agents.base import DocumentTypeAgent
from app.models.schemas import DocumentType


class LocalFileAgent(DocumentTypeAgent):
    agent_id: ClassVar[str] = "local_file_agent"
    doc_type: ClassVar[DocumentType] = DocumentType.LOCAL_FILE
    prompt_path: ClassVar[Path] = Path(__file__).parent / "prompts" / "local_file_v1.md"
    prompt_version: ClassVar[str] = "local_file_v1"
