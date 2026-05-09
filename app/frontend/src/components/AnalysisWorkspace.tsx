import { useState } from 'react'
import { AlertCircle, BarChart2, ChevronDown, ClipboardList, Cpu, DatabaseZap, SearchCheck, Sparkles, Wrench, X } from 'lucide-react'
import { phantomDesign } from '../design-system/phantomDesign'
import {
  ALL_AGENT_IDS,
  AGENT_LABELS,
  compareSeverityDesc,
  formatDurationMs,
  formatStageLabel,
  formatTokenCount,
  getSeverityTone,
  severityLabel,
  type AgentId,
  type BackendAuditReport,
  type BackendAuditStatusResponse,
  type BackendConsistencyError,
  type BackendBenchmarkRisk,
  type BackendMissingElement,
  type BackendRiskSeverity,
  type WorkspacePhase,
} from '../lib/backendAudit'
import type { CitationTarget } from '../types/viewer'
import type { IngestedDocument } from '../types/api'
import AgentStatusStrip from './AgentStatusStrip'
import FindingCard from './FindingCard'
import { EmptyPanel, MetricCard, StatusPill } from './ui/DashboardPrimitives'

type TabId = 'findings' | 'agent_runs' | 'telemetry'
type StatusPillTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const headerStatusToneClasses: Record<StatusPillTone, string> = {
  neutral: 'bg-phantom-surface-muted text-phantom-muted',
  accent: 'bg-phantom-accent-soft text-phantom-accent',
  success: 'bg-phantom-success-soft text-phantom-success-text',
  warning: 'bg-phantom-severity-medium-soft text-phantom-severity-medium-text',
  danger: 'bg-phantom-danger-soft text-phantom-danger-text',
  info: 'bg-blue-50 text-blue-700',
}

function getSeverityFilterTone(severity: BackendRiskSeverity): string {
  switch (severity) {
    case 'critical':
      return 'bg-phantom-severity-critical-soft text-phantom-severity-critical-text'
    case 'high':
      return 'bg-phantom-severity-high-soft text-phantom-severity-high-text'
    case 'medium':
      return 'bg-phantom-severity-medium-soft text-phantom-severity-medium-text'
    case 'low':
      return 'bg-phantom-severity-low-soft text-phantom-severity-low-text'
    default:
      return 'bg-phantom-surface-muted text-phantom-muted'
  }
}

interface AnalysisWorkspaceProps {
  readonly documents: IngestedDocument[]
  readonly phase: WorkspacePhase
  readonly auditStatus: BackendAuditStatusResponse | null
  readonly auditReport: BackendAuditReport | null
  readonly auditError: string | null
  readonly onAnalyze: () => void
  readonly sessionId: string
  readonly onCitationClick: (target: CitationTarget) => void
  readonly onCloseReport: () => void
}

function resolvePhasePill(phase: WorkspacePhase): { label: string; tone: StatusPillTone } {
  if (phase === 'completed') return { label: 'Riport kész', tone: 'success' }
  if (phase === 'polling' || phase === 'starting') return { label: 'Audit fut', tone: 'accent' }
  if (phase === 'ready') return { label: 'Indítható', tone: 'info' }
  if (phase === 'blocked') return { label: 'Hiányos feltöltés', tone: 'warning' }
  if (phase === 'failed') return { label: 'Hiba', tone: 'danger' }
  return { label: 'Feltöltésre vár', tone: 'neutral' }
}

// ---------------------------------------------------------------------------
// ProgressView
// ---------------------------------------------------------------------------

function ProgressView({
  status,
}: Readonly<{ status: BackendAuditStatusResponse | null }>): JSX.Element {
  const progressValue = Math.max(0, Math.min(status?.progress ?? 0, 100))

  return (
    <section className="space-y-3 animate-phantom-fade-in">
      <div className="rounded-phantom-card border border-phantom-line bg-phantom-surface p-4 animate-phantom-progress-glow">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-5 w-5 shrink-0">
            <div className="force-spin h-5 w-5 animate-spin rounded-full border-2 border-phantom-accent border-t-transparent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-phantom-ink animate-phantom-fade-in-up">
              {status ? formatStageLabel(status.stage) : 'Audit indítás'}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-phantom-surface-muted ring-1 ring-phantom-line">
              <div
                className="phantom-progress-stripes relative h-full rounded-full bg-phantom-accent transition-[width] duration-700 ease-out"
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold text-phantom-subtle tabular-nums">{progressValue}%</p>
          </div>
        </div>
      </div>

      <AgentStatusStrip
        mode="polling"
        agentProgress={status?.agent_progress ?? {}}
      />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Findings tab helpers
// ---------------------------------------------------------------------------

type AnyFinding =
  | { kind: 'consistency'; finding: BackendConsistencyError }
  | { kind: 'benchmark'; finding: BackendBenchmarkRisk }
  | { kind: 'missing'; finding: BackendMissingElement }

function normalizeSeverityValue(
  severity: string,
): BackendRiskSeverity | null {
  const normalized = severity.trim().toLowerCase()
  if (normalized === 'critical' || normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized
  }
  return null
}

function matchesSeverityFilter(
  finding: AnyFinding,
  severityFilter: BackendRiskSeverity | null,
): boolean {
  if (severityFilter === null) return true
  return normalizeSeverityValue(finding.finding.severity) === severityFilter
}

function isKnownAgentId(value: string | null | undefined): value is AgentId {
  if (!value) return false
  return ALL_AGENT_IDS.includes(value as AgentId)
}

function flattenFindings(report: BackendAuditReport): AnyFinding[] {
  const all: AnyFinding[] = [
    ...report.consistency_errors.map((f): AnyFinding => ({ kind: 'consistency', finding: f })),
    ...report.benchmark_risks.map((f): AnyFinding => ({ kind: 'benchmark', finding: f })),
    ...report.missing_elements.map((f): AnyFinding => ({ kind: 'missing', finding: f })),
  ]
  return all.sort((a, b) => compareSeverityDesc(a.finding.severity, b.finding.severity))
}

function findingKey(f: AnyFinding): string {
  if (f.kind === 'consistency') return f.finding.error_id
  if (f.kind === 'benchmark') return f.finding.risk_id
  return f.finding.element_id
}

function groupFindingsByAgent(findings: AnyFinding[]): Map<AgentId | 'other', AnyFinding[]> {
  const map = new Map<AgentId | 'other', AnyFinding[]>()
  for (const f of findings) {
    const agentId = f.finding.attribution?.agent_id
    const key: AgentId | 'other' = isKnownAgentId(agentId) ? agentId : 'other'
    const bucket = map.get(key) ?? []
    bucket.push(f)
    map.set(key, bucket)
  }
  return map
}

// ---------------------------------------------------------------------------
// FindingsView
// ---------------------------------------------------------------------------

function FindingsView({
  report,
  sessionId,
  onCitationClick,
}: Readonly<{
  report: BackendAuditReport
  sessionId: string
  onCitationClick: (target: CitationTarget) => void
}>): JSX.Element {
  const [severityFilter, setSeverityFilter] = useState<BackendRiskSeverity | null>(null)

  const allFindings = flattenFindings(report)
  const hasFilteredFindings = allFindings.some((f) => matchesSeverityFilter(f, severityFilter))

  const grouped = groupFindingsByAgent(allFindings)

  const severityOptions: BackendRiskSeverity[] = ['critical', 'high', 'medium', 'low']

  return (
    <div className="space-y-3 animate-phantom-fade-in">
      {/* Summary banner */}
      <section className="min-w-0 overflow-hidden rounded-phantom-card border border-phantom-line bg-phantom-surface p-4 animate-phantom-fade-in-up transition-phantom duration-phantom-base hover:shadow-phantom-soft">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <p className="min-w-0 flex-1 break-words text-sm leading-6 text-phantom-ink">{report.summary}</p>
          <span
            className={[
              'inline-flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-semibold uppercase whitespace-nowrap animate-phantom-bounce-in transition-transform duration-phantom-base hover:scale-105',
              getSeverityTone(report.overall_risk),
            ].join(' ')}
          >
            {severityLabel(report.overall_risk)}
          </span>
        </div>
      </section>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-2 xs:grid-cols-2 sm:grid-cols-3">
        {[
          { icon: AlertCircle, label: 'Konzisztencia\nhibák', value: String(report.consistency_errors.length) },
          { icon: BarChart2, label: 'Benchmark\nkockázatok', value: String(report.benchmark_risks.length) },
          { icon: ClipboardList, label: 'Hiányzó\nelemek', value: String(report.missing_elements.length) },
        ].map((card, index) => (
          <div
            key={card.label}
            style={{ animationDelay: `${index * 70}ms` }}
            className="animate-phantom-fade-in-up"
          >
            <MetricCard icon={card.icon} label={card.label} value={card.value} />
          </div>
        ))}
      </div>

      {/* Severity filter */}
      <div className="grid min-w-0 grid-cols-2 gap-1.5 animate-phantom-fade-in-up sm:grid-cols-3 xl:grid-cols-5" style={{ animationDelay: '240ms' }}>
        <button
          type="button"
          onClick={() => setSeverityFilter(null)}
          className={[
            'inline-flex h-7 w-full items-center justify-center whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-phantom duration-phantom-base hover:-translate-y-px hover:shadow-phantom-soft active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus',
            severityFilter === null
              ? 'border-amber-300 bg-phantom-accent-soft text-phantom-accent scale-[1.02] shadow-phantom-soft'
              : 'border-phantom-line bg-phantom-surface-muted text-phantom-muted hover:border-amber-200 hover:bg-phantom-accent-soft/60 hover:text-phantom-accent',
          ].join(' ')}
        >
          Mind
        </button>
        {severityOptions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeverityFilter(severityFilter === s ? null : s)}
            className={[
              'inline-flex h-7 w-full items-center justify-center whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-phantom duration-phantom-base hover:-translate-y-px hover:shadow-phantom-soft active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus',
              severityFilter === s
                ? `${getSeverityFilterTone(s)} border-phantom-line scale-[1.02] shadow-phantom-soft`
                : 'border-phantom-line bg-phantom-surface-muted text-phantom-muted',
            ].join(' ')}
          >
            {severityLabel(s)}
          </button>
        ))}
      </div>

      {/* Per-agent accordion */}
      <div className="space-y-2">
        {ALL_AGENT_IDS.map((agentId, index) => {
          const bucket = grouped.get(agentId)
          if (!bucket || bucket.length === 0) return null
          const filtered = bucket.filter((f) => matchesSeverityFilter(f, severityFilter))
          if (filtered.length === 0) return null

          return (
            <details
              key={agentId}
              style={{ animationDelay: `${300 + index * 60}ms` }}
              className="phantom-accordion animate-phantom-fade-in-up rounded-phantom-card border border-phantom-line bg-phantom-surface transition-phantom duration-phantom-base hover:border-phantom-accent/40"
              open
            >
              <summary className="group flex min-w-0 cursor-pointer select-none items-center justify-between gap-2 p-3 hover:bg-phantom-accent-soft/30">
                <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-5 text-phantom-ink transition-colors duration-phantom-base group-hover:text-phantom-accent">
                  {AGENT_LABELS[agentId]}
                </span>
                <span className="inline-flex items-center gap-2">
                  <StatusPill tone="neutral">{filtered.length}</StatusPill>
                  <ChevronDown className="phantom-accordion-chevron h-4 w-4 shrink-0 text-phantom-subtle" />
                </span>
              </summary>
              <div className="space-y-2 border-t border-phantom-line p-3">
                {filtered.map((f) => (
                  <FindingCard
                    key={findingKey(f)}
                    variant={f}
                    showAgentBadge={false}
                    sessionId={sessionId}
                    onCitationClick={onCitationClick}
                  />
                ))}
              </div>
            </details>
          )
        })}

        {/* Findings without attribution */}
        {(() => {
          const bucket = grouped.get('other')
          if (!bucket || bucket.length === 0) return null
          const filtered = bucket.filter((f) => matchesSeverityFilter(f, severityFilter))
          if (filtered.length === 0) return null
          return (
            <details
              className="phantom-accordion rounded-phantom-card border border-phantom-line bg-phantom-surface transition-phantom duration-phantom-base hover:border-phantom-accent/40"
              open
            >
              <summary className="group flex min-w-0 cursor-pointer select-none items-center justify-between gap-2 p-3 hover:bg-phantom-accent-soft/30">
                <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-5 text-phantom-ink transition-colors duration-phantom-base group-hover:text-phantom-accent">Nincs ügynök</span>
                <span className="inline-flex items-center gap-2">
                  <StatusPill tone="neutral">{filtered.length}</StatusPill>
                  <ChevronDown className="phantom-accordion-chevron h-4 w-4 shrink-0 text-phantom-subtle" />
                </span>
              </summary>
              <div className="space-y-2 border-t border-phantom-line p-3">
                {filtered.map((f) => (
                  <FindingCard
                    key={findingKey(f)}
                    variant={f}
                    showAgentBadge={false}
                    sessionId={sessionId}
                    onCitationClick={onCitationClick}
                  />
                ))}
              </div>
            </details>
          )
        })()}
      </div>

      {!hasFilteredFindings && (
        <EmptyPanel
          icon={SearchCheck}
          title={severityFilter ? `${severityLabel(severityFilter)} szinthez nincs találat` : 'Nincs találat'}
          description={severityFilter ? 'Nincs olyan megállapítás, ami megfelel a kiválasztott súlyossági szintnek.' : 'Jelenleg nincs megjeleníthető megállapítás.'}
        />
      )}

    </div>
  )
}

// ---------------------------------------------------------------------------
// AgentRunsView
// ---------------------------------------------------------------------------

function AgentRunsView({ report }: Readonly<{ report: BackendAuditReport }>): JSX.Element {
  if (report.agent_runs.length === 0) {
    return (
      <EmptyPanel
        icon={SearchCheck}
        title="Nincs adat"
        description="Ügynök futtatási adatok nem elérhetők."
      />
    )
  }

  return (
    <div className="space-y-3">
      {report.agent_runs.map((run, index) => {
        let statusTone: StatusPillTone = 'danger'
        let statusText = 'Hiba'
        if (run.status === 'ok') {
          statusTone = 'success'
          statusText = 'Kész'
        } else if (run.status === 'timeout') {
          statusTone = 'warning'
          statusText = 'Időtúllépés'
        }
        const findingCount =
          run.consistency_errors.length + run.benchmark_risks.length + run.missing_elements.length

        const metricCards = [
          {
            label: 'Konzisztencia',
            value: run.consistency_errors.length,
            className: 'border-amber-200 bg-amber-50 text-amber-800',
          },
          {
            label: 'Benchmark',
            value: run.benchmark_risks.length,
            className: 'border-orange-200 bg-orange-50 text-orange-800',
          },
          {
            label: 'Hiányzó',
            value: run.missing_elements.length,
            className: 'border-gray-200 bg-blue-50 text-blue-800',
          },
          {
            label: 'Összesen',
            value: findingCount,
            className: 'border-phantom-line bg-phantom-surface-muted text-phantom-ink',
          },
        ]

        return (
          <article
            key={run.agent_id}
            style={{ animationDelay: `${index * 70}ms` }}
            className="min-w-0 overflow-hidden rounded-phantom-card border border-phantom-line bg-phantom-surface p-4 animate-phantom-fade-in-up transition-phantom duration-phantom-base hover:-translate-y-0.5 hover:shadow-phantom-soft hover:border-phantom-accent/40"
          >
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-phantom-control border border-phantom-line bg-phantom-surface-muted">
                  <Cpu className="h-4 w-4 text-phantom-accent" />
                </span>
                <div className="min-w-0">
                  <p className="min-w-0 break-words text-sm font-semibold leading-5 text-phantom-ink">
                    {AGENT_LABELS[run.agent_id]}
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-phantom-subtle">
                    {run.agent_id}
                  </p>
                </div>
              </div>
              <StatusPill tone={statusTone}>{statusText}</StatusPill>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2.5 xl:items-stretch xl:grid-cols-[minmax(0,0.68fr)_minmax(0,1.32fr)]">
              <section className="min-w-0 overflow-hidden rounded-phantom-control border border-phantom-line bg-phantom-surface-muted p-2.5 xl:h-full">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-phantom-subtle">
                  Futtatás meta
                </p>
                <dl className="mt-1.5 grid min-w-0 grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
                  <dt className="font-medium text-phantom-subtle">Modell</dt>
                  <dd className="min-w-0 break-all font-medium text-phantom-ink">{run.model}</dd>
                  <dt className="font-medium text-phantom-subtle">Prompt</dt>
                  <dd className="min-w-0 break-all font-medium text-phantom-ink">{run.prompt_version}</dd>
                  <dt className="font-medium text-phantom-subtle">Időtartam</dt>
                  <dd className="font-semibold tabular-nums text-phantom-ink">
                    {formatDurationMs(run.started_at, run.finished_at)}
                  </dd>
                </dl>
              </section>

              <section className="min-w-0 overflow-hidden rounded-phantom-control border border-phantom-line bg-white p-3.5 xl:h-full">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-phantom-subtle">
                  Megállapítások
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {metricCards.map((metric) => (
                    <div
                      key={metric.label}
                      className={[
                        'min-w-0 rounded-phantom-control border px-2.5 py-2 text-center',
                        metric.className,
                      ].join(' ')}
                    >
                      <p className="break-words text-[11px] font-medium">{metric.label}</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">{metric.value}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {run.status === 'error' && run.error && (
              <div className="mt-2.5 break-words rounded-phantom-control border border-phantom-severity-critical-border bg-phantom-severity-critical-soft px-3 py-2 text-xs text-phantom-severity-critical-text">
                {run.error.code}: {run.error.message}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TelemetryView
// ---------------------------------------------------------------------------

function TelemetryView({ report }: Readonly<{ report: BackendAuditReport }>): JSX.Element {
  if (report.agent_runs.length === 0) {
    return (
      <EmptyPanel
        icon={SearchCheck}
        title="Nincs adat"
        description="Token felhasználási adatok nem elérhetők."
      />
    )
  }

  const totals = report.agent_runs.reduce(
    (acc, run) => ({
      input: acc.input + run.input_tokens,
      output: acc.output + run.output_tokens,
      cacheRead: acc.cacheRead + run.cache_read_tokens,
      cacheCreate: acc.cacheCreate + run.cache_creation_tokens,
      toolCalls: acc.toolCalls + run.tool_calls,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheCreate: 0, toolCalls: 0 },
  )

  const telemetryCards = [
    { icon: Cpu, label: 'Bemenet (token)', value: formatTokenCount(totals.input) },
    { icon: Cpu, label: 'Kimenet (token)', value: formatTokenCount(totals.output) },
    { icon: DatabaseZap, label: 'Cache olvasás', value: formatTokenCount(totals.cacheRead) },
    { icon: Wrench, label: 'Eszköz\nhívások', value: formatTokenCount(totals.toolCalls) },
  ]

  return (
    <div className="space-y-4 animate-phantom-fade-in">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {telemetryCards.map((card, index) => (
          <div
            key={card.label}
            style={{ animationDelay: `${index * 70}ms` }}
            className="animate-phantom-fade-in-up"
          >
            <MetricCard icon={card.icon} label={card.label} value={card.value} />
          </div>
        ))}
      </div>

      <section
        className="min-w-0 overflow-hidden rounded-phantom-card border border-phantom-line bg-phantom-surface p-4 animate-phantom-fade-in-up"
        style={{ animationDelay: '320ms' }}
      >
        <p className="mb-3 break-words text-xs font-semibold uppercase tracking-[0.06em] text-phantom-subtle">
          Token felhasználás ügynökönként
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="border-b border-phantom-line text-left text-phantom-subtle">
                <th className="pb-2 pr-3 font-medium">Ügynök</th>
                <th className="pb-2 pr-3 text-right font-medium">Bemenet</th>
                <th className="pb-2 pr-3 text-right font-medium">Kimenet</th>
                <th className="pb-2 pr-3 text-right font-medium">Cache olv.</th>
                <th className="pb-2 pr-3 text-right font-medium">Cache lét.</th>
                <th className="pb-2 text-right font-medium">Összes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-phantom-line">
              {report.agent_runs.map((run) => {
                const total =
                  run.input_tokens +
                  run.output_tokens +
                  run.cache_read_tokens +
                  run.cache_creation_tokens
                return (
                  <tr key={run.agent_id} className="text-phantom-ink transition-colors duration-phantom-base hover:bg-phantom-accent-soft/40">
                    <td className="py-2 pr-3 break-words">{AGENT_LABELS[run.agent_id]}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatTokenCount(run.input_tokens)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatTokenCount(run.output_tokens)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatTokenCount(run.cache_read_tokens)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatTokenCount(run.cache_creation_tokens)}
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums">
                      {formatTokenCount(total)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-phantom-line font-semibold text-phantom-ink">
                <td className="pt-2 pr-3">Összesen</td>
                <td className="pt-2 pr-3 text-right tabular-nums">
                  {formatTokenCount(totals.input)}
                </td>
                <td className="pt-2 pr-3 text-right tabular-nums">
                  {formatTokenCount(totals.output)}
                </td>
                <td className="pt-2 pr-3 text-right tabular-nums">
                  {formatTokenCount(totals.cacheRead)}
                </td>
                <td className="pt-2 pr-3 text-right tabular-nums">
                  {formatTokenCount(totals.cacheCreate)}
                </td>
                <td className="pt-2 text-right tabular-nums">
                  {formatTokenCount(
                    totals.input + totals.output + totals.cacheRead + totals.cacheCreate,
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AnalysisWorkspace({
  documents,
  phase,
  auditStatus,
  auditReport,
  auditError,
  onAnalyze,
  sessionId,
  onCitationClick,
  onCloseReport,
}: AnalysisWorkspaceProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('findings')
  const successfulDocuments = documents.filter((document) => document.status === 'success')
  const status = resolvePhasePill(phase)
  const canCloseReport = phase === 'failed'

  const tabs: { id: TabId; label: string }[] = [
    { id: 'findings', label: 'Megállapítások' },
    { id: 'agent_runs', label: 'Ügynök futtatások' },
    { id: 'telemetry', label: 'Telemetria' },
  ]

  return (
    <section className="h-full min-w-0 overflow-y-auto overflow-x-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-md animate-phantom-fade-in [scrollbar-gutter:stable] sm:p-5 lg:p-6">
      <div className="mb-4 min-h-14 rounded-xl border border-gray-100 bg-slate-50 px-4 py-3 animate-phantom-fade-in-down">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-semibold text-gray-900">Riport</p>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={[
                'inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold leading-none whitespace-nowrap',
                headerStatusToneClasses[status.tone],
              ].join(' ')}
            >
              {status.label}
            </span>
            {canCloseReport && (
              <button
                type="button"
                onClick={onCloseReport}
                className="group/close inline-flex min-h-8 items-center justify-center gap-1 rounded-phantom-control border border-phantom-line bg-phantom-surface-muted px-2.5 py-1 text-xs font-semibold text-phantom-muted transition-phantom duration-phantom-base hover:-translate-y-px hover:border-phantom-accent hover:text-phantom-ink hover:shadow-phantom-soft active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus"
                aria-label="Riport bezárása"
              >
                <X className="h-3.5 w-3.5 transition-transform duration-phantom-base group-hover/close:rotate-90" />
                <span className="hidden sm:inline">Bezárás</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {phase === 'empty' && (
        <section
          aria-label="Riport előnézet betöltése"
          className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 animate-pulse"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="h-5 w-2/5 rounded-md bg-gray-200" />
            <div className="h-6 w-20 rounded-full bg-gray-200" />
          </div>

          <div className="space-y-2">
            <div className="h-3 w-full rounded-md bg-gray-200" />
            <div className="h-3 w-11/12 rounded-md bg-gray-200" />
            <div className="h-3 w-3/4 rounded-md bg-gray-200" />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="h-16 rounded-md bg-gray-200" />
            <div className="h-16 rounded-md bg-gray-200" />
            <div className="h-16 rounded-md bg-gray-200" />
          </div>

          <div className="flex h-40 items-end gap-2 rounded-md bg-gray-100 p-3">
            <div className="h-1/3 flex-1 rounded-md bg-gray-200" />
            <div className="h-2/3 flex-1 rounded-md bg-gray-200" />
            <div className="h-1/2 flex-1 rounded-md bg-gray-200" />
            <div className="h-3/4 flex-1 rounded-md bg-gray-200" />
            <div className="h-2/5 flex-1 rounded-md bg-gray-200" />
            <div className="h-4/5 flex-1 rounded-md bg-gray-200" />
          </div>

          <div className="space-y-2 pt-1">
            <div className="h-3 w-1/3 rounded-md bg-gray-200" />
            <div className="h-3 w-2/3 rounded-md bg-gray-200" />
          </div>
        </section>
      )}

      {phase === 'ready' && (
        <div className="rounded-phantom-card border border-phantom-line bg-phantom-surface p-4 animate-phantom-fade-in-up">
          <p className="text-sm text-phantom-ink">
            Sikeres dokumentumok: {successfulDocuments.length}
          </p>
          <button
            type="button"
            onClick={onAnalyze}
            className={[
              phantomDesign.components.buttonBase,
              phantomDesign.components.buttonPrimary,
              'group/analyze mt-3 h-10 min-h-8 w-full px-3 py-1.5 text-xs shadow-phantom-soft hover:scale-[1.02] hover:shadow-phantom-lift active:scale-95 sm:w-auto',
            ].join(' ')}
          >
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 transition-transform duration-phantom-base group-hover/analyze:rotate-12 group-hover/analyze:scale-125" />
              Elemzés indítása
            </span>
          </button>
        </div>
      )}

      {phase === 'blocked' && (
        <div className="rounded-phantom-card border border-phantom-danger-border bg-phantom-danger-soft p-4 animate-phantom-fade-in-down">
          <p className="text-sm font-semibold text-phantom-danger-text">
            Nem indítható az elemzés
          </p>
          <p className="mt-1 break-words text-xs text-phantom-danger-text">
            Töltsd fel és osztályozd helyesen mind az 5 kötelező kategóriát: Master File, Local File, Contract, Benchmark Study, Invoice.
          </p>
        </div>
      )}

      {(phase === 'starting' || phase === 'polling') && <ProgressView status={auditStatus} />}

      {phase === 'failed' && (
        <div className="rounded-phantom-card border border-rose-200 bg-rose-50 p-4 text-rose-900 animate-phantom-fade-in-down">
          <p className="text-sm font-semibold">Audit hiba</p>
          <p className="mt-1 text-sm">{auditError ?? 'Ismeretlen hiba történt.'}</p>
        </div>
      )}

      {phase === 'completed' && auditReport && (
        <div className="min-w-0 space-y-3">
          {/* Agent status strip — always visible above tabs */}
          <div className="animate-phantom-fade-in-up" style={{ animationDelay: '60ms' }}>
            <AgentStatusStrip mode="completed" agentRuns={auditReport.agent_runs} />
          </div>

          {/* Tab bar */}
          <div className="flex min-w-0 flex-wrap gap-1.5 animate-phantom-fade-in-up" style={{ animationDelay: '140ms' }} role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'relative h-7 shrink-0 whitespace-nowrap rounded-phantom-control px-3 text-xs font-medium transition-phantom duration-phantom-base hover:-translate-y-px hover:shadow-phantom-soft active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus',
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-gray-300 shadow-phantom-soft'
                    : 'bg-phantom-surface-muted text-phantom-muted hover:bg-blue-50/60 hover:text-blue-700',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div key={activeTab} className="animate-phantom-fade-in-up">
            {activeTab === 'findings' && (
              <FindingsView
                report={auditReport}
                sessionId={sessionId}
                onCitationClick={onCitationClick}
              />
            )}
            {activeTab === 'agent_runs' && <AgentRunsView report={auditReport} />}
            {activeTab === 'telemetry' && <TelemetryView report={auditReport} />}
          </div>
        </div>
      )}
    </section>
  )
}
