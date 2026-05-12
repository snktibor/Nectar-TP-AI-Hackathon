"""Enterprise report payload builder.

Computes the dynamic data blocks used by the extended 20+ page report template:
- severity matrices
- indicative financial exposure
- remediation timeline grouped by phase
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Literal

from app.models.schemas import (
    AuditReport,
    EnterpriseReportPayload,
    FinancialEstimate,
    FinancialEstimateLineItem,
    RemediationAction,
    RemediationPhase,
    RemediationPlan,
    RiskSeverity,
    SeverityBreakdown,
    SeverityTransactionMatrixRow,
    SeverityTypeMatrixRow,
)

SeveritySourceType = Literal["consistency", "benchmark", "completeness"]

_SEVERITY_ORDER: dict[RiskSeverity, int] = {
    RiskSeverity.CRITICAL: 0,
    RiskSeverity.HIGH: 1,
    RiskSeverity.MEDIUM: 2,
    RiskSeverity.LOW: 3,
}

_TRANSACTION_TYPE_ORDER = (
    "Gyártási ügylet",
    "Licencdíj (royalty)",
    "Menedzsmentdíj",
    "Egyéb ügylet",
)


@dataclass(frozen=True)
class _FindingRecord:
    finding_id: str
    finding_ref: str
    source_type: SeveritySourceType
    severity: RiskSeverity
    title: str
    description: str
    transaction_type: str
    recommendation: str


def build_enterprise_report_payload(report: AuditReport) -> EnterpriseReportPayload:
    """Build the expanded report payload consumed by the frontend print template."""
    finding_records = _collect_finding_records(report)
    severity_breakdown = _build_severity_breakdown(finding_records)

    severity_type_matrix = _build_severity_type_matrix(finding_records)
    severity_transaction_matrix = _build_severity_transaction_matrix(finding_records)
    financial_estimate = _build_financial_estimate(severity_breakdown)
    remediation_plan = _build_remediation_plan(finding_records)

    findings_total = (
        len(report.consistency_errors)
        + len(report.benchmark_risks)
        + len(report.missing_elements)
    )

    return EnterpriseReportPayload(
        audit_task_id=report.audit_task_id,
        session_id=report.session_id,
        generated_at=report.generated_at,
        overall_risk=report.overall_risk,
        findings_total=findings_total,
        severity_breakdown=severity_breakdown,
        severity_type_matrix=severity_type_matrix,
        severity_transaction_matrix=severity_transaction_matrix,
        financial_estimate=financial_estimate,
        remediation_plan=remediation_plan,
        source_report=report,
    )


def _collect_finding_records(report: AuditReport) -> list[_FindingRecord]:
    records: list[_FindingRecord] = []

    for finding in report.consistency_errors:
        description = finding.description.strip()
        records.append(
            _FindingRecord(
                finding_id=str(finding.error_id),
                finding_ref="#0",
                source_type="consistency",
                severity=finding.severity,
                title=_title_from_text(description),
                description=description,
                transaction_type=_detect_transaction_type(description),
                recommendation=_recommendation_for("consistency", description),
            )
        )

    for finding in report.benchmark_risks:
        description = finding.rationale.strip() or finding.metric
        records.append(
            _FindingRecord(
                finding_id=str(finding.risk_id),
                finding_ref="#0",
                source_type="benchmark",
                severity=finding.severity,
                title=_title_from_text(description),
                description=description,
                transaction_type=_detect_transaction_type(f"{finding.metric} {description}"),
                recommendation=_recommendation_for("benchmark", description),
            )
        )

    for finding in report.missing_elements:
        description = finding.description.strip()
        records.append(
            _FindingRecord(
                finding_id=str(finding.element_id),
                finding_ref="#0",
                source_type="completeness",
                severity=finding.severity,
                title=_title_from_text(description),
                description=description,
                transaction_type=_detect_transaction_type(
                    f"{finding.expected_in} {finding.required_by} {description}"
                ),
                recommendation=_recommendation_for("completeness", description),
            )
        )

    records.sort(
        key=lambda record: (
            _SEVERITY_ORDER[record.severity],
            record.source_type,
            record.title.lower(),
        )
    )

    return [
        replace(record, finding_ref=f"#{index + 1}")
        for index, record in enumerate(records)
    ]


def _build_severity_breakdown(records: list[_FindingRecord]) -> SeverityBreakdown:
    return SeverityBreakdown(
        critical=sum(1 for r in records if r.severity == RiskSeverity.CRITICAL),
        high=sum(1 for r in records if r.severity == RiskSeverity.HIGH),
        medium=sum(1 for r in records if r.severity == RiskSeverity.MEDIUM),
        low=sum(1 for r in records if r.severity == RiskSeverity.LOW),
    )


def _build_severity_type_matrix(
    records: list[_FindingRecord],
) -> list[SeverityTypeMatrixRow]:
    rows: list[SeverityTypeMatrixRow] = []

    for severity in (
        RiskSeverity.CRITICAL,
        RiskSeverity.HIGH,
        RiskSeverity.MEDIUM,
        RiskSeverity.LOW,
    ):
        consistency = sum(
            1
            for r in records
            if r.severity == severity and r.source_type == "consistency"
        )
        benchmark = sum(
            1
            for r in records
            if r.severity == severity and r.source_type == "benchmark"
        )
        completeness = sum(
            1
            for r in records
            if r.severity == severity and r.source_type == "completeness"
        )
        rows.append(
            SeverityTypeMatrixRow(
                severity=severity,
                consistency=consistency,
                benchmark=benchmark,
                completeness=completeness,
                total=consistency + benchmark + completeness,
            )
        )

    return rows


def _build_severity_transaction_matrix(
    records: list[_FindingRecord],
) -> list[SeverityTransactionMatrixRow]:
    rows: list[SeverityTransactionMatrixRow] = []

    for transaction_type in _TRANSACTION_TYPE_ORDER:
        scoped = [record for record in records if record.transaction_type == transaction_type]
        if not scoped:
            continue

        sorted_scoped = sorted(scoped, key=lambda record: _SEVERITY_ORDER[record.severity])
        dominant_issue = sorted_scoped[0].title

        critical = sum(1 for r in scoped if r.severity == RiskSeverity.CRITICAL)
        high = sum(1 for r in scoped if r.severity == RiskSeverity.HIGH)
        medium = sum(1 for r in scoped if r.severity == RiskSeverity.MEDIUM)
        low = sum(1 for r in scoped if r.severity == RiskSeverity.LOW)

        rows.append(
            SeverityTransactionMatrixRow(
                transaction_type=transaction_type,
                critical=critical,
                high=high,
                medium=medium,
                low=low,
                total=critical + high + medium + low,
                dominant_issue=dominant_issue,
            )
        )

    return rows


def _build_financial_estimate(
    severity_breakdown: SeverityBreakdown,
) -> FinancialEstimate:
    critical = severity_breakdown.critical
    high = severity_breakdown.high
    medium = severity_breakdown.medium
    low = severity_breakdown.low

    direct_adjustment_huf = (
        critical * 27_500_000
        + high * 6_000_000
        + medium * 1_500_000
        + low * 400_000
    )

    estimated_tax_shortfall_huf = int(round(direct_adjustment_huf * 0.09))
    default_penalty_huf = int(round(estimated_tax_shortfall_huf * 0.50))
    bad_faith_penalty_huf = int(round(estimated_tax_shortfall_huf * 2.0))
    delay_interest_huf = int(round(estimated_tax_shortfall_huf * 0.13 * 3.0))
    documentation_fine_huf = (
        (critical + high) * 1_250_000
        + medium * 500_000
    )
    functional_adjustment_huf = critical * 20_500_000

    base_total_huf = (
        estimated_tax_shortfall_huf
        + default_penalty_huf
        + delay_interest_huf
        + documentation_fine_huf
    )
    max_total_huf = (
        estimated_tax_shortfall_huf
        + bad_faith_penalty_huf
        + delay_interest_huf
        + documentation_fine_huf
        + functional_adjustment_huf
    )

    line_items = [
        FinancialEstimateLineItem(
            item="Becsült adóalap-kiigazítás (indikatív)",
            legal_basis="Tao. tv. 18. §; 32/2017 NGM 6. §",
            amount_huf=direct_adjustment_huf,
            notes="Súlyosság alapú proxy számítás kritikus fókuszú súlyozással.",
        ),
        FinancialEstimateLineItem(
            item="TAO adóhiány becslés (9%)",
            legal_basis="Tao. tv. 18. §",
            amount_huf=estimated_tax_shortfall_huf,
            notes="A becsült adóalap-kiigazítás 9%-a.",
        ),
        FinancialEstimateLineItem(
            item="Adóbírság (alapeset, 50%)",
            legal_basis="Art. 215. §",
            amount_huf=default_penalty_huf,
            notes="Normál együttműködési forgatókönyv.",
        ),
        FinancialEstimateLineItem(
            item="Adóbírság (rosszhiszemű, 200%)",
            legal_basis="Art. 215. § (4)",
            amount_huf=bad_faith_penalty_huf,
            notes="Maximum kockázati forgatókönyv.",
        ),
        FinancialEstimateLineItem(
            item="Késedelmi pótlék (3 év, 13%)",
            legal_basis="Art. 209. §",
            amount_huf=delay_interest_huf,
            notes="Egyszerűsített, lineáris proxy kamatszámítás.",
        ),
        FinancialEstimateLineItem(
            item="Mulasztási bírság (dokumentációs hiányok)",
            legal_basis="Art. 230. §; 32/2017 NGM 8. §",
            amount_huf=documentation_fine_huf,
            notes="Súlyosság és finding-darabszám alapján becsült keret.",
        ),
        FinancialEstimateLineItem(
            item="Funkcionális kiigazítási kockázat (worst-case)",
            legal_basis="OECD TPG 1.51–1.106",
            amount_huf=functional_adjustment_huf,
            notes="Kritikus funkcionális ellentmondások NAV-hatása.",
        ),
    ]

    return FinancialEstimate(
        line_items=line_items,
        estimated_tax_shortfall_huf=estimated_tax_shortfall_huf,
        default_penalty_huf=default_penalty_huf,
        bad_faith_penalty_huf=bad_faith_penalty_huf,
        delay_interest_huf=delay_interest_huf,
        documentation_fine_huf=documentation_fine_huf,
        functional_adjustment_huf=functional_adjustment_huf,
        base_total_huf=base_total_huf,
        max_total_huf=max_total_huf,
    )


def _build_remediation_plan(records: list[_FindingRecord]) -> RemediationPlan:
    actions: list[RemediationAction] = []

    for record in records:
        phase = _phase_for_severity(record.severity)
        due_in_days = _due_days_for_phase(phase)
        owner = _owner_for_source_type(record.source_type)

        actions.append(
            RemediationAction(
                finding_id=record.finding_id,
                finding_ref=record.finding_ref,
                severity=record.severity,
                phase=phase,
                title=record.title,
                owner=owner,
                due_in_days=due_in_days,
                recommendation=record.recommendation,
                source_type=record.source_type,
            )
        )

    actions.sort(
        key=lambda action: (
            _SEVERITY_ORDER[action.severity],
            action.finding_ref,
        )
    )

    immediate = [a for a in actions if a.phase == RemediationPhase.IMMEDIATE_30]
    short = [a for a in actions if a.phase == RemediationPhase.SHORT_90]
    mid = [a for a in actions if a.phase == RemediationPhase.MID_180]

    return RemediationPlan(
        immediate_30=immediate,
        short_90=short,
        mid_180=mid,
        all_actions=actions,
    )


def _phase_for_severity(severity: RiskSeverity) -> RemediationPhase:
    if severity == RiskSeverity.CRITICAL:
        return RemediationPhase.IMMEDIATE_30
    if severity == RiskSeverity.HIGH:
        return RemediationPhase.SHORT_90
    return RemediationPhase.MID_180


def _due_days_for_phase(phase: RemediationPhase) -> int:
    if phase == RemediationPhase.IMMEDIATE_30:
        return 30
    if phase == RemediationPhase.SHORT_90:
        return 90
    return 180


def _owner_for_source_type(source_type: SeveritySourceType) -> str:
    if source_type == "benchmark":
        return "TP tanácsadó (külső)"
    if source_type == "completeness":
        return "Adó + Jogi"
    return "Pénzügy + Adó"


def _title_from_text(text: str) -> str:
    trimmed = " ".join(text.split())
    if not trimmed:
        return "Megállapítás"

    sentence = trimmed.split(".")[0].strip()
    if len(sentence) <= 110:
        return sentence
    return sentence[:107].rstrip() + "..."


def _detect_transaction_type(text: str) -> str:
    normalized = text.casefold()

    if any(token in normalized for token in ("licenc", "royalty", "ip", "dempe")):
        return "Licencdíj (royalty)"
    if any(
        token in normalized
        for token in ("management", "menedzs", "benefit test", "kpi", "sla")
    ):
        return "Menedzsmentdíj"
    if any(
        token in normalized
        for token in ("cost-plus", "berry", "gyárt", "termel", "manufacturer")
    ):
        return "Gyártási ügylet"
    return "Egyéb ügylet"


def _recommendation_for(source_type: SeveritySourceType, description: str) -> str:
    normalized = description.casefold()

    if source_type == "benchmark":
        return (
            "Benchmark újraszámolás friss összehasonlítható mintával, "
            "IQR/median korrekcióval és a Local File primer módszerével "
            "összehangolva."
        )

    if source_type == "completeness":
        if "dempe" in normalized:
            return (
                "DEMPE-mátrix elkészítése és az IP funkciók költség/funkció "
                "alapú újraallokálása csoportszinten."
            )
        if "benefit" in normalized:
            return (
                "Benefit test dokumentálása szolgáltatás-katalógussal, "
                "deliverable-listával és mérhető üzleti hasznossági mutatókkal."
            )
        return (
            "Hiányzó kötelező elemek pótlása 32/2017 NGM megfelelőségi "
            "ellenőrzőlistával, auditálható mellékletekkel."
        )

    if "számla" in normalized or "invoice" in normalized:
        return (
            "Számlaadatok és szerződéses feltételek egyeztetése, szükség esetén "
            "helyesbítő számla és önellenőrzés indítása."
        )
    if "funkcion" in normalized:
        return (
            "FAR profil újrahangolása a tényleges döntési jogkörökhöz, majd az "
            "árazási módszer (cost-plus / TNMM) újrakalibrálása."
        )

    return (
        "Kereszt-dokumentum konzisztencia javítása és kontrollpontok beépítése "
        "a következő adóévi TP dokumentációs ciklusba."
    )
