import type {
  BackendAuditReport,
  BackendBenchmarkRisk,
  BackendConsistencyError,
  BackendEnterpriseReportPayload,
  BackendFinancialEstimate,
  BackendFinancialEstimateLineItem,
  BackendFindingSourceType,
  BackendMissingElement,
  BackendRemediationAction,
  BackendRemediationPhase,
  BackendRemediationPlan,
  BackendRiskSeverity,
  BackendSeverityBreakdown,
  BackendSeverityTransactionMatrixRow,
  BackendSeverityTypeMatrixRow,
} from './backendAudit'

type BackendFinding = BackendConsistencyError | BackendBenchmarkRisk | BackendMissingElement

interface FindingRecord {
  readonly findingId: string
  readonly findingRef: string
  readonly sourceType: BackendFindingSourceType
  readonly severity: BackendRiskSeverity
  readonly title: string
  readonly description: string
  readonly transactionType: string
  readonly recommendation: string
}

export interface EnterprisePrintableFinding {
  readonly findingId: string
  readonly findingRef: string
  readonly findingType: 'Konzisztencia' | 'Benchmark' | 'Teljesség'
  readonly severity: BackendRiskSeverity
  readonly title: string
  readonly description: string
  readonly sources: string[]
  readonly snippet: string
  readonly legalBasis: string[]
  readonly recommendation: string
}

const SEVERITY_ORDER: Record<BackendRiskSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const TRANSACTION_TYPE_ORDER = [
  'Gyártási ügylet',
  'Licencdíj (royalty)',
  'Menedzsmentdíj',
  'Egyéb ügylet',
] as const

export function buildEnterpriseReportPayload(report: BackendAuditReport): BackendEnterpriseReportPayload {
  const findingRecords = collectFindingRecords(report)
  const severityBreakdown = buildSeverityBreakdown(findingRecords)
  const severityTypeMatrix = buildSeverityTypeMatrix(findingRecords)
  const severityTransactionMatrix = buildSeverityTransactionMatrix(findingRecords)
  const financialEstimate = buildFinancialEstimate(severityBreakdown)
  const remediationPlan = buildRemediationPlan(findingRecords)

  return {
    audit_task_id: report.audit_task_id,
    session_id: report.session_id,
    generated_at: report.generated_at,
    overall_risk: report.overall_risk,
    findings_total: findingRecords.length,
    severity_breakdown: severityBreakdown,
    severity_type_matrix: severityTypeMatrix,
    severity_transaction_matrix: severityTransactionMatrix,
    financial_estimate: financialEstimate,
    remediation_plan: remediationPlan,
    source_report: report,
  }
}

export function normalizeEnterpriseFindings(
  report: BackendAuditReport,
  remediationActions: readonly BackendRemediationAction[],
): EnterprisePrintableFinding[] {
  const actionByFindingId = new Map(remediationActions.map((action) => [action.finding_id, action]))
  const findings: EnterprisePrintableFinding[] = []

  report.consistency_errors.forEach((finding, index) => {
    const action = actionByFindingId.get(finding.error_id)
    findings.push({
      findingId: finding.error_id,
      findingRef: action?.finding_ref ?? `#${index + 1}`,
      findingType: 'Konzisztencia',
      severity: finding.severity,
      title: titleFromText(finding.description) || `Konzisztencia megállapítás #${index + 1}`,
      description: finding.description,
      sources: extractFindingSources(finding),
      snippet: extractSnippet(finding),
      legalBasis: legalBasisForFinding('Konzisztencia', finding),
      recommendation:
        action?.recommendation ??
        'Kereszt-dokumentum egyeztetés és dokumentációs korrekció szükséges a következő beadási ciklus előtt.',
    })
  })

  report.benchmark_risks.forEach((finding, index) => {
    const action = actionByFindingId.get(finding.risk_id)
    findings.push({
      findingId: finding.risk_id,
      findingRef: action?.finding_ref ?? `#B${index + 1}`,
      findingType: 'Benchmark',
      severity: finding.severity,
      title: finding.metric,
      description: `${finding.rationale} Megfigyelt érték: ${finding.observed_value}. Tartomány: ${finding.benchmark_range[0]} - ${finding.benchmark_range[1]}.`,
      sources: extractFindingSources(finding),
      snippet: extractSnippet(finding),
      legalBasis: legalBasisForFinding('Benchmark', finding),
      recommendation:
        action?.recommendation ??
        'Benchmark tanulmány újraszámolása és a primer módszer következetes újradefiniálása szükséges.',
    })
  })

  report.missing_elements.forEach((finding, index) => {
    const action = actionByFindingId.get(finding.element_id)
    findings.push({
      findingId: finding.element_id,
      findingRef: action?.finding_ref ?? `#M${index + 1}`,
      findingType: 'Teljesség',
      severity: finding.severity,
      title: titleFromText(finding.description) || `Teljességi hiány #${index + 1}`,
      description: `${finding.description} Elvárt dokumentum: ${finding.expected_in}. Kötelező jogalap: ${finding.required_by}.`,
      sources: extractFindingSources(finding),
      snippet: extractSnippet(finding),
      legalBasis: legalBasisForFinding('Teljesség', finding),
      recommendation:
        action?.recommendation ??
        'Hiányzó kötelező dokumentációs elemek pótlása és belső ellenőrzőlista bevezetése szükséges.',
    })
  })

  return findings.sort((firstFinding, secondFinding) => {
    const severityDelta = SEVERITY_ORDER[firstFinding.severity] - SEVERITY_ORDER[secondFinding.severity]
    if (severityDelta !== 0) return severityDelta

    const firstRefNumber = Number.parseInt(firstFinding.findingRef.replace(/\D/g, ''), 10)
    const secondRefNumber = Number.parseInt(secondFinding.findingRef.replace(/\D/g, ''), 10)
    const safeFirstRefNumber = Number.isFinite(firstRefNumber) ? firstRefNumber : 9999
    const safeSecondRefNumber = Number.isFinite(secondRefNumber) ? secondRefNumber : 9999

    if (safeFirstRefNumber !== safeSecondRefNumber) {
      return safeFirstRefNumber - safeSecondRefNumber
    }

    return firstFinding.title.localeCompare(secondFinding.title, 'hu')
  })
}

export function formatDateHu(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString('hu-HU')
}

export function formatHuf(value: number): string {
  return `${value.toLocaleString('hu-HU')} Ft`
}

function collectFindingRecords(report: BackendAuditReport): FindingRecord[] {
  const records: FindingRecord[] = []

  for (const finding of report.consistency_errors) {
    records.push({
      findingId: finding.error_id,
      findingRef: '#0',
      sourceType: 'consistency',
      severity: finding.severity,
      title: titleFromText(finding.description),
      description: finding.description.trim(),
      transactionType: detectTransactionType(finding.description),
      recommendation: recommendationFor('consistency', finding.description),
    })
  }

  for (const finding of report.benchmark_risks) {
    const description = finding.rationale.trim() || finding.metric
    records.push({
      findingId: finding.risk_id,
      findingRef: '#0',
      sourceType: 'benchmark',
      severity: finding.severity,
      title: titleFromText(description),
      description,
      transactionType: detectTransactionType(`${finding.metric} ${description}`),
      recommendation: recommendationFor('benchmark', description),
    })
  }

  for (const finding of report.missing_elements) {
    const description = finding.description.trim()
    records.push({
      findingId: finding.element_id,
      findingRef: '#0',
      sourceType: 'completeness',
      severity: finding.severity,
      title: titleFromText(description),
      description,
      transactionType: detectTransactionType(`${finding.expected_in} ${finding.required_by} ${description}`),
      recommendation: recommendationFor('completeness', description),
    })
  }

  records.sort((firstRecord, secondRecord) => {
    const severityDelta = SEVERITY_ORDER[firstRecord.severity] - SEVERITY_ORDER[secondRecord.severity]
    if (severityDelta !== 0) return severityDelta
    const sourceDelta = firstRecord.sourceType.localeCompare(secondRecord.sourceType)
    if (sourceDelta !== 0) return sourceDelta
    return firstRecord.title.localeCompare(secondRecord.title, 'hu')
  })

  return records.map((record, index) => ({
    ...record,
    findingRef: `#${index + 1}`,
  }))
}

function buildSeverityBreakdown(records: readonly FindingRecord[]): BackendSeverityBreakdown {
  return {
    critical: records.filter((record) => record.severity === 'critical').length,
    high: records.filter((record) => record.severity === 'high').length,
    medium: records.filter((record) => record.severity === 'medium').length,
    low: records.filter((record) => record.severity === 'low').length,
  }
}

function buildSeverityTypeMatrix(records: readonly FindingRecord[]): BackendSeverityTypeMatrixRow[] {
  return (['critical', 'high', 'medium', 'low'] as const).map((severity) => {
    const consistency = records.filter(
      (record) => record.severity === severity && record.sourceType === 'consistency',
    ).length
    const benchmark = records.filter(
      (record) => record.severity === severity && record.sourceType === 'benchmark',
    ).length
    const completeness = records.filter(
      (record) => record.severity === severity && record.sourceType === 'completeness',
    ).length

    return {
      severity,
      consistency,
      benchmark,
      completeness,
      total: consistency + benchmark + completeness,
    }
  })
}

function buildSeverityTransactionMatrix(records: readonly FindingRecord[]): BackendSeverityTransactionMatrixRow[] {
  return TRANSACTION_TYPE_ORDER.flatMap((transactionType) => {
    const scopedRecords = records.filter((record) => record.transactionType === transactionType)
    if (scopedRecords.length === 0) return []

    const sortedScopedRecords = [...scopedRecords].sort(
      (firstRecord, secondRecord) => SEVERITY_ORDER[firstRecord.severity] - SEVERITY_ORDER[secondRecord.severity],
    )
    const critical = scopedRecords.filter((record) => record.severity === 'critical').length
    const high = scopedRecords.filter((record) => record.severity === 'high').length
    const medium = scopedRecords.filter((record) => record.severity === 'medium').length
    const low = scopedRecords.filter((record) => record.severity === 'low').length

    return [{
      transaction_type: transactionType,
      critical,
      high,
      medium,
      low,
      total: critical + high + medium + low,
      dominant_issue: sortedScopedRecords[0]?.title ?? 'Nincs domináns probléma',
    }]
  })
}

function buildFinancialEstimate(severityBreakdown: BackendSeverityBreakdown): BackendFinancialEstimate {
  const { critical, high, medium, low } = severityBreakdown
  const directAdjustmentHuf = critical * 27_500_000 + high * 6_000_000 + medium * 1_500_000 + low * 400_000
  const estimatedTaxShortfallHuf = Math.round(directAdjustmentHuf * 0.09)
  const defaultPenaltyHuf = Math.round(estimatedTaxShortfallHuf * 0.5)
  const badFaithPenaltyHuf = Math.round(estimatedTaxShortfallHuf * 2)
  const delayInterestHuf = Math.round(estimatedTaxShortfallHuf * 0.13 * 3)
  const documentationFineHuf = (critical + high) * 1_250_000 + medium * 500_000
  const functionalAdjustmentHuf = critical * 20_500_000
  const baseTotalHuf = estimatedTaxShortfallHuf + defaultPenaltyHuf + delayInterestHuf + documentationFineHuf
  const maxTotalHuf = estimatedTaxShortfallHuf + badFaithPenaltyHuf + delayInterestHuf + documentationFineHuf + functionalAdjustmentHuf

  const lineItems: BackendFinancialEstimateLineItem[] = [
    {
      item: 'Becsült adóalap-kiigazítás (indikatív)',
      legal_basis: 'Tao. tv. 18. §; 32/2017 NGM 6. §',
      amount_huf: directAdjustmentHuf,
      notes: 'Súlyosság alapú proxy számítás kritikus fókuszú súlyozással.',
    },
    {
      item: 'TAO adóhiány becslés (9%)',
      legal_basis: 'Tao. tv. 18. §',
      amount_huf: estimatedTaxShortfallHuf,
      notes: 'A becsült adóalap-kiigazítás 9%-a.',
    },
    {
      item: 'Adóbírság (alapeset, 50%)',
      legal_basis: 'Art. 215. §',
      amount_huf: defaultPenaltyHuf,
      notes: 'Normál együttműködési forgatókönyv.',
    },
    {
      item: 'Adóbírság (rosszhiszemű, 200%)',
      legal_basis: 'Art. 215. § (4)',
      amount_huf: badFaithPenaltyHuf,
      notes: 'Maximum kockázati forgatókönyv.',
    },
    {
      item: 'Késedelmi pótlék (3 év, 13%)',
      legal_basis: 'Art. 209. §',
      amount_huf: delayInterestHuf,
      notes: 'Egyszerűsített, lineáris proxy kamatszámítás.',
    },
    {
      item: 'Mulasztási bírság (dokumentációs hiányok)',
      legal_basis: 'Art. 230. §; 32/2017 NGM 8. §',
      amount_huf: documentationFineHuf,
      notes: 'Súlyosság és finding-darabszám alapján becsült keret.',
    },
    {
      item: 'Funkcionális kiigazítási kockázat (worst-case)',
      legal_basis: 'OECD TPG 1.51-1.106',
      amount_huf: functionalAdjustmentHuf,
      notes: 'Kritikus funkcionális ellentmondások NAV-hatása.',
    },
  ]

  return {
    line_items: lineItems,
    estimated_tax_shortfall_huf: estimatedTaxShortfallHuf,
    default_penalty_huf: defaultPenaltyHuf,
    bad_faith_penalty_huf: badFaithPenaltyHuf,
    delay_interest_huf: delayInterestHuf,
    documentation_fine_huf: documentationFineHuf,
    functional_adjustment_huf: functionalAdjustmentHuf,
    base_total_huf: baseTotalHuf,
    max_total_huf: maxTotalHuf,
  }
}

function buildRemediationPlan(records: readonly FindingRecord[]): BackendRemediationPlan {
  const allActions = records
    .map<BackendRemediationAction>((record) => {
      const phase = phaseForSeverity(record.severity)
      return {
        finding_id: record.findingId,
        finding_ref: record.findingRef,
        severity: record.severity,
        phase,
        title: record.title,
        owner: ownerForSourceType(record.sourceType),
        due_in_days: dueDaysForPhase(phase),
        recommendation: record.recommendation,
        source_type: record.sourceType,
      }
    })
    .sort((firstAction, secondAction) => {
      const severityDelta = SEVERITY_ORDER[firstAction.severity] - SEVERITY_ORDER[secondAction.severity]
      if (severityDelta !== 0) return severityDelta
      return firstAction.finding_ref.localeCompare(secondAction.finding_ref, 'hu')
    })

  return {
    immediate_30: allActions.filter((action) => action.phase === 'immediate_30'),
    short_90: allActions.filter((action) => action.phase === 'short_90'),
    mid_180: allActions.filter((action) => action.phase === 'mid_180'),
    all_actions: allActions,
  }
}

function titleFromText(text: string): string {
  const normalized = text.trim().replace(/\s+/g, ' ')
  const firstSentence = normalized.split(/[.!?]/)[0]?.trim() ?? ''
  if (firstSentence.length <= 96) return firstSentence
  return `${firstSentence.slice(0, 93).trim()}...`
}

function detectTransactionType(text: string): string {
  const normalized = text.toLowerCase()
  if (/licenc|royalty|know-how|dempe/.test(normalized)) return 'Licencdíj (royalty)'
  if (/management|menedzsment|szolgáltatás|benefit/.test(normalized)) return 'Menedzsmentdíj'
  if (/gyárt|cost-plus|berry|benchmark|tnmm|termel/.test(normalized)) return 'Gyártási ügylet'
  return 'Egyéb ügylet'
}

function recommendationFor(sourceType: BackendFindingSourceType, description: string): string {
  const normalized = description.toLowerCase()

  if (sourceType === 'benchmark') {
    return 'Benchmark tanulmány újraszámolása, IQR pozíció validálása és a Local File módszertani narratívájának egyeztetése szükséges.'
  }

  if (sourceType === 'completeness') {
    return normalized.includes('dempe')
      ? 'DEMPE-funkciók, kockázatok és hozamjogosultságok tételes pótlása szükséges a Local File-ban.'
      : 'Hiányzó kötelező dokumentációs elem pótlása és belső review checklist bevezetése szükséges.'
  }

  if (normalized.includes('licenc') || normalized.includes('50.000.000')) {
    return 'Szerződés, számla és Local File összevezetése szükséges; a ténylegesen könyvelt összeghez igazított korrekciót dokumentálni kell.'
  }

  return 'Kereszt-dokumentum egyeztetés, forráshivatkozások frissítése és emberi szakértői jóváhagyás szükséges.'
}

function phaseForSeverity(severity: BackendRiskSeverity): BackendRemediationPhase {
  if (severity === 'critical') return 'immediate_30'
  if (severity === 'high') return 'short_90'
  return 'mid_180'
}

function dueDaysForPhase(phase: BackendRemediationPhase): number {
  if (phase === 'immediate_30') return 30
  if (phase === 'short_90') return 90
  return 180
}

function ownerForSourceType(sourceType: BackendFindingSourceType): string {
  if (sourceType === 'benchmark') return 'TP benchmark owner'
  if (sourceType === 'completeness') return 'TP documentation owner'
  return 'Tax controllership'
}

function extractFindingSources(finding: BackendFinding): string[] {
  const locationSources = 'locations' in finding
    ? finding.locations.map((location) => {
        const lines = location.line_numbers?.length ? ` (${location.line_numbers.join(', ')}. sor)` : ''
        return `${location.filename}${lines}`
      })
    : []

  const evidenceSources = finding.attribution?.evidence_chunks?.map((chunk) => {
    const page = chunk.page >= 0 ? ` · ${chunk.page}. oldal` : ''
    return `${chunk.filename}${page}`
  }) ?? []

  return [...new Set([...locationSources, ...evidenceSources])]
}

function extractSnippet(finding: BackendFinding): string {
  if ('evidence' in finding && finding.evidence) {
    return finding.evidence
  }

  const quotedChunk = finding.attribution?.evidence_chunks?.find((chunk) => chunk.quote)
  if (quotedChunk?.quote) {
    return quotedChunk.quote
  }

  return 'A forrásszöveg részlet nem áll rendelkezésre a jelen payloadban.'
}

function legalBasisForFinding(
  findingType: EnterprisePrintableFinding['findingType'],
  finding: BackendFinding,
): string[] {
  const legalReferences = finding.attribution?.legal_references?.filter((reference) => reference.trim().length > 0) ?? []
  if (legalReferences.length > 0) return legalReferences

  if (findingType === 'Benchmark') {
    return [
      '32/2017 NGM 6. § - IQR / median korrekció',
      'Tao. tv. 18. § (2) - szokásos piaci tartomány',
      'OECD TPG 3.55-3.66 - interkvartilis értelmezés',
    ]
  }

  if (findingType === 'Teljesség') {
    return [
      '32/2017 NGM 4. § (1) - kötelező dokumentációs elemek',
      'Art. 230. § - mulasztási bírság',
      'OECD TPG Ch. VII - intra-group service dokumentáció',
    ]
  }

  return [
    '32/2017 NGM 4. § (1) f) - tényadat konzisztencia',
    'Tao. tv. 18. § (1) - kapcsolt ügyletek árazása',
    'Art. 215. § - adóhiány és adóbírság',
  ]
}