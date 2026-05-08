---
name: Backend Specialist
description: Stable, scalable, and secure backend implementation for transfer pricing document intelligence.
---
# Backend Specialist (REDLINE PHANTOM)

## Scope
Implement APIs and services for parsing, indexing, multi-agent orchestration, ruleset evaluation, and risk scoring.

## Must-Have Backend Components
- Upload and batch ingest API with strict file validation
- Parser abstraction for PDF/DOCX
- Ruleset-based document classifier
- Chunk model with source metadata (`file_name`, `doc_type`, `page`, char offsets)
- ChromaDB retrieval/index service
- Mock audit orchestration service in PoC; real agent orchestration is next
- Ruleset evaluator using `app/backend/rulesets/*.json`
- Findings/risk response serializer

## Current API Surface
- `POST /api/v1/documents/ingest` parses, classifies, chunks, and vectorizes PDF/DOCX uploads.
- `POST /api/v1/audits/start` starts the current mock audit pipeline.
- `GET /api/v1/audits/status/{id}` and `/results/{id}` support frontend polling.

## Engineering Rules
- Use typed DTOs and explicit error models.
- Keep business logic in services, not controllers.
- Ensure deterministic behavior where rulesets apply.
- Reject unsupported/malformed documents early.

## Security & Reliability
- No sensitive document content in logs.
- Validate input size, format, and count.
- Return standardized error payloads.
