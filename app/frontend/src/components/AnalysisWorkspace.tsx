import { useState } from 'react'
import { AlertCircle, BarChart2, ClipboardList, Cpu, DatabaseZap, SearchCheck, Sparkles, Wrench } from 'lucide-react'
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
import type { IngestedDocument } from '../types/api'
import AgentStatusStrip from './AgentStatusStrip'
import FindingCard from './FindingCard'
import { EmptyPanel, MetricCard, StatusPill } from './ui/DashboardPrimitives'

type TabId = 'findings' | 'agent_runs' | 'telemetry'
type StatusPillTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

interface AnalysisWorkspaceProps {
  readonly documents: IngestedDocument[]
  readonly phase: WorkspacePhase
  readonly auditStatus: BackendAuditStatusResponse | null
  readonly auditReport: BackendAuditReport | null
  readonly auditError: string | null
  readonly onAnalyze: () => void
}

function resolvePhasePill(phase: WorkspacePhase): { label: string; tone: StatusPillTone } {
  if (phase === 'completed') return { label: 'Riport kész', tone: 'success' }
  if (phase === 'polling' || phase === 'starting') return { label: 'Audit fut', tone: 'accent' }
  if (phase === 'ready') return { label: 'Indítható', tone: 'info' }
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
    const key: AgentId | 'other' = agentId ?? 'other'
    const bucket = map.get(key) ?? []
    bucket.push(f)
    map.set(key, bucket)
  }
  return map
}

// ---------------------------------------------------------------------------
// FindingsView
// ---------------------------------------------------------------------------

function FindingsView({ report }: Readonly<{ report: BackendAuditReport }>): JSX.Element {
  const [severityFilter, setSeverityFilter] = useState<BackendRiskSeverity | null>(null)

  const allFindings = flattenFindings(report)
  const filteredFindings = severityFilter
    ? allFindings.filter((f) => f.finding.severity === severityFilter)
    : allFindings

  const grouped = groupFindingsByAgent(allFindings)

  const severityOptions: BackendRiskSeverity[] = ['critical', 'high', 'medium', 'low']

  return (
    <div className="space-y-3">
      {/* Summary banner */}
      <section className="rounded-phantom-card border border-phantom-line bg-phantom-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm leading-6 text-phantom-ink">{report.summary}</p>
          <span
            className={[
              'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase',
              getSeverityTone(report.overall_risk),
            ].join(' ')}
          >
            {severityLabel(report.overall_risk)}
          </span>
        </div>
      </section>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard
          icon={AlertCircle}
          label="Konzisztencia hibák"
          value={String(report.consistency_errors.length)}
        />
        <MetricCard
          icon={BarChart2}
          label="Benchmark kockázatok"
          value={String(report.benchmark_risks.length)}
        />
        <MetricCard
          icon={ClipboardList}
          label="Hiányzó elemek"
          value={String(report.missing_elements.length)}
        />
      </div>

      {/* Severity filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setSeverityFilter(null)}
          className={[
            'rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-phantom',
            severityFilter === null
              ? 'bg-phantom-accent-soft text-phantom-accent ring-phantom-accent/30'
              : 'bg-phantom-surface-muted text-phantom-muted ring-phantom-line hover:bg-phantom-surface',
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
              'rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-phantom',
              severityFilter === s
                ? getSeverityTone(s)
                : 'bg-phantom-surface-muted text-phantom-muted ring-phantom-line hover:bg-phantom-surface',
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
          const filtered = severityFilter
            ? bucket.filter((f) => f.finding.severity === severityFilter)
            : bucket
          if (filtered.length === 0) return null

          return (
            <details
              key={agentId}
              className="rounded-phantom-card border border-phantom-line bg-phantom-surface"
              open
            >
              <summary className="flex cursor-pointer select-none items-center justify-between gap-2 p-3">
                <span className="text-sm font-semibold text-phantom-ink">
                  {AGENT_LABELS[agentId]}
                </span>
                <StatusPill tone="neutral">{filtered.length}</StatusPill>
              </summary>
              <div className="space-y-2 border-t border-phantom-line p-3">
                {filtered.map((f) => (
                  <FindingCard key={findingKey(f)} variant={f} showAgentBadge={false} />
                ))}
              </div>
            </details>
          )
        })}

        {/* Findings without attribution */}
        {(() => {
          const bucket = grouped.get('other')
          if (!bucket || bucket.length === 0) return null
          const filtered = severityFilter
            ? bucket.filter((f) => f.finding.severity === severityFilter)
            : bucket
          if (filtered.length === 0) return null
          return (
            <details
              className="rounded-phantom-card border border-phantom-line bg-phantom-surface"
              open
            >
              <summary className="flex cursor-pointer select-none items-center justify-between gap-2 p-3">
                <span className="text-sm font-semibold text-phantom-ink">Nincs ügynök</span>
                <StatusPill tone="neutral">{filtered.length}</StatusPill>
              </summary>
              <div className="space-y-2 border-t border-phantom-line p-3">
                {filtered.map((f) => (
                  <FindingCard key={findingKey(f)} variant={f} showAgentBadge={false} />
                ))}
              </div>
            </details>
          )
        })()}
      </div>

      {/* Flat severity list */}
      {filteredFindings.length > 0 && (
        <section className="rounded-phantom-card border border-phantom-line bg-phantom-surface p-4">
          <p className="mb-2 text-sm font-semibold text-phantom-ink">
            Összes megállapítás ({filteredFindings.length})
          </p>
          <div className="space-y-2">
            {filteredFindings.map((f) => (
              <FindingCard key={findingKey(f)} variant={f} showAgentBadge={true} />
            ))}
          </div>
        </section>
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
    <div className="space-y-2">
      {report.agent_runs.map((run) => {
        const statusTone: StatusPillTone =
          run.status === 'ok' ? 'success' : run.status === 'timeout' ? 'warning' : 'danger'
        const statusText =
          run.status === 'ok' ? 'Kész' : run.status === 'timeout' ? 'Időtúllépés' : 'Hiba'
        const findingCount =
          run.consistency_errors.length + run.benchmark_risks.length + run.missing_elements.length

        return (
          <article
            key={run.agent_id}
            className="rounded-phantom-card border border-phantom-line bg-phantom-surface p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-semibold text-phantom-ink">
                {AGENT_LABELS[run.agent_id]}
              </p>
              <StatusPill tone={statusTone}>{statusText}</StatusPill>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-phantom-muted sm:grid-cols-3">
              <span>Modell: {run.model}</span>
              <span>Prompt: {run.prompt_version}</span>
              <span>Időtartam: {formatDurationMs(run.started_at, run.finished_at)}</span>
            </div>

            <div className="mt-2 flex flex-wrap gap-3 text-xs text-phantom-ink">
              <span>Konzisztencia: {run.consistency_errors.length}</span>
              <span>Benchmark: {run.benchmark_risks.length}</span>
              <span>Hiányzó: {run.missing_elements.length}</span>
              <span className="text-phantom-muted">Összesen: {findingCount}</span>
            </div>

            {run.status === 'error' && run.error && (
              <div className="mt-2 rounded-phantom-control border border-phantom-severity-critical-border bg-phantom-severity-critical-soft px-3 py-2 text-xs text-phantom-severity-critical-text">
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard icon={Cpu} label="Bemenet (token)" value={formatTokenCount(totals.input)} />
        <MetricCard icon={Cpu} label="Kimenet (token)" value={formatTokenCount(totals.output)} />
        <MetricCard icon={DatabaseZap} label="Cache olvasás" value={formatTokenCount(totals.cacheRead)} />
        <MetricCard icon={Wrench} label="Eszközhívások" value={formatTokenCount(totals.toolCalls)} />
      </div>

      <section className="rounded-phantom-card border border-phantom-line bg-phantom-surface p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-phantom-subtle">
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
                    <td className="py-2 pr-3">{AGENT_LABELS[run.agent_id]}</td>
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
}: AnalysisWorkspaceProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('findings')
  const successfulDocuments = documents.filter((document) => document.status === 'success')
  const status = resolvePhasePill(phase)

  const tabs: { id: TabId; label: string }[] = [
    { id: 'findings', label: 'Megállapítások' },
    { id: 'agent_runs', label: 'Ügynök futtatások' },
    { id: 'telemetry', label: 'Telemetria' },
  ]

  return (
    <section className={[phantomDesign.components.panel, 'h-full'].join(' ')}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-phantom-ink">Riport</p>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
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
              'mt-3 w-full sm:w-auto',
            ].join(' ')}
          >
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Elemzés indítása
            </span>
          </button>
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
        <div className="space-y-3">
          {/* Agent status strip — always visible above tabs */}
          <AgentStatusStrip mode="completed" agentRuns={auditReport.agent_runs} />

          {/* Tab bar */}
          <div className="flex gap-1.5" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'rounded-phantom-control px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-phantom',
                  activeTab === tab.id
                    ? 'bg-phantom-accent-soft text-phantom-accent ring-phantom-accent/30'
                    : 'bg-phantom-surface-muted text-phantom-muted ring-phantom-line hover:bg-phantom-surface',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'findings' && <FindingsView report={auditReport} />}
          {activeTab === 'agent_runs' && <AgentRunsView report={auditReport} />}
          {activeTab === 'telemetry' && <TelemetryView report={auditReport} />}
        </div>
      )}
    </section>
  )
}
