import { useMemo } from 'react'
import { AlertCircle, FileSearch } from 'lucide-react'
import {
  compareSeverityDesc,
  type BackendAuditReport,
  type BackendBenchmarkRisk,
  type BackendConsistencyError,
  type BackendDocTypeScope,
  type BackendFindingAttribution,
  type BackendMissingElement,
} from '../lib/backendAudit'
import type { CitationTarget } from '../types/viewer'
import FindingCard from './FindingCard'

type AnyFinding =
  | { kind: 'consistency'; finding: BackendConsistencyError }
  | { kind: 'benchmark'; finding: BackendBenchmarkRisk }
  | { kind: 'missing'; finding: BackendMissingElement }

interface FilteredFindingsPanelProps {
  readonly selectedDocId: string
  readonly selectedDocType: BackendDocTypeScope | null
  readonly sessionId: string
  readonly auditReport: BackendAuditReport | null
  readonly onCitationClick: (target: CitationTarget) => void
}

function attributionMatchesScope(
  attribution: BackendFindingAttribution | null | undefined,
  scope: BackendDocTypeScope | null,
): boolean {
  if (scope === null || !attribution) return false
  return attribution.doc_type_scope === scope
}

function filterReportByDocument(
  report: BackendAuditReport,
  filename: string,
  scope: BackendDocTypeScope | null,
): AnyFinding[] {
  const consistency = report.consistency_errors
    .filter((f) => attributionMatchesScope(f.attribution, scope))
    .map((finding): AnyFinding => ({ kind: 'consistency', finding }))

  const benchmark = report.benchmark_risks
    .filter((f) => attributionMatchesScope(f.attribution, scope))
    .map((finding): AnyFinding => ({ kind: 'benchmark', finding }))

  const missing = report.missing_elements
    .filter((f) => f.expected_in === filename)
    .map((finding): AnyFinding => ({ kind: 'missing', finding }))

  return [...consistency, ...benchmark, ...missing].sort((a, b) =>
    compareSeverityDesc(a.finding.severity, b.finding.severity),
  )
}

function findingKey(f: AnyFinding): string {
  if (f.kind === 'consistency') return f.finding.error_id
  if (f.kind === 'benchmark') return f.finding.risk_id
  return f.finding.element_id
}

export default function FilteredFindingsPanel({
  selectedDocId,
  selectedDocType,
  sessionId,
  auditReport,
  onCitationClick,
}: FilteredFindingsPanelProps): JSX.Element {
  const filtered = useMemo(
    () =>
      auditReport
        ? filterReportByDocument(auditReport, selectedDocId, selectedDocType)
        : [],
    [auditReport, selectedDocId, selectedDocType],
  )

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-md sm:p-5 lg:p-6">
      <div className="mb-4 flex min-h-14 flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-slate-50 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900" title={selectedDocId}>
            {selectedDocId}
          </p>
          <p className="text-xs text-gray-500">Dokumentum-specifikus megállapítások</p>
        </div>
        <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-orange-50 px-2.5 text-xs font-semibold text-orange-700 ring-1 ring-inset ring-orange-200">
          {filtered.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {auditReport === null ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-slate-50 p-6 text-center">
            <FileSearch className="h-6 w-6 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">Még nincs audit lefuttatva</p>
            <p className="text-xs text-gray-500">
              Indítsd el az auditot az Elemzés fülön a megállapítások megjelenítéséhez.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="text-sm">Ehhez a dokumentumhoz nincs megállapítás.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((f) => (
              <FindingCard
                key={findingKey(f)}
                variant={f}
                showAgentBadge
                sessionId={sessionId}
                onCitationClick={onCitationClick}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
