"""Enterprise report payload builder tests."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.models.schemas import (
    AuditReport,
    BenchmarkRisk,
    ConsistencyError,
    MissingElement,
    RiskSeverity,
)
from app.services.report_builder import build_enterprise_report_payload


def test_build_enterprise_report_payload_computes_expected_sections() -> None:
    report = AuditReport(
        audit_task_id=uuid4(),
        session_id=uuid4(),
        generated_at=datetime.now(timezone.utc),
        consistency_errors=[
            ConsistencyError(
                description="Licencdij osszeg elteres a szerzodes es a Local File kozott.",
                severity=RiskSeverity.CRITICAL,
            )
        ],
        benchmark_risks=[
            BenchmarkRisk(
                metric="Berry-rata",
                observed_value=1.19,
                benchmark_range=(0.98, 1.10),
                severity=RiskSeverity.HIGH,
                rationale="A tesztelt fel mutatoja az IQR tartomanyon kivul van.",
            )
        ],
        missing_elements=[
            MissingElement(
                description="Hianyzik a benefit test dokumentacio.",
                expected_in="hig_local_file_2024_faulty.pdf",
                required_by="32/2017 NGM 4. § (1) g)",
                severity=RiskSeverity.MEDIUM,
            )
        ],
        overall_risk=RiskSeverity.HIGH,
        summary="3 megallapitas azonosithato.",
        agent_runs=[],
    )

    payload = build_enterprise_report_payload(report)

    assert payload.findings_total == 3
    assert payload.severity_breakdown.critical == 1
    assert payload.severity_breakdown.high == 1
    assert payload.severity_breakdown.medium == 1
    assert payload.severity_breakdown.low == 0

    critical_row = next(
        row for row in payload.severity_type_matrix if row.severity == RiskSeverity.CRITICAL
    )
    assert critical_row.consistency == 1
    assert critical_row.total == 1

    assert payload.financial_estimate.max_total_huf >= payload.financial_estimate.base_total_huf
    assert payload.financial_estimate.base_total_huf > 0

    assert len(payload.remediation_plan.immediate_30) == 1
    assert len(payload.remediation_plan.short_90) == 1
    assert len(payload.remediation_plan.mid_180) == 1
    assert len(payload.remediation_plan.all_actions) == 3
