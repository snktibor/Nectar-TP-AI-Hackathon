import {
  Shield,
  Loader2,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  XCircle,
} from 'lucide-react'
import type {
  AuditStatus,
  AuditStatusResponse,
  AuditReport,
  ConsistencyError,
  BenchmarkRisk,
  MissingElement,
} from '../types/api'
import SeverityBadge from './SeverityBadge'
import { phantomDesign } from '../design-system/phantomDesign'

export type AuditPhase = 'idle' | 'starting' | 'polling' | 'completed' | 'failed'

interface ResultsPanelProps {
  readonly phase: AuditPhase
  readonly auditStatus: AuditStatusResponse | null
  readonly auditReport: AuditReport | null
  readonly auditError: string | null
}

const STAGE_LABELS: Record<string, string> = {
  queued: 'Várakozik',
  starting: 'Pipeline indítása…',
  ingesting_documents: 'Dokumentumok beolvasása…',
  extracting_entities: 'Entitások kinyerése…',
  cross_document_consistency_check: 'Dokumentumok közötti konzisztencia ellenőrzése…',
  benchmark_analysis: 'Benchmark elemzés futtatása…',
  regulatory_completeness_check: 'Szabályozási teljesség ellenőrzése…',
  compiling_report: 'Audit jelentés összeállítása…',
  done: 'Véglegesítés…',
}

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function getStageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage
}

function resolvedStatus(status: AuditStatus | undefined): string {
  if (!status) return ''
  return status
}

function IdleState(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-14 text-center sm:py-16 lg:py-20">
      <Shield className="mb-4 h-14 w-14 text-phantom-subtle sm:h-16 sm:w-16" />
      <h3 className="text-lg font-semibold text-phantom-ink">Auditásra kész</h3>
      <p className="mt-1 max-w-sm text-sm leading-5 text-phantom-muted">
        Tölts fel dokumentumokat és kattints az Audit indítás gombra a kezdéshez.
      </p>
    </div>
  )
}

function InProgressState({
  status,
}: Readonly<{ status: AuditStatusResponse | null }>): JSX.Element {
  const progress = status?.progress ?? 0
  const stage = status?.stage ?? 'queued'
  const label = getStageLabel(stage)

  return (
    <div className="flex flex-col items-center justify-center px-2 py-12 text-center sm:py-16">
      <Loader2 className="mb-5 h-12 w-12 animate-spin text-phantom-accent" />
      <p className="mb-6 text-sm font-medium text-phantom-muted">{label}</p>
      <div className="w-full max-w-sm">
        <div className="mb-2 flex justify-between text-xs text-phantom-subtle">
          <span>Előrehaladás</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-phantom-surface-muted ring-1 ring-phantom-line">
          <div
            className="h-full rounded-full bg-phantom-accent transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <p className="mt-4 text-xs text-phantom-subtle">
        Állapot: {resolvedStatus(status?.status)}
      </p>
    </div>
  )
}

function ConsistencyErrorCard({ error }: Readonly<{ error: ConsistencyError }>): JSX.Element {
  const severity = phantomDesign.severity[error.severity]

  return (
    <div
      className={`rounded-phantom-card border border-phantom-line border-l-4 bg-phantom-surface p-3 shadow-phantom-soft sm:p-4 ${severity.border}`}
    >
      <div className="mb-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="break-words text-sm leading-5 text-phantom-ink">{error.description}</p>
        <SeverityBadge severity={error.severity} />
      </div>
      {error.evidence && (
        <p className="mb-2 break-words text-xs italic leading-5 text-phantom-muted">
          &ldquo;{error.evidence}&rdquo;
        </p>
      )}
      {error.locations.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {error.locations.map((loc) => (
            <span
              key={loc.filename}
              className={phantomDesign.components.tag}
              title={loc.filename}
            >
              {loc.filename}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function BenchmarkRiskCard({ risk }: Readonly<{ risk: BenchmarkRisk }>): JSX.Element {
  const [low, high] = risk.benchmark_range
  const severity = phantomDesign.severity[risk.severity]

  return (
    <div className={`rounded-phantom-card border border-phantom-line border-l-4 bg-phantom-surface p-3 shadow-phantom-soft sm:p-4 ${severity.border}`}>
      <div className="mb-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="break-words text-sm font-semibold text-phantom-ink">{risk.metric}</span>
        <SeverityBadge severity={risk.severity} />
      </div>
      <p className="mb-2 break-words text-xs leading-5 text-phantom-muted">
        Megfigyelt:{' '}
        <span className="font-medium text-phantom-ink">{risk.observed_value}</span>
        {' '}— Benchmark tartomány:{' '}
        <span className="font-medium text-phantom-ink">
          [{low}, {high}]
        </span>
      </p>
      <p className="break-words text-xs leading-5 text-phantom-muted">{risk.rationale}</p>
    </div>
  )
}

function MissingElementRow({ element }: Readonly<{ element: MissingElement }>): JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-phantom-line py-3 last:border-b-0">
      <XCircle className="h-4 w-4 shrink-0 text-phantom-danger-text" />
      <div className="min-w-0 flex-1">
        <span className="block break-words text-sm leading-5 text-phantom-ink">{element.description}</span>
        <span className="text-xs text-phantom-subtle">{element.required_by}</span>
      </div>
      <SeverityBadge severity={element.severity} />
    </div>
  )
}

function CompletedState({ report }: Readonly<{ report: AuditReport }>): JSX.Element {
  const severity = phantomDesign.severity[report.overall_risk]
  const isHighSeverity =
    report.overall_risk === 'CRITICAL' || report.overall_risk === 'HIGH'

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex min-w-0 items-center gap-3">
        {isHighSeverity ? (
          <AlertTriangle className={`h-6 w-6 shrink-0 ${severity.icon}`} />
        ) : (
          <CheckCircle className={`h-6 w-6 shrink-0 ${severity.icon}`} />
        )}
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={`text-base font-bold ${severity.text}`}>
              {severity.label} Kockázat
            </span>
            <SeverityBadge severity={report.overall_risk} />
          </div>
          <p className="text-xs text-phantom-subtle">
            Generálva: {formatTimestamp(report.generated_at)}
          </p>
        </div>
      </div>

      <div className={phantomDesign.components.subtleCard}>
        <h4 className="mb-1 text-xs font-semibold uppercase text-phantom-muted">
          Vezetői Összefoglalás
        </h4>
        <p className="break-words text-sm italic leading-6 text-phantom-muted">{report.summary}</p>
      </div>

      <section>
        <h4 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-phantom-ink">
          <span>Konzisztencia hibák</span>
          <span className={phantomDesign.components.metaPill}>
            {report.consistency_errors.length}
          </span>
        </h4>
        {report.consistency_errors.length === 0 ? (
          <p className="text-sm text-phantom-subtle">Nincs konzisztencia hiba.</p>
        ) : (
          <div className="space-y-3">
            {report.consistency_errors.map((err) => (
              <ConsistencyErrorCard key={err.error_id} error={err} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h4 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-phantom-ink">
          <span>Benchmark kockázatok</span>
          <span className={phantomDesign.components.metaPill}>
            {report.benchmark_risks.length}
          </span>
        </h4>
        {report.benchmark_risks.length === 0 ? (
          <p className="text-sm text-phantom-subtle">Nincs benchmark kockázat.</p>
        ) : (
          <div className="space-y-3">
            {report.benchmark_risks.map((risk) => (
              <BenchmarkRiskCard key={risk.risk_id} risk={risk} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h4 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-phantom-ink">
          <span>Hiányzó elemek</span>
          <span className={phantomDesign.components.metaPill}>
            {report.missing_elements.length}
          </span>
        </h4>
        {report.missing_elements.length === 0 ? (
          <p className="text-sm text-phantom-subtle">Nincs hiányzó elem.</p>
        ) : (
          <div className="overflow-hidden rounded-phantom-card border border-phantom-line bg-phantom-surface px-3 shadow-phantom-soft sm:px-4">
            {report.missing_elements.map((el) => (
              <MissingElementRow key={el.element_id} element={el} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function FailedState({ error }: Readonly<{ error: string | null }>): JSX.Element {
  return (
    <div className="flex items-start gap-3 rounded-phantom-card border border-phantom-danger-border bg-phantom-danger-soft p-4 sm:p-5">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-phantom-danger-text" />
      <div>
        <p className="text-sm font-semibold text-phantom-danger-text">Audit Failed</p>
        <p className="mt-1 break-words text-sm leading-5 text-phantom-danger-text">
          {error ?? 'An unexpected error occurred. Please try again.'}
        </p>
      </div>
    </div>
  )
}

export default function ResultsPanel({
  phase,
  auditStatus,
  auditReport,
  auditError,
}: ResultsPanelProps): JSX.Element {
  return (
    <div className={phantomDesign.components.panel}>
      <div className={phantomDesign.components.panelHeader}>
        <h2 className={phantomDesign.components.panelTitle}>Audit Results</h2>
        <p className={phantomDesign.components.panelDescription}>
          AI-powered transfer pricing risk analysis output.
        </p>
      </div>

      <div className="min-w-0">
        {phase === 'idle' && <IdleState />}
        {(phase === 'starting' || phase === 'polling') && (
          <InProgressState status={auditStatus} />
        )}
        {phase === 'completed' && auditReport && (
          <CompletedState report={auditReport} />
        )}
        {phase === 'failed' && <FailedState error={auditError} />}
      </div>
    </div>
  )
}
