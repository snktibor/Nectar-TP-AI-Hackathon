"""Specialist agents — one per uploaded transfer-pricing document type.

Public surface:
  * `AGENT_REGISTRY` — ordered tuple of agent factories used by the orchestrator.
  * `DocumentTypeAgent` — abstract base class.
  * `RagService` — `Protocol` describing the only RAG entry point we depend on.
"""

from __future__ import annotations

from app.agents.base import DocumentTypeAgent, RagService
from app.agents.benchmark_agent import BenchmarkAgent
from app.agents.contract_agent import ContractAgent
from app.agents.cross_doc_consistency_agent import CrossDocConsistencyAgent
from app.agents.invoice_agent import InvoiceAgent
from app.agents.local_file_agent import LocalFileAgent
from app.agents.master_file_agent import MasterFileAgent

# All agents run in parallel via the orchestrator's asyncio.gather; this order
# is only used for stable progress weighting and reproducible test fixtures.
# Per-document RAGs are populated during ingest, so the cross-document agent
# sees the full corpus regardless of its position here.
AGENT_CLASSES: tuple[type[DocumentTypeAgent], ...] = (
    MasterFileAgent,
    LocalFileAgent,
    BenchmarkAgent,
    ContractAgent,
    InvoiceAgent,
    CrossDocConsistencyAgent,
)

__all__ = (
    "AGENT_CLASSES",
    "DocumentTypeAgent",
    "RagService",
    "MasterFileAgent",
    "LocalFileAgent",
    "BenchmarkAgent",
    "ContractAgent",
    "InvoiceAgent",
    "CrossDocConsistencyAgent",
)
