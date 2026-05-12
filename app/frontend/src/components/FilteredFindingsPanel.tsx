import { useMemo } from 'react'
import { AlertCircle, FileSearch } from 'lucide-react'
import { phantomDesign } from '../design-system/phantomDesign'
import {
  type BackendAuditReport,
  type BackendDocTypeScope,
} from '../lib/backendAudit'
import { filterReportByDocument } from '../lib/findingFilters'
import type { AnyFinding } from '../types/findings'
import type { CitationTarget } from '../types/viewer'
import FindingCard from './FindingCard'
import RevealOnScroll from './ui/RevealOnScroll'

interface FilteredFindingsPanelProps {
  readonly selectedDocId: string
  readonly selectedDocType: BackendDocTypeScope | null
  readonly sessionId: string
  readonly auditReport: BackendAuditReport | null
  readonly onCitationClick: (target: CitationTarget) => void
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

  let body: JSX.Element
  if (auditReport === null) {
    body = (
      <div className="flex flex-col items-center gap-2 rounded-phantom-card border border-dashed border-phantom-line bg-phantom-surface-muted p-6 text-center animate-phantom-fade-in">
        <FileSearch className="h-6 w-6 text-phantom-subtle animate-phantom-pulse-soft" />
        <p className="text-sm font-medium text-phantom-ink">Még nincs audit lefuttatva</p>
        <p className="text-xs text-phantom-muted">
          Indítsd el az auditot az Analízis fülön a megállapítások megjelenítéséhez.
        </p>
      </div>
    )
  } else if (filtered.length === 0) {
    body = (
      <div className="flex items-center gap-2 rounded-phantom-control border border-phantom-success-border bg-phantom-success-soft p-3 text-phantom-success-text animate-phantom-fade-in-up">
        <AlertCircle className="h-4 w-4 shrink-0 animate-phantom-bounce-in" />
        <p className="text-sm">Ehhez a dokumentumhoz nincs megállapítás.</p>
      </div>
    )
  } else {
    body = (
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
    )
  }

  return (
    <section className={[phantomDesign.components.panel, 'flex min-h-0 flex-col'].join(' ')}>
      <div className={phantomDesign.components.panelHeaderBar}>
        <div className="min-w-0" key={selectedDocId}>
          <p className="break-all text-sm font-semibold text-phantom-ink animate-phantom-fade-in-up" title={selectedDocId}>
            {selectedDocId}
          </p>
          <p className="text-xs text-phantom-muted">Dokumentum-specifikus megállapítások</p>
        </div>
        <span
          key={`count-${filtered.length}`}
          className="inline-flex h-7 shrink-0 items-center rounded-full bg-phantom-accent-soft px-2.5 text-xs font-semibold text-phantom-accent ring-1 ring-inset ring-phantom-accent/20 animate-phantom-bounce-in tabular-nums max-[359px]:h-6 max-[359px]:px-2 max-[359px]:text-[11px]"
        >
          {filtered.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" key={`${selectedDocId}-${selectedDocType ?? 'none'}`}>
        {body}
      </div>
    </section>
  )
}
