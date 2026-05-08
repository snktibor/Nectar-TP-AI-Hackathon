import { AlertCircle, CheckCircle2, Clock, LoaderCircle } from 'lucide-react'
import {
  AGENT_LABELS,
  ALL_AGENT_IDS,
  type AgentId,
  type AgentProgressStatus,
  type BackendAgentRunResult,
  type BackendAgentRunStatus,
} from '../lib/backendAudit'

type AgentStatusStripProps =
  | { readonly mode: 'polling'; readonly agentProgress: Partial<Record<AgentId, AgentProgressStatus>> }
  | { readonly mode: 'completed'; readonly agentRuns: BackendAgentRunResult[] }

interface CellStatus {
  status: AgentProgressStatus | BackendAgentRunStatus
  toolCalls?: number
}

function resolvePollingStatuses(
  agentProgress: Partial<Record<AgentId, AgentProgressStatus>>,
): Record<AgentId, CellStatus> {
  const result = {} as Record<AgentId, CellStatus>
  for (const id of ALL_AGENT_IDS) {
    result[id] = { status: agentProgress[id] ?? 'pending' }
  }
  return result
}

function resolveCompletedStatuses(agentRuns: BackendAgentRunResult[]): Record<AgentId, CellStatus> {
  const result = {} as Record<AgentId, CellStatus>
  for (const id of ALL_AGENT_IDS) {
    const run = agentRuns.find((r) => r.agent_id === id)
    result[id] = run
      ? { status: run.status, toolCalls: run.tool_calls }
      : { status: 'pending' }
  }
  return result
}

function cellClasses(status: AgentProgressStatus | BackendAgentRunStatus): string {
  switch (status) {
    case 'running':
      return 'border-phantom-accent bg-phantom-accent-soft text-phantom-accent'
    case 'ok':
      return 'border-phantom-severity-low-border bg-phantom-severity-low-soft text-phantom-severity-low-text'
    case 'timeout':
    case 'error':
      return 'border-phantom-severity-critical-border bg-phantom-severity-critical-soft text-phantom-severity-critical-text'
    default:
      return 'border-phantom-line bg-phantom-surface-muted text-phantom-subtle'
  }
}

function StatusIcon({
  status,
}: Readonly<{ status: AgentProgressStatus | BackendAgentRunStatus }>): JSX.Element {
  switch (status) {
    case 'running':
      return <LoaderCircle className="force-spin h-3.5 w-3.5 animate-spin" />
    case 'ok':
      return <CheckCircle2 className="h-3.5 w-3.5" />
    case 'timeout':
    case 'error':
      return <AlertCircle className="h-3.5 w-3.5" />
    default:
      return <Clock className="h-3.5 w-3.5 opacity-40" />
  }
}

function statusText(status: AgentProgressStatus | BackendAgentRunStatus): string {
  switch (status) {
    case 'running':
      return 'Fut…'
    case 'ok':
      return 'Kész'
    case 'timeout':
      return 'Időtúllépés'
    case 'error':
      return 'Hiba'
    default:
      return 'Várakozik'
  }
}

export default function AgentStatusStrip(props: AgentStatusStripProps): JSX.Element {
  const statuses =
    props.mode === 'polling'
      ? resolvePollingStatuses(props.agentProgress)
      : resolveCompletedStatuses(props.agentRuns)

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {ALL_AGENT_IDS.map((id) => {
        const { status, toolCalls } = statuses[id]
        return (
          <div
            key={id}
            className={[
              'rounded-phantom-card border p-2.5 transition-phantom',
              cellClasses(status),
            ].join(' ')}
          >
            <div className="flex items-center gap-1.5">
              <StatusIcon status={status} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.05em]">
                {statusText(status)}
              </span>
            </div>
            <p className="mt-1 truncate text-xs font-medium leading-tight">
              {AGENT_LABELS[id]}
            </p>
            {toolCalls !== undefined && (
              <p className="mt-0.5 text-[10px] opacity-60">
                Eszközhívás: {toolCalls}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
