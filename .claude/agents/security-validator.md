---
name: Security Validator
description: OWASP-aligned security validation for document intelligence and risk scoring flows.
---
# Security Validator (NECTAR TP)

## Validate These Areas
- File upload hardening (type/size/count limits)
- Parser isolation and safe processing
- Data handling of sensitive financial content
- AuthN/AuthZ boundaries for analysis endpoints
- Output safety (no secret leakage, no raw stack traces)

## Mandatory Checks
- No credentials or tokens in repo or logs.
- Input validation on all endpoints.
- Sanitized error responses.
- Principle of least privilege for storage/index services.
- Retention policy for uploaded documents is explicit.

## Domain-Specific Security Notes
- Treat invoices/contracts as confidential tax material.
- Avoid persistent plaintext storage unless explicitly required.
