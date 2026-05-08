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
  RiskSeverity,
  ConsistencyError,
  BenchmarkRisk,
  MissingElement,
} from '../types/api'
import SeverityBadge from './SeverityBadge'

export type AuditPhase = 'idle' | 'starting' | 'polling' | 'completed' | 'failed'

interface ResultsPanelProps {
  phase: AuditPhase
  auditStatus: AuditStatusResponse | null
  auditReport: AuditReport | null
  auditError: string | null
}

const STAGE_LABELS: Record<string, string> = {
  queued: 'Queued',
  starting: 'Starting pipeline…',
  ingesting_documents: 'Ingesting documents…',
  extracting_entities: 'Extracting entities…',
  cross_document_consistency_check: 'Checking cross-document consistency…',
  benchmark_analysis: 'Running benchmark analysis…',
  regulatory_completeness_check: 'Checking regulatory completeness…',
  compiling_report: 'Compiling audit report…',
  done: 'Finalizing…',
}

const RISK_SEVERITY_COLORS: Record<RiskSeverity, string> = {
  CRITICAL: 'text-red-600',
  HIGH: 'text-red-500',
  MEDIUM: 'text-orange-500',
  LOW: 'text-green-500',
}

const CONSISTENCY_BORDER: Record<RiskSeverity, string> = {
  CRITICAL: 'border-l-red-500',
  HIGH: 'border-l-red-500',
  MEDIUM: 'border-l-orange-500',
  LOW: 'border-l-yellow-400',
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
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Shield className="mb-4 h-16 w-16 text-gray-300" />
      <h3 className="text-lg font-semibold text-gray-700">Ready for Audit</h3>
      <p className="mt-1 text-sm text-gray-400">
        Upload documents and click Start Audit to begin.
      </p>
    </div>
  )
}

function InProgressState({ status }: { status: AuditStatusResponse | null }): JSX.Element {
  const progress = status?.progress ?? 0
  const stage = status?.stage ?? 'queued'
  const label = getStageLabel(stage)

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Loader2 className="mb-5 h-12 w-12 animate-spin text-orange-500" />
      <p className="mb-6 text-sm font-medium text-gray-600">{label}</p>
      <div className="w-full max-w-sm">
        <div className="mb-2 flex justify-between text-xs text-gray-400">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-orange-500 transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <p className="mt-4 text-xs text-gray-400">
        Status: {resolvedStatus(status?.status)}
      </p>
    </div>
  )
}

function ConsistencyErrorCard({ error }: { error: ConsistencyError }): JSX.Element {
  return (
    <div
      className={`rounded-lg border border-gray-100 border-l-4 bg-white p-4 shadow-sm ${CONSISTENCY_BORDER[error.severity]}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm text-gray-800">{error.description}</p>
        <SeverityBadge severity={error.severity} />
      </div>
      {error.evidence && (
        <p className="mb-2 text-xs italic text-gray-500">&ldquo;{error.evidence}&rdquo;</p>
      )}
      {error.source_documents.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {error.source_documents.map((doc) => (
            <span
              key={doc}
              className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600"
            >
              {doc}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function BenchmarkRiskCard({ risk }: { risk: BenchmarkRisk }): JSX.Element {
  const [low, high] = risk.benchmark_range
  return (
    <div className="rounded-lg border border-gray-100 border-l-4 border-l-amber-400 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-800">{risk.metric}</span>
        <SeverityBadge severity={risk.severity} />
      </div>
      <p className="mb-2 text-xs text-gray-500">
        Observed:{' '}
        <span className="font-medium text-gray-700">{risk.observed_value}</span>
        {' '}— Benchmark range:{' '}
        <span className="font-medium text-gray-700">
          [{low}, {high}]
        </span>
      </p>
      <p className="text-xs text-gray-600">{risk.rationale}</p>
    </div>
  )
}

function MissingElementRow({ element }: { element: MissingElement }): JSX.Element {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-b-0">
      <XCircle className="h-4 w-4 shrink-0 text-red-500" />
      <div className="min-w-0 flex-1">
        <span className="block text-sm text-gray-800">{element.name}</span>
        <span className="text-xs text-gray-400">{element.required_by}</span>
      </div>
      <SeverityBadge severity={element.severity} />
    </div>
  )
}

function CompletedState({ report }: { report: AuditReport }): JSX.Element {
  const riskColor = RISK_SEVERITY_COLORS[report.overall_risk]
  const isHighSeverity =
    report.overall_risk === 'CRITICAL' || report.overall_risk === 'HIGH'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {isHighSeverity ? (
          <AlertTriangle className={`h-6 w-6 ${riskColor}`} />
        ) : (
          <CheckCircle className={`h-6 w-6 ${riskColor}`} />
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-base font-bold ${riskColor}`}>
              {report.overall_risk} RISK
            </span>
            <SeverityBadge severity={report.overall_risk} />
          </div>
          <p className="text-xs text-gray-400">
            Generated {formatTimestamp(report.generated_at)}
          </p>
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 px-4 py-3">
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Executive Summary
        </h4>
        <p className="text-sm italic text-gray-600">{report.summary}</p>
      </div>

      <section>
        <h4 className="mb-3 text-sm font-semibold text-gray-700">
          Consistency Errors
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
            {report.consistency_errors.length}
          </span>
        </h4>
        {report.consistency_errors.length === 0 ? (
          <p className="text-sm text-gray-400">No consistency errors found.</p>
        ) : (
          <div className="space-y-3">
            {report.consistency_errors.map((err) => (
              <ConsistencyErrorCard key={err.error_id} error={err} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h4 className="mb-3 text-sm font-semibold text-gray-700">
          Benchmark Risks
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
            {report.benchmark_risks.length}
          </span>
        </h4>
        {report.benchmark_risks.length === 0 ? (
          <p className="text-sm text-gray-400">No benchmark risks identified.</p>
        ) : (
          <div className="space-y-3">
            {report.benchmark_risks.map((risk) => (
              <BenchmarkRiskCard key={risk.risk_id} risk={risk} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h4 className="mb-3 text-sm font-semibold text-gray-700">
          Missing Elements
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
            {report.missing_elements.length}
          </span>
        </h4>
        {report.missing_elements.length === 0 ? (
          <p className="text-sm text-gray-400">No missing elements detected.</p>
        ) : (
          <div className="rounded-lg border border-gray-100 bg-white px-4 shadow-sm">
            {report.missing_elements.map((el) => (
              <MissingElementRow key={el.element_id} element={el} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function FailedState({ error }: { error: string | null }): JSX.Element {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-5">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      <div>
        <p className="text-sm font-semibold text-red-700">Audit Failed</p>
        <p className="mt-1 text-sm text-red-600">
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
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
      <h2 className="mb-1 text-base font-semibold text-gray-900">Audit Results</h2>
      <p className="mb-5 text-sm text-gray-500">
        AI-powered transfer pricing risk analysis output.
      </p>

      <div>
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
