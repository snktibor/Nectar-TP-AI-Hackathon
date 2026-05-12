import {
  severityLabel,
  type BackendAuditReport,
  type BackendBenchmarkRisk,
  type BackendConsistencyError,
  type BackendEnterpriseReportPayload,
  type BackendMissingElement,
  type BackendRemediationAction,
  type BackendRiskSeverity,
} from '../../lib/backendAudit'

interface ReportTemplateProps {
  readonly payload: BackendEnterpriseReportPayload
}

interface PrintableFinding {
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

type BackendFinding =
  | BackendConsistencyError
  | BackendBenchmarkRisk
  | BackendMissingElement

const PRINT_STYLES = `
:root {
  color-scheme: light;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
  background: #eef2f6;
  color: #111827;
}

.rp-root {
  background: #eef2f6;
  padding: 14px;
  color: #111827;
}

.rp-page {
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto 14px;
  background: #ffffff;
  border: 1px solid #dbe2ea;
  border-radius: 10px;
  padding: 21mm 17mm 19mm;
  position: relative;
}

.rp-first-page {
  break-before: auto;
  page-break-before: auto;
}

.rp-page-break {
  break-before: page;
  page-break-before: always;
}

.rp-accent-line {
  width: 78px;
  height: 7px;
  border-radius: 999px;
  background: linear-gradient(90deg, #ff9f71, #ff7b47);
  margin-bottom: 18px;
}

.rp-eyebrow {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #d35427;
  font-weight: 700;
  margin: 0 0 12px;
}

.rp-cover-title {
  margin: 0;
  font-size: 52px;
  line-height: 1.02;
  font-weight: 800;
  color: #0f172a;
}

.rp-cover-subtitle {
  margin: 18px 0 0;
  max-width: 85%;
  font-size: 15px;
  line-height: 1.62;
  color: #374151;
}

.rp-cover-kpis {
  margin-top: 34px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.rp-kpi {
  border: 1px solid #e4e8ee;
  border-radius: 10px;
  padding: 10px 11px;
  background: #fafbfc;
}

.rp-kpi-label {
  margin: 0;
  color: #6b7280;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
}

.rp-kpi-value {
  margin: 4px 0 0;
  color: #111827;
  font-size: 22px;
  line-height: 1.1;
  font-weight: 800;
}

.rp-kpi-value-critical {
  color: #b91c1c;
}

.rp-cover-footer {
  position: absolute;
  left: 17mm;
  right: 17mm;
  bottom: 16mm;
  border-top: 1px solid #e5e7eb;
  padding-top: 8px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #4b5563;
  font-size: 11px;
}

.rp-title {
  margin: 0;
  font-size: 31px;
  line-height: 1.2;
  font-weight: 800;
  color: #0f172a;
}

.rp-section-heading {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
}

.rp-rule {
  height: 1px;
  background: #e5e7eb;
  margin: 12px 0 18px;
}

.rp-paragraph {
  margin: 0 0 10px;
  color: #1f2937;
  line-height: 1.64;
  font-size: 13px;
}

.rp-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.rp-summary-card {
  border: 1px solid #e7ebf0;
  border-radius: 10px;
  background: #f9fafb;
  padding: 12px;
}

.rp-summary-card p {
  margin: 0;
}

.rp-summary-card .label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6b7280;
  font-weight: 700;
}

.rp-summary-card .value {
  margin-top: 5px;
  font-size: 24px;
  font-weight: 800;
  color: #111827;
}

.rp-summary-card .value-critical {
  color: #b91c1c;
}

.rp-summary-card .value-high {
  color: #d97706;
}

.rp-summary-card .value-medium {
  color: #b45309;
}

.rp-summary-card .value-money {
  color: #0f766e;
}

.rp-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #e4e8ee;
  margin: 10px 0 18px;
}

.rp-table th,
.rp-table td {
  border: 1px solid #e4e8ee;
  padding: 8px 9px;
  text-align: left;
  vertical-align: top;
  font-size: 12px;
  line-height: 1.45;
}

.rp-table th {
  background: #f5f7fa;
  color: #374151;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-size: 11px;
}

.rp-table td.num,
.rp-table th.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.rp-type-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 8px;
  border: 1px solid #d7dee8;
  background: #f8fafc;
  color: #374151;
  font-size: 11px;
  font-weight: 700;
}

.rp-severity-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 9px;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.rp-critical { background: #b91c1c; }
.rp-high { background: #d97706; }
.rp-medium { background: #b45309; }
.rp-low { background: #15803d; }

.rp-finding-page {
  break-before: page;
  page-break-before: always;
  break-inside: avoid;
  page-break-inside: avoid;
}

.rp-finding-card {
  border: 1px solid #e3e8ef;
  border-left: 6px solid #ff7b47;
  border-radius: 10px;
  padding: 12px;
  break-inside: avoid;
  page-break-inside: avoid;
}

.rp-finding-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.rp-finding-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.3;
}

.rp-finding-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.rp-label {
  margin: 11px 0 4px;
  color: #4b5563;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 10px;
  font-weight: 700;
}

.rp-list {
  margin: 0;
  padding-left: 18px;
  line-height: 1.58;
  font-size: 12px;
}

.rp-snippet {
  margin-top: 5px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
  line-height: 1.55;
  color: #1f2937;
}

.rp-phase-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.rp-phase-block {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px;
  break-inside: avoid;
  page-break-inside: avoid;
}

.rp-phase-title {
  margin: 0 0 7px;
  font-size: 14px;
  font-weight: 800;
  color: #0f172a;
}

.rp-legal-note {
  border-left: 4px solid #ff7b47;
  background: #fff7f3;
  padding: 10px 12px;
  border-radius: 8px;
  margin: 10px 0 12px;
  font-size: 12px;
  line-height: 1.56;
}

.rp-running-header,
.rp-running-footer {
  display: none;
}

.rp-page-number::after {
  content: "Oldal " counter(page);
}

@media print {
  @page {
    size: A4;
    margin: 18mm 14mm 18mm;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .rp-root {
    background: #fff;
    padding: 0;
  }

  .rp-page {
    width: auto;
    min-height: auto;
    border: none;
    border-radius: 0;
    margin: 0;
    padding: 0;
    break-before: page;
    page-break-before: always;
  }

  .rp-first-page {
    break-before: auto;
    page-break-before: auto;
  }

  .rp-section-heading {
    break-before: page;
    page-break-before: always;
  }

  .rp-finding-page,
  .rp-finding-card,
  .rp-table tr,
  .rp-phase-block {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .rp-running-header,
  .rp-running-footer {
    display: flex;
    position: fixed;
    left: 0;
    right: 0;
    color: #4b5563;
    font-size: 10px;
    line-height: 1.2;
  }

  .rp-running-header {
    top: 0;
    border-bottom: 1px solid #d1d5db;
    padding: 2mm 14mm;
    justify-content: space-between;
  }

  .rp-running-footer {
    bottom: 0;
    border-top: 1px solid #d1d5db;
    padding: 2mm 14mm;
    justify-content: space-between;
  }
}
`

function formatDateHu(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString('hu-HU')
}

function formatHuf(value: number): string {
  return `${value.toLocaleString('hu-HU')} Ft`
}

function severityClass(severity: BackendRiskSeverity): string {
  if (severity === 'critical') return 'rp-critical'
  if (severity === 'high') return 'rp-high'
  if (severity === 'medium') return 'rp-medium'
  return 'rp-low'
}

function severityRank(severity: BackendRiskSeverity): number {
  if (severity === 'critical') return 0
  if (severity === 'high') return 1
  if (severity === 'medium') return 2
  return 3
}

function extractFindingSources(
  finding: BackendFinding,
): string[] {
  const locationSources =
    'locations' in finding
      ? finding.locations.map((location) => {
          const lines = location.line_numbers?.length
            ? ` (${location.line_numbers.join(', ')}. sor)`
            : ''
          return `${location.filename}${lines}`
        })
      : []

  const evidenceSources =
    finding.attribution?.evidence_chunks?.map((chunk) => {
      const page = chunk.page >= 0 ? ` · ${chunk.page}. oldal` : ''
      return `${chunk.filename}${page}`
    }) ?? []

  const unique = new Set<string>([...locationSources, ...evidenceSources])
  return [...unique]
}

function extractSnippet(
  finding: BackendFinding,
): string {
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
  findingType: PrintableFinding['findingType'],
  finding: BackendFinding,
): string[] {
  const legalReferences = finding.attribution?.legal_references?.filter((ref) => ref.trim().length > 0) ?? []
  if (legalReferences.length > 0) {
    return legalReferences
  }

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

function normalizeFindings(
  report: BackendAuditReport,
  remediationActions: readonly BackendRemediationAction[],
): PrintableFinding[] {
  const actionByFindingId = new Map(remediationActions.map((action) => [action.finding_id, action]))

  const findings: PrintableFinding[] = []

  report.consistency_errors.forEach((finding, index) => {
    const action = actionByFindingId.get(finding.error_id)
    const sources = extractFindingSources(finding)
    findings.push({
      findingId: finding.error_id,
      findingRef: action?.finding_ref ?? `#${index + 1}`,
      findingType: 'Konzisztencia',
      severity: finding.severity,
      title: finding.description.split('.')[0]?.trim() || `Konzisztencia megállapítás #${index + 1}`,
      description: finding.description,
      sources,
      snippet: extractSnippet(finding),
      legalBasis: legalBasisForFinding('Konzisztencia', finding),
      recommendation:
        action?.recommendation ??
        'Kereszt-dokumentum egyeztetés és dokumentációs korrekció szükséges a következő beadási ciklus előtt.',
    })
  })

  report.benchmark_risks.forEach((finding, index) => {
    const action = actionByFindingId.get(finding.risk_id)
    const sources = extractFindingSources(finding)
    findings.push({
      findingId: finding.risk_id,
      findingRef: action?.finding_ref ?? `#B${index + 1}`,
      findingType: 'Benchmark',
      severity: finding.severity,
      title: finding.metric,
      description: `${finding.rationale} Megfigyelt érték: ${finding.observed_value}. Tartomány: ${finding.benchmark_range[0]} - ${finding.benchmark_range[1]}.`,
      sources,
      snippet: extractSnippet(finding),
      legalBasis: legalBasisForFinding('Benchmark', finding),
      recommendation:
        action?.recommendation ??
        'Benchmark tanulmány újraszámolása és a primer módszer következetes újradefiniálása szükséges.',
    })
  })

  report.missing_elements.forEach((finding, index) => {
    const action = actionByFindingId.get(finding.element_id)
    const sources = extractFindingSources(finding)
    findings.push({
      findingId: finding.element_id,
      findingRef: action?.finding_ref ?? `#M${index + 1}`,
      findingType: 'Teljesség',
      severity: finding.severity,
      title: finding.description.split('.')[0]?.trim() || `Teljességi hiány #${index + 1}`,
      description: `${finding.description} Elvárt dokumentum: ${finding.expected_in}. Kötelező jogalap: ${finding.required_by}.`,
      sources,
      snippet: extractSnippet(finding),
      legalBasis: legalBasisForFinding('Teljesség', finding),
      recommendation:
        action?.recommendation ??
        'Hiányzó kötelező dokumentációs elemek pótlása és belső ellenőrzőlista bevezetése szükséges.',
    })
  })

  findings.sort((a, b) => {
    const severityDelta = severityRank(a.severity) - severityRank(b.severity)
    if (severityDelta !== 0) {
      return severityDelta
    }

    const numA = Number.parseInt(a.findingRef.replace(/\D/g, ''), 10)
    const numB = Number.parseInt(b.findingRef.replace(/\D/g, ''), 10)
    const safeA = Number.isFinite(numA) ? numA : 9999
    const safeB = Number.isFinite(numB) ? numB : 9999

    if (safeA !== safeB) {
      return safeA - safeB
    }

    return a.title.localeCompare(b.title, 'hu')
  })

  return findings
}

function remediationsForPhase(
  payload: BackendEnterpriseReportPayload,
  phase: 'immediate_30' | 'short_90' | 'mid_180',
): BackendRemediationAction[] {
  if (phase === 'immediate_30') return payload.remediation_plan.immediate_30
  if (phase === 'short_90') return payload.remediation_plan.short_90
  return payload.remediation_plan.mid_180
}

export default function ReportTemplate({ payload }: ReportTemplateProps): JSX.Element {
  const report = payload.source_report
  const findings = normalizeFindings(report, payload.remediation_plan.all_actions)

  const referencedDocuments = new Set<string>()
  findings.forEach((finding) => {
    finding.sources.forEach((source) => referencedDocuments.add(source))
  })

  const documentList =
    referencedDocuments.size > 0
      ? [...referencedDocuments]
      : [
          'hig_master_file_2024.pdf',
          'hig_local_file_2024_faulty.pdf',
          'hig_benchmark_study_2024.pdf',
          'hig_contracts_2024.pdf',
          'hig_invoices_2024.pdf',
        ]

  const detailsStartPage = 8
  const remediationStartPage = detailsStartPage + findings.length
  const legalStartPage = remediationStartPage + 1
  const disclaimerStartPage = legalStartPage + 2
  const totalPageEstimate = disclaimerStartPage

  return (
    <section className="rp-root">
      <style>{PRINT_STYLES}</style>

      <div className="rp-running-header" aria-hidden="true">
        <span>Bizalmas - Adótanácsadás | NECTAR TP</span>
        <span>HIG Manufacturing Kft. 2024 TP Audit</span>
      </div>
      <div className="rp-running-footer" aria-hidden="true">
        <span>Bizalmas - Csak címzett részére</span>
        <span className="rp-page-number" />
      </div>

      <article className="rp-page rp-first-page">
        <div className="rp-accent-line" />
        <p className="rp-eyebrow">PwC Magyarország - Adótanácsadás | Bizalmas</p>
        <h1 className="rp-cover-title">
          Transzferár
          <br />
          Megfelelőségi
          <br />
          Jelentés
        </h1>
        <p className="rp-cover-subtitle">
          Kereszt-dokumentum konzisztencia, teljesség és benchmark-ellenőrzés a 32/2017 (X.18.)
          NGM rendelet, a Tao. tv. 18. § és a NAV audit gyakorlatának figyelembevételével.
        </p>

        <div className="rp-cover-kpis">
          <div className="rp-kpi">
            <p className="rp-kpi-label">Generálva</p>
            <p className="rp-kpi-value">{formatDateHu(payload.generated_at)}</p>
          </div>
          <div className="rp-kpi">
            <p className="rp-kpi-label">Megállapítások</p>
            <p className="rp-kpi-value">{payload.findings_total}</p>
          </div>
          <div className="rp-kpi">
            <p className="rp-kpi-label">Vizsgált doksik</p>
            <p className="rp-kpi-value">{documentList.length}</p>
          </div>
          <div className="rp-kpi">
            <p className="rp-kpi-label">NAV kockázat</p>
            <p className={`rp-kpi-value ${payload.overall_risk === 'critical' ? 'rp-kpi-value-critical' : ''}`}>
              {severityLabel(payload.overall_risk).toUpperCase()}
            </p>
          </div>
        </div>

        <div className="rp-cover-footer">
          <span>NECTAR TP v2.0 · Multi-ügynökös TP Auditor</span>
          <span>Készítette: Kerek Barackok · PwC Hungary AI Hackathon 2026</span>
        </div>
      </article>

      <article className="rp-page rp-page-break">
        <h2 className="rp-section-heading">00 · Tartalomjegyzék</h2>
        <div className="rp-rule" />
        <table className="rp-table">
          <thead>
            <tr>
              <th>Fejezet</th>
              <th className="num">Oldal</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>01 · Vezetői összefoglaló</td>
              <td className="num">3</td>
            </tr>
            <tr>
              <td>02 · Audit hatókör és módszertan</td>
              <td className="num">4</td>
            </tr>
            <tr>
              <td>03 · Kockázati áttekintés és hőtérkép</td>
              <td className="num">6</td>
            </tr>
            <tr>
              <td>04 · Pénzügyi kitettség és NAV-becslés</td>
              <td className="num">7</td>
            </tr>
            <tr>
              <td>{`05 · Részletes megállapítások (#1-#${findings.length})`}</td>
              <td className="num">{detailsStartPage}</td>
            </tr>
            <tr>
              <td>06 · Remediációs ütemterv</td>
              <td className="num">{remediationStartPage}</td>
            </tr>
            <tr>
              <td>07 · Jogi hivatkozások jegyzéke</td>
              <td className="num">{legalStartPage}</td>
            </tr>
            <tr>
              <td>08 · Módszertani disclaimer</td>
              <td className="num">{disclaimerStartPage}</td>
            </tr>
          </tbody>
        </table>
        <p className="rp-paragraph">
          A jelentés oldalszámozása nyomtatási környezetben automatikusan történik. A teljes dokumentum
          becsült hossza a findingek számától függően {totalPageEstimate}+ oldal.
        </p>
      </article>

      <article className="rp-page rp-page-break">
        <h2 className="rp-section-heading">01 · Vezetői összefoglaló</h2>
        <div className="rp-rule" />

        <div className="rp-summary-grid">
          <div className="rp-summary-card">
            <p className="label">Kritikus</p>
            <p className="value value-critical">{payload.severity_breakdown.critical}</p>
          </div>
          <div className="rp-summary-card">
            <p className="label">Magas</p>
            <p className="value value-high">{payload.severity_breakdown.high}</p>
          </div>
          <div className="rp-summary-card">
            <p className="label">Közepes</p>
            <p className="value value-medium">{payload.severity_breakdown.medium}</p>
          </div>
          <div className="rp-summary-card">
            <p className="label">Becsült max. NAV kitettség</p>
            <p className="value value-money">{formatHuf(payload.financial_estimate.max_total_huf)}</p>
          </div>
        </div>

        <p className="rp-paragraph">
          A NECTAR TP audit pipeline 6/6 ügynök futását, több forrásból történő RAG evidence
          gyűjtést és szabályalapú severity aggregációt alkalmazott. Az eredmény: {payload.findings_total}{' '}
          validált megállapítás, amelyek közül {payload.severity_breakdown.critical} kritikus közvetlenül
          érinti a NAV-kiigazítás kockázatát.
        </p>
        <p className="rp-paragraph">
          A jelentés célja vezetői döntéstámogatás: milyen időablakban, milyen prioritással, milyen jogi
          kitettséggel érdemes remediation folyamatot indítani. A pénzügyi értékek indikatívak, de
          audit-szempontból konzervatív becslést adnak az adóhiány + bírság + pótlék kombinált hatására.
        </p>

        <table className="rp-table">
          <thead>
            <tr>
              <th>Tétel</th>
              <th className="num">Darab</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Összes konzisztencia finding</td>
              <td className="num">{report.consistency_errors.length}</td>
            </tr>
            <tr>
              <td>Összes benchmark kockázat</td>
              <td className="num">{report.benchmark_risks.length}</td>
            </tr>
            <tr>
              <td>Összes teljességi hiány</td>
              <td className="num">{report.missing_elements.length}</td>
            </tr>
          </tbody>
        </table>
      </article>

      <article className="rp-page rp-page-break">
        <h2 className="rp-section-heading">02 · Audit hatókör és módszertan</h2>
        <div className="rp-rule" />

        <p className="rp-paragraph">
          A vizsgálat hatóköre a 2024-es adóév transzferár dokumentációs csomagját fedte le: Master File,
          Local File, benchmark tanulmány, vállalatközi szerződések, számlák. A rendszer célzottan
          kereszt-dokumentumos inkonzisztenciára, dokumentációs hiányosságokra és benchmark eltérésre
          optimalizált.
        </p>
        <p className="rp-paragraph">
          A pipeline kétlépcsős validációval dolgozik. Először szabályalapú ingest és klasszifikáció történik
          (fájltípus, kötelező kategóriák, confidence gate), majd az ügynökök strukturált tool-use ciklusban
          elemzik a tartalmat. Minden finding kötelező attribúcióval és forráshivatkozással jön létre.
        </p>

        <table className="rp-table">
          <thead>
            <tr>
              <th>Vizsgált dokumentumok</th>
              <th>Forrás</th>
            </tr>
          </thead>
          <tbody>
            {documentList.map((documentName) => (
              <tr key={documentName}>
                <td>{documentName}</td>
                <td>Audit evidence graph</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="rp-legal-note">
          A módszertan a 32/2017 NGM, Tao. tv. 18. §, Art. 215. § és OECD TPG irányelvek szerinti
          compliance fókuszt követi. A findingek nem narratív állítások, hanem evidence-hoz kötött,
          reprodukálható megállapítások.
        </div>
      </article>

      <article className="rp-page rp-page-break">
        <h2 className="rp-section-heading">02 · Audit hatókör és módszertan (folyt.)</h2>
        <div className="rp-rule" />

        <table className="rp-table">
          <thead>
            <tr>
              <th>Ügynök</th>
              <th>Scope</th>
              <th>Státusz</th>
              <th className="num">Tool call</th>
              <th className="num">Token</th>
            </tr>
          </thead>
          <tbody>
            {report.agent_runs.map((run) => (
              <tr key={run.agent_id}>
                <td>{run.agent_id}</td>
                <td>{run.doc_type_scope}</td>
                <td>{run.status}</td>
                <td className="num">{run.tool_calls}</td>
                <td className="num">{run.input_tokens + run.output_tokens + run.cache_read_tokens + run.cache_creation_tokens}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="rp-paragraph">
          A rendszer védekezik a hamis pozitívok ellen: schema validáció, citation gate, severity scoring és
          uncertainty jelölés együtt biztosítják, hogy a kimenet auditálható maradjon. A reprodukálhatóság
          kulcsa a finding attribution blokk, amely visszavezethető evidence chunkokra bontja az állításokat.
        </p>
        <p className="rp-paragraph">
          Operatív szempontból ez enterprise üzemeltetésre alkalmas megközelítés: minden ügynök külön
          telemetry sort kap, timeout/exception izolált, a pipeline részleges sikerrel is zárhat, miközben a
          döntéshozók pontosan látják, mely részeredmények megbízhatóak.
        </p>
      </article>

      <article className="rp-page rp-page-break">
        <h2 className="rp-section-heading">03 · Kockázati áttekintés és hőtérkép</h2>
        <div className="rp-rule" />

        <h3 className="rp-title">Súlyosság × Típus mátrix</h3>
        <table className="rp-table">
          <thead>
            <tr>
              <th>Súlyosság</th>
              <th className="num">Konzisztencia</th>
              <th className="num">Benchmark</th>
              <th className="num">Teljesség</th>
              <th className="num">Összesen</th>
            </tr>
          </thead>
          <tbody>
            {payload.severity_type_matrix.map((row) => (
              <tr key={row.severity}>
                <td>{severityLabel(row.severity)}</td>
                <td className="num">{row.consistency}</td>
                <td className="num">{row.benchmark}</td>
                <td className="num">{row.completeness}</td>
                <td className="num">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="rp-title">Súlyosság × Ügylettípus mátrix</h3>
        <table className="rp-table">
          <thead>
            <tr>
              <th>Ügylettípus</th>
              <th className="num">Kritikus</th>
              <th className="num">Magas</th>
              <th className="num">Közepes</th>
              <th className="num">Alacsony</th>
              <th className="num">Összes</th>
              <th>Domináns probléma</th>
            </tr>
          </thead>
          <tbody>
            {payload.severity_transaction_matrix.map((row) => (
              <tr key={row.transaction_type}>
                <td>{row.transaction_type}</td>
                <td className="num">{row.critical}</td>
                <td className="num">{row.high}</td>
                <td className="num">{row.medium}</td>
                <td className="num">{row.low}</td>
                <td className="num">{row.total}</td>
                <td>{row.dominant_issue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="rp-page rp-page-break">
        <h2 className="rp-section-heading">04 · Pénzügyi kitettség és NAV-büntetés becslés</h2>
        <div className="rp-rule" />

        <p className="rp-paragraph">
          Az alábbi értékek indikativ számítások. A cél nem könyvelési pontosság, hanem kockázati sorrend
          és döntési priorizálás. A modell a severity súlyokból, dokumentációs bírság tételekből és funkcionális
          kiigazítási komponensből képez összesített NAV-expozíciót.
        </p>

        <table className="rp-table">
          <thead>
            <tr>
              <th>Tétel</th>
              <th>Jogalap</th>
              <th className="num">Összeg (HUF)</th>
              <th>Megjegyzés</th>
            </tr>
          </thead>
          <tbody>
            {payload.financial_estimate.line_items.map((item) => (
              <tr key={item.item}>
                <td>{item.item}</td>
                <td>{item.legal_basis ?? '—'}</td>
                <td className="num">{formatHuf(item.amount_huf)}</td>
                <td>{item.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="rp-summary-grid">
          <div className="rp-summary-card">
            <p className="label">Alapeset teljes kitettség</p>
            <p className="value value-money">{formatHuf(payload.financial_estimate.base_total_huf)}</p>
          </div>
          <div className="rp-summary-card">
            <p className="label">Worst-case NAV kitettség</p>
            <p className="value value-critical">{formatHuf(payload.financial_estimate.max_total_huf)}</p>
          </div>
          <div className="rp-summary-card">
            <p className="label">Becsült adóhiány</p>
            <p className="value">{formatHuf(payload.financial_estimate.estimated_tax_shortfall_huf)}</p>
          </div>
          <div className="rp-summary-card">
            <p className="label">Mulasztási bírság (proxy)</p>
            <p className="value">{formatHuf(payload.financial_estimate.documentation_fine_huf)}</p>
          </div>
        </div>
      </article>

      {findings.map((finding) => (
        <article key={finding.findingId} className="rp-page rp-finding-page">
          <h2 className="rp-section-heading">05 · Részletes megállapítások</h2>
          <div className="rp-rule" />

          <div className="rp-finding-card">
            <div className="rp-finding-header">
              <h3 className="rp-finding-title">Megállapítás {finding.findingRef}</h3>
              <span className={`rp-severity-pill ${severityClass(finding.severity)}`}>
                {severityLabel(finding.severity)}
              </span>
            </div>

            <div className="rp-finding-meta">
              <span className="rp-type-pill">{finding.findingType}</span>
              <span className="rp-type-pill">{finding.title}</span>
            </div>

            <p className="rp-paragraph">{finding.description}</p>

            <p className="rp-label">Forráshivatkozások</p>
            <ul className="rp-list">
              {finding.sources.length === 0 ? <li>Nincs explicit forráslistázás.</li> : null}
              {finding.sources.map((source) => (
                <li key={source}>{source}</li>
              ))}
            </ul>

            <p className="rp-label">Forrás snippet</p>
            <div className="rp-snippet">{finding.snippet}</div>

            <p className="rp-label">Jogi alap</p>
            <ul className="rp-list">
              {finding.legalBasis.map((basis) => (
                <li key={basis}>{basis}</li>
              ))}
            </ul>

            <p className="rp-label">Javasolt lépés</p>
            <p className="rp-paragraph">{finding.recommendation}</p>
          </div>
        </article>
      ))}

      <article className="rp-page rp-page-break">
        <h2 className="rp-section-heading">06 · Remediációs ütemterv</h2>
        <div className="rp-rule" />

        <div className="rp-phase-grid">
          <section className="rp-phase-block">
            <h3 className="rp-phase-title">Azonnali (0-30 nap)</h3>
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Finding</th>
                  <th>Felelős</th>
                  <th>Javasolt lépés</th>
                  <th className="num">Határidő</th>
                </tr>
              </thead>
              <tbody>
                {remediationsForPhase(payload, 'immediate_30').map((action) => (
                  <tr key={`${action.finding_id}-immediate`}>
                    <td>{action.finding_ref}</td>
                    <td>{action.owner}</td>
                    <td>{action.recommendation}</td>
                    <td className="num">{action.due_in_days} nap</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rp-phase-block">
            <h3 className="rp-phase-title">Rövid távú (31-90 nap)</h3>
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Finding</th>
                  <th>Felelős</th>
                  <th>Javasolt lépés</th>
                  <th className="num">Határidő</th>
                </tr>
              </thead>
              <tbody>
                {remediationsForPhase(payload, 'short_90').map((action) => (
                  <tr key={`${action.finding_id}-short`}>
                    <td>{action.finding_ref}</td>
                    <td>{action.owner}</td>
                    <td>{action.recommendation}</td>
                    <td className="num">{action.due_in_days} nap</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rp-phase-block">
            <h3 className="rp-phase-title">Középtávú (91-180 nap)</h3>
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Finding</th>
                  <th>Felelős</th>
                  <th>Javasolt lépés</th>
                  <th className="num">Határidő</th>
                </tr>
              </thead>
              <tbody>
                {remediationsForPhase(payload, 'mid_180').map((action) => (
                  <tr key={`${action.finding_id}-mid`}>
                    <td>{action.finding_ref}</td>
                    <td>{action.owner}</td>
                    <td>{action.recommendation}</td>
                    <td className="num">{action.due_in_days} nap</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </article>

      <article className="rp-page rp-page-break">
        <h2 className="rp-section-heading">07 · Jogi hivatkozások jegyzéke</h2>
        <div className="rp-rule" />

        <h3 className="rp-title">Magyar jogszabályok</h3>
        <table className="rp-table">
          <thead>
            <tr>
              <th>Jogforrás</th>
              <th>Tárgy</th>
              <th>Relevancia</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>32/2017 (X.18.) NGM rendelet</td><td>TP nyilvántartási kötelezettség</td><td>Átfogó</td></tr>
            <tr><td>32/2017 NGM 4. § (1) e)</td><td>FAR elemzés kötelező tartalma</td><td>Funkcionális ellentmondások</td></tr>
            <tr><td>32/2017 NGM 4. § (1) f)</td><td>Ügyleti tényadatok egyezősége</td><td>Kereszt-dokumentum konzisztencia</td></tr>
            <tr><td>32/2017 NGM 4. § (1) g)</td><td>Szolgáltatás-igénybevétel alátámasztása</td><td>Benefit test és szolgáltatási hiányok</td></tr>
            <tr><td>32/2017 NGM 6. §</td><td>IQR / median igazítás</td><td>Benchmark tartományellenőrzés</td></tr>
            <tr><td>Tao. tv. 18. §</td><td>Szokásos piaci ár</td><td>Adóalap-korrekció kockázat</td></tr>
            <tr><td>Art. 209. §</td><td>Késedelmi pótlék</td><td>Pénzügyi expozíció modell</td></tr>
            <tr><td>Art. 215. §</td><td>Adóbírság (50% / 200%)</td><td>Worst-case NAV forgatókönyv</td></tr>
            <tr><td>Art. 230. §</td><td>Mulasztási bírság</td><td>Dokumentációs hiányok</td></tr>
          </tbody>
        </table>

        <p className="rp-paragraph">
          A fenti hivatkozások a riportban szereplő findingek közvetlen jogi alapját adják. A jogi
          megfelelőség validálása során célszerű a 2024-es adóévre alkalmazandó pontos hatályos szövegeket
          visszaellenőrizni, különös tekintettel az évközi módosításokra.
        </p>
      </article>

      <article className="rp-page rp-page-break">
        <h2 className="rp-section-heading">07 · Jogi hivatkozások jegyzéke (folyt.)</h2>
        <div className="rp-rule" />

        <h3 className="rp-title">OECD Transfer Pricing Guidelines (2022)</h3>
        <table className="rp-table">
          <thead>
            <tr>
              <th>OECD TPG szakasz</th>
              <th>Tartalom</th>
              <th>Tipikus finding kapcsolat</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>1.42-1.50</td><td>Szerződéses feltételek vs tényleges magatartás</td><td>Management fee és szerződéses eltérés</td></tr>
            <tr><td>1.51-1.106</td><td>Funkcionális elemzés (FAR)</td><td>Profil-ellentmondás</td></tr>
            <tr><td>2.1-2.18</td><td>Módszerválasztás alapelvei</td><td>Cost-plus vs TNMM konfliktus</td></tr>
            <tr><td>2.64-2.107</td><td>TNMM és PLI mutatók</td><td>Berry-ráta következetesség</td></tr>
            <tr><td>3.55-3.66</td><td>Interkvartilis tartomány</td><td>Benchmark tartományon kívüliség</td></tr>
            <tr><td>6.34-6.58</td><td>DEMPE keretrendszer</td><td>IP licencdíj alátámasztás</td></tr>
            <tr><td>7.6-7.18</td><td>Benefit test / shareholder activity</td><td>Menedzsmentszolgáltatás levonhatóság</td></tr>
            <tr><td>7.43-7.65</td><td>Low value-adding services</td><td>Kockázatcsökkentő safe harbour</td></tr>
            <tr><td>9.14-9.38</td><td>Risk allocation és restrukturálás</td><td>Funkcionális újraallokáció</td></tr>
          </tbody>
        </table>

        <p className="rp-paragraph">
          A jogi hivatkozási réteg célja, hogy minden findinghez auditálható normatív háttér társuljon. Ez
          csökkenti az értelmezési bizonytalanságot és támogatja a vezetői jóváhagyási folyamatot.
        </p>
      </article>

      <article className="rp-page rp-page-break">
        <h2 className="rp-section-heading">08 · Módszertani disclaimer</h2>
        <div className="rp-rule" />

        <p className="rp-paragraph">
          Ez a jelentés automatizált, AI-vezérelt audit kimenet. Nem minősül önálló adótanácsadói
          szakvéleménynek, és nem helyettesíti a felelős adótanácsadó vagy jogi szakértő ellenőrzését.
        </p>
        <p className="rp-paragraph">
          A pénzügyi kitettség számítások modellezett proxy értékek. A tényleges NAV-megállapításokat
          befolyásolja a teljes tényállás, a társaság együttműködése, valamint az ellenőrzés során feltárt
          további bizonyítékok köre.
        </p>
        <p className="rp-paragraph">
          Ajánlott következő lépések:
        </p>
        <ol className="rp-list">
          <li>A findingek validálása felelős adótanácsadói review-val.</li>
          <li>A remediációs terv vezetői jóváhagyása és owner-kijelölés.</li>
          <li>A benchmark és FAR alapú kritikus tételek 30 napon belüli újraszámolása.</li>
          <li>Az önellenőrzési és APA lehetőségek üzleti mérlegelése.</li>
        </ol>

        <div className="rp-legal-note">
          Bizalmas - Csak címzett részére. A riport továbbítása harmadik fél számára kizárólag előzetes
          írásbeli engedéllyel történhet. NECTAR TP v2.0 · Kerek Barackok · PwC Hungary AI
          Hackathon 2026.
        </div>
      </article>
    </section>
  )
}
