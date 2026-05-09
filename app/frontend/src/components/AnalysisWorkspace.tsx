import { useState } from 'react'
import { AlertCircle, BarChart2, ClipboardList, Cpu, DatabaseZap, SearchCheck, Sparkles, Wrench, X } from 'lucide-react'
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
    <section className="space-y-3">
      <div className="rounded-phantom-card border border-phantom-line bg-phantom-surface p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-5 w-5 shrink-0">
            <div className="force-spin h-5 w-5 animate-spin rounded-full border-2 border-phantom-accent border-t-transparent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-phantom-ink">
              {status ? formatStageLabel(status.stage) : 'Audit indítás'}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-phantom-surface-muted ring-1 ring-phantom-line">
              <div
                className="h-full rounded-full bg-phantom-accent transition-phantom duration-phantom-slow"
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold text-phantom-subtle">{progressValue}%</p>
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
  const filteredFindings = allFindings.filter((f) => matchesSeverityFilter(f, severityFilter))

  const grouped = groupFindingsByAgent(allFindings)

  const severityOptions: BackendRiskSeverity[] = ['critical', 'high', 'medium', 'low']

  return (
    <div className="space-y-3">
      {/* Summary banner */}
      <section className="min-w-0 overflow-hidden rounded-phantom-card border border-phantom-line bg-phantom-surface p-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <p className="min-w-0 flex-1 break-words text-sm leading-6 text-phantom-ink">{report.summary}</p>
          <span
            className={[
              'inline-flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-semibold uppercase whitespace-nowrap',
              getSeverityTone(report.overall_risk),
            ].join(' ')}
          >
            {severityLabel(report.overall_risk)}
          </span>
        </div>
      </section>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-2 xs:grid-cols-2 sm:grid-cols-3">
        <MetricCard
          icon={AlertCircle}
          label={'Konzisztencia\nhibák'}
          value={String(report.consistency_errors.length)}
        />
        <MetricCard
          icon={BarChart2}
          label={'Benchmark\nkockázatok'}
          value={String(report.benchmark_risks.length)}
        />
        <MetricCard
          icon={ClipboardList}
          label={'Hiányzó\nelemek'}
          value={String(report.missing_elements.length)}
        />
      </div>

      {/* Severity filter */}
      <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-5">
        <button
          type="button"
          onClick={() => setSeverityFilter(null)}
          className={[
            'inline-flex h-7 w-full items-center justify-center whitespace-nowrap rounded-full px-3 text-xs font-medium transition-phantom focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus',
            severityFilter === null
              ? 'bg-phantom-accent-soft text-phantom-accent'
              : 'bg-phantom-surface-muted text-phantom-muted',
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
              'inline-flex h-7 w-full items-center justify-center whitespace-nowrap rounded-full px-3 text-xs font-medium transition-phantom focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus',
              severityFilter === s
                ? getSeverityFilterTone(s)
                : 'bg-phantom-surface-muted text-phantom-muted',
            ].join(' ')}
          >
            {severityLabel(s)}
          </button>
        ))}
      </div>

      {/* Per-agent accordion */}
      <div className="space-y-2">
        {ALL_AGENT_IDS.map((agentId) => {
          const bucket = grouped.get(agentId)
          if (!bucket || bucket.length === 0) return null
          const filtered = bucket.filter((f) => matchesSeverityFilter(f, severityFilter))
          if (filtered.length === 0) return null

          return (
            <details
              key={agentId}
              className="rounded-phantom-card border border-phantom-line bg-phantom-surface"
              open
            >
              <summary className="flex min-w-0 cursor-pointer select-none items-center justify-between gap-2 p-3">
                <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-5 text-phantom-ink">
                  {AGENT_LABELS[agentId]}
                </span>
                <StatusPill tone="neutral">{filtered.length}</StatusPill>
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
              className="rounded-phantom-card border border-phantom-line bg-phantom-surface"
              open
            >
              <summary className="flex min-w-0 cursor-pointer select-none items-center justify-between gap-2 p-3">
                <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-5 text-phantom-ink">Nincs ügynök</span>
                <StatusPill tone="neutral">{filtered.length}</StatusPill>
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

      {/* Flat severity list (single section-level scrollbar) */}
      <section className="min-w-0 overflow-hidden rounded-phantom-card border border-phantom-line bg-phantom-surface p-4">
        <p className="mb-2 break-words text-sm font-semibold text-phantom-ink">
          Összes megállapítás ({filteredFindings.length})
        </p>
        <div className="space-y-2">
          {filteredFindings.length > 0 ? (
            filteredFindings.map((f) => (
              <FindingCard
                key={findingKey(f)}
                variant={f}
                showAgentBadge={true}
                sessionId={sessionId}
                onCitationClick={onCitationClick}
              />
            ))
          ) : (
            <p className="break-words text-sm font-normal text-phantom-ink">
              {severityFilter
                ? `${severityLabel(severityFilter)} szinten nincs megállapítás.`
                : 'Nincs megállapítás.'}
            </p>
          )}
        </div>
      </section>

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
    <div className="space-y-2">
      {report.agent_runs.map((run) => {
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

        return (
          <article
            key={run.agent_id}
            className="min-w-0 overflow-hidden rounded-phantom-card border border-phantom-line bg-phantom-surface p-4"
          >
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 break-words text-sm font-semibold leading-5 text-phantom-ink">
                {AGENT_LABELS[run.agent_id]}
              </p>
              <StatusPill tone={statusTone}>{statusText}</StatusPill>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-phantom-muted xs:grid-cols-2 lg:grid-cols-3">
              <span className="break-words">Modell: {run.model}</span>
              <span className="break-words">Prompt: {run.prompt_version}</span>
              <span className="break-words">Időtartam: {formatDurationMs(run.started_at, run.finished_at)}</span>
            </div>

            <div className="mt-2 flex flex-wrap gap-3 text-xs text-phantom-ink">
              <span>Konzisztencia: {run.consistency_errors.length}</span>
              <span>Benchmark: {run.benchmark_risks.length}</span>
              <span>Hiányzó: {run.missing_elements.length}</span>
              <span className="text-phantom-muted">Összesen: {findingCount}</span>
            </div>

            {run.status === 'error' && run.error && (
              <div className="mt-2 break-words rounded-phantom-control border border-phantom-severity-critical-border bg-phantom-severity-critical-soft px-3 py-2 text-xs text-phantom-severity-critical-text">
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Cpu} label="Bemenet (token)" value={formatTokenCount(totals.input)} />
        <MetricCard icon={Cpu} label="Kimenet (token)" value={formatTokenCount(totals.output)} />
        <MetricCard icon={DatabaseZap} label="Cache olvasás" value={formatTokenCount(totals.cacheRead)} />
        <MetricCard icon={Wrench} label={'Eszköz\nhívások'} value={formatTokenCount(totals.toolCalls)} />
      </div>

      <section className="min-w-0 overflow-hidden rounded-phantom-card border border-phantom-line bg-phantom-surface p-4">
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
                  <tr key={run.agent_id} className="text-phantom-ink">
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
    <section className={[phantomDesign.components.panel, 'h-full min-w-0 overflow-x-hidden shadow-none'].join(' ')}>
      <div className="mb-4 min-h-14 rounded-phantom-card border border-phantom-line bg-phantom-surface px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-semibold text-phantom-ink">Riport</p>
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
                className="inline-flex min-h-8 items-center justify-center gap-1 rounded-phantom-control border border-phantom-line bg-phantom-surface-muted px-2.5 py-1 text-xs font-semibold text-phantom-muted transition-phantom duration-phantom-base hover:border-phantom-accent hover:text-phantom-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus"
                aria-label="Riport bezárása"
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Bezárás</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {phase === 'empty' && (
        <section className="group flex flex-col items-center justify-center gap-4 rounded-phantom-card border border-dashed border-phantom-line bg-phantom-surface-muted p-6 text-center transition-phantom duration-phantom-base sm:p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-phantom-card bg-phantom-surface text-phantom-accent shadow-phantom-soft ring-1 ring-phantom-line">
            <SearchCheck className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold text-phantom-ink">Nincs riport</p>
            <p className="mt-1 text-xs leading-5 text-phantom-muted">
              Tölts fel legalább egy dokumentumot.
            </p>
          </div>
        </section>
      )}

      {phase === 'ready' && (
        <div className="rounded-phantom-card border border-phantom-line bg-phantom-surface p-4">
          <p className="text-sm text-phantom-ink">
            Sikeres dokumentumok: {successfulDocuments.length}
          </p>
          <button
            type="button"
            onClick={onAnalyze}
            className={[
              phantomDesign.components.buttonBase,
              phantomDesign.components.buttonPrimary,
              'mt-3 w-full min-h-9 px-3 py-2 text-xs shadow-phantom-soft hover:translate-y-0 hover:shadow-phantom-soft active:shadow-phantom-soft sm:w-auto',
            ].join(' ')}
          >
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Elemzés indítása
            </span>
          </button>
        </div>
      )}

      {phase === 'blocked' && (
        <div className="rounded-phantom-card border border-phantom-danger-border bg-phantom-danger-soft p-4">
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
        <div className="rounded-phantom-card border border-rose-200 bg-rose-50 p-4 text-rose-900">
          <p className="text-sm font-semibold">Audit hiba</p>
          <p className="mt-1 text-sm">{auditError ?? 'Ismeretlen hiba történt.'}</p>
        </div>
      )}

      {phase === 'completed' && auditReport && (
        <div className="min-w-0 space-y-3">
          {/* Agent status strip — always visible above tabs */}
          <AgentStatusStrip mode="completed" agentRuns={auditReport.agent_runs} />

          {/* Tab bar */}
          <div className="flex min-w-0 flex-wrap gap-1.5" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'h-7 shrink-0 whitespace-nowrap rounded-phantom-control px-3 text-xs font-medium transition-phantom focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus',
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200'
                    : 'bg-phantom-surface-muted text-phantom-muted',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
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
      )}
    </section>
  )
}
