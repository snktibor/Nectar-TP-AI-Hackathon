import { useMemo } from 'react'
import { AlertCircle, FileSearch } from 'lucide-react'
import { phantomDesign } from '../design-system/phantomDesign'
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
import RevealOnScroll from './ui/RevealOnScroll'

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
    <section className={[phantomDesign.components.panel, 'flex min-h-0 flex-col'].join(' ')}>
      <div className={phantomDesign.components.panelHeaderBar}>
        <div className="min-w-0" key={selectedDocId}>
          <p className="truncate text-sm font-semibold text-phantom-ink animate-phantom-fade-in-up" title={selectedDocId}>
            {selectedDocId}
          </p>
          <p className="text-xs text-phantom-muted">Dokumentum-specifikus megállapítások</p>
        </div>
        <span
          key={`count-${filtered.length}`}
          className="inline-flex h-7 shrink-0 items-center rounded-full bg-phantom-accent-soft px-2.5 text-xs font-semibold text-phantom-accent ring-1 ring-inset ring-phantom-accent/20 animate-phantom-bounce-in transition-transform duration-phantom-base hover:scale-110 tabular-nums"
        >
          {filtered.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" key={`${selectedDocId}-${selectedDocType ?? 'none'}`}>
        {auditReport === null ? (
          <div className="flex flex-col items-center gap-2 rounded-phantom-card border border-dashed border-phantom-line bg-phantom-surface-muted p-6 text-center animate-phantom-fade-in">
            <FileSearch className="h-6 w-6 text-phantom-subtle animate-phantom-pulse-soft" />
            <p className="text-sm font-medium text-phantom-ink">Még nincs audit lefuttatva</p>
            <p className="text-xs text-phantom-muted">
              Indítsd el az auditot az Analízis fülön a megállapítások megjelenítéséhez.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center gap-2 rounded-phantom-control border border-phantom-success-border bg-phantom-success-soft p-3 text-phantom-success-text animate-phantom-fade-in-up">
            <AlertCircle className="h-4 w-4 shrink-0 animate-phantom-bounce-in" />
            <p className="text-sm">Ehhez a dokumentumhoz nincs megállapítás.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((f, index) => (
              <RevealOnScroll key={findingKey(f)} delayMs={Math.min(index, 6) * 60}>
                <FindingCard
                  variant={f}
                  showAgentBadge
                  sessionId={sessionId}
                  onCitationClick={onCitationClick}
                />
              </RevealOnScroll>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
