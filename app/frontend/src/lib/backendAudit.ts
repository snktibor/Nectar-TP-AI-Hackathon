export type BackendAuditStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export type BackendRiskSeverity = 'low' | 'medium' | 'high' | 'critical'

export type BackendAgentRunStatus = 'ok' | 'timeout' | 'error'

export type AgentId =
  | 'master_file_agent'
  | 'local_file_agent'
  | 'benchmark_agent'
  | 'contract_agent'
  | 'invoice_agent'
  | 'cross_doc_consistency_agent'

export type AgentProgressStatus = 'pending' | 'running' | 'ok' | 'timeout' | 'error'

export type BackendDocTypeScope =
  | 'master_file'
  | 'local_file'
  | 'contract'
  | 'benchmark_study'
  | 'invoice'
  | 'other'
  | 'cross_document'

export type WorkspacePhase =
  | 'empty'
  | 'blocked'
  | 'ready'
  | 'starting'
  | 'polling'
  | 'completed'
  | 'failed'

export interface BackendErrorDetail {
  readonly code: string
  readonly message: string
  readonly details?: Record<string, unknown> | null
}

export interface BackendEvidenceChunk {
  readonly filename: string
  /** Source page label from backend evidence metadata; convert before PDF navigation. */
  readonly page: number
  readonly chunk_index: number
  readonly quote?: string | null
  readonly source_kind?: 'document' | 'legal' | null
  readonly char_start?: number | null
  readonly char_end?: number | null
}

export interface BackendFindingAttribution {
  readonly agent_id: AgentId
  readonly doc_type_scope: BackendDocTypeScope
  readonly confidence: number
  readonly evidence_chunks: BackendEvidenceChunk[]
  readonly rule_id?: string | null
  readonly prompt_version?: string | null
  readonly reasoning?: string | null
  readonly uncertainty_notes?: string | null
  readonly requires_human_review?: boolean | null
  readonly legal_references?: readonly string[]
}

export interface BackendAuditStartResponse {
  readonly audit_task_id: string
  readonly session_id: string
  readonly status: BackendAuditStatus
  readonly accepted_at: string
}

export interface BackendAuditStatusResponse {
  readonly audit_task_id: string
  readonly session_id: string
  readonly status: BackendAuditStatus
  readonly progress: number
  readonly stage: string
  readonly started_at: string
  readonly updated_at: string
  readonly error: BackendErrorDetail | null
  readonly agent_progress?: Partial<Record<AgentId, AgentProgressStatus>> | null
}

export interface BackendErrorLocation {
  readonly filename: string
  readonly line_numbers: number[] | null
}

export interface BackendConsistencyError {
  readonly error_id: string
  readonly description: string
  readonly severity: BackendRiskSeverity
  readonly locations: BackendErrorLocation[]
  readonly evidence: string | null
  readonly attribution?: BackendFindingAttribution | null
}

export interface BackendBenchmarkRisk {
  readonly risk_id: string
  readonly metric: string
  readonly observed_value: number
  readonly benchmark_range: [number, number]
  readonly severity: BackendRiskSeverity
  readonly rationale: string
  readonly locations: BackendErrorLocation[]
  readonly attribution?: BackendFindingAttribution | null
}

export interface BackendMissingElement {
  readonly element_id: string
  readonly description: string
  readonly expected_in: string
  readonly required_by: string
  readonly severity: BackendRiskSeverity
  readonly attribution?: BackendFindingAttribution | null
}

export interface BackendAgentRunResult {
  readonly agent_id: AgentId
  readonly doc_type_scope: BackendDocTypeScope
  readonly prompt_version: string
  readonly model: string
  readonly started_at: string
  readonly finished_at: string
  readonly tool_calls: number
  readonly input_tokens: number
  readonly output_tokens: number
  readonly cache_read_tokens: number
  readonly cache_creation_tokens: number
  readonly consistency_errors: BackendConsistencyError[]
  readonly benchmark_risks: BackendBenchmarkRisk[]
  readonly missing_elements: BackendMissingElement[]
  readonly status: BackendAgentRunStatus
  readonly error: BackendErrorDetail | null
}

export interface BackendAuditReport {
  readonly audit_task_id: string
  readonly session_id: string
  readonly generated_at: string
  readonly consistency_errors: BackendConsistencyError[]
  readonly benchmark_risks: BackendBenchmarkRisk[]
  readonly missing_elements: BackendMissingElement[]
  readonly overall_risk: BackendRiskSeverity
  readonly summary: string
  readonly agent_runs: BackendAgentRunResult[]
}

export interface BackendSeverityBreakdown {
  readonly critical: number
  readonly high: number
  readonly medium: number
  readonly low: number
}

export interface BackendSeverityTypeMatrixRow {
  readonly severity: BackendRiskSeverity
  readonly consistency: number
  readonly benchmark: number
  readonly completeness: number
  readonly total: number
}

export interface BackendSeverityTransactionMatrixRow {
  readonly transaction_type: string
  readonly critical: number
  readonly high: number
  readonly medium: number
  readonly low: number
  readonly total: number
  readonly dominant_issue: string
}

export interface BackendFinancialEstimateLineItem {
  readonly item: string
  readonly legal_basis: string | null
  readonly amount_huf: number
  readonly notes: string | null
}

export interface BackendFinancialEstimate {
  readonly line_items: BackendFinancialEstimateLineItem[]
  readonly estimated_tax_shortfall_huf: number
  readonly default_penalty_huf: number
  readonly bad_faith_penalty_huf: number
  readonly delay_interest_huf: number
  readonly documentation_fine_huf: number
  readonly functional_adjustment_huf: number
  readonly base_total_huf: number
  readonly max_total_huf: number
}

export type BackendRemediationPhase = 'immediate_30' | 'short_90' | 'mid_180'

export type BackendFindingSourceType = 'consistency' | 'benchmark' | 'completeness'

export interface BackendRemediationAction {
  readonly finding_id: string
  readonly finding_ref: string
  readonly severity: BackendRiskSeverity
  readonly phase: BackendRemediationPhase
  readonly title: string
  readonly owner: string
  readonly due_in_days: number
  readonly recommendation: string
  readonly source_type: BackendFindingSourceType
}

export interface BackendRemediationPlan {
  readonly immediate_30: BackendRemediationAction[]
  readonly short_90: BackendRemediationAction[]
  readonly mid_180: BackendRemediationAction[]
  readonly all_actions: BackendRemediationAction[]
}

export interface BackendEnterpriseReportPayload {
  readonly audit_task_id: string
  readonly session_id: string
  readonly generated_at: string
  readonly overall_risk: BackendRiskSeverity
  readonly findings_total: number
  readonly severity_breakdown: BackendSeverityBreakdown
  readonly severity_type_matrix: BackendSeverityTypeMatrixRow[]
  readonly severity_transaction_matrix: BackendSeverityTransactionMatrixRow[]
  readonly financial_estimate: BackendFinancialEstimate
  readonly remediation_plan: BackendRemediationPlan
  readonly source_report: BackendAuditReport
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AGENT_LABELS: Record<AgentId, string> = {
  master_file_agent: 'Fő fájl ügynök',
  local_file_agent: 'Helyi fájl ügynök',
  benchmark_agent: 'Benchmark ügynök',
  contract_agent: 'Szerződés ügynök',
  invoice_agent: 'Számla ügynök',
  cross_doc_consistency_agent: 'Kereszt-dokumentum ügynök',
}

export const ALL_AGENT_IDS: AgentId[] = [
  'master_file_agent',
  'local_file_agent',
  'benchmark_agent',
  'contract_agent',
  'invoice_agent',
  'cross_doc_consistency_agent',
]

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

export function getSeverityTone(severity: BackendRiskSeverity): string {
  switch (severity) {
    case 'critical':
      return 'bg-phantom-severity-critical-soft text-phantom-severity-critical-text border border-phantom-severity-critical-border'
    case 'high':
      return 'bg-phantom-severity-high-soft text-phantom-severity-high-text border border-phantom-severity-high-border'
    case 'medium':
      return 'bg-phantom-severity-medium-soft text-phantom-severity-medium-text border border-phantom-severity-medium-border'
    case 'low':
      return 'bg-phantom-severity-low-soft text-phantom-severity-low-text border border-phantom-severity-low-border'
    default:
      return 'bg-neutral-100 text-neutral-700 border border-neutral-200'
  }
}

export function getSeverityBorderClass(severity: BackendRiskSeverity): string {
  switch (severity) {
    case 'critical':
      return 'border-l-phantom-severity-critical-border'
    case 'high':
      return 'border-l-phantom-severity-high-border'
    case 'medium':
      return 'border-l-phantom-severity-medium-border'
    case 'low':
      return 'border-l-phantom-severity-low-border'
    default:
      return 'border-l-phantom-line'
  }
}

export function severityLabel(severity: BackendRiskSeverity): string {
  switch (severity) {
    case 'critical':
      return 'Kritikus'
    case 'high':
      return 'Magas'
    case 'medium':
      return 'Közepes'
    case 'low':
      return 'Alacsony'
    default:
      return severity
  }
}

const SEVERITY_ORDER: Record<BackendRiskSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export function compareSeverityDesc(a: BackendRiskSeverity, b: BackendRiskSeverity): number {
  return SEVERITY_ORDER[a] - SEVERITY_ORDER[b]
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatStageLabel(stage: string): string {
  return stage
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function formatAgentKey(agentId: string): string {
  return agentId
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function formatDurationMs(startedAt: string, finishedAt: string): string {
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 0) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1).replace('.', ',')} s`
}

export function formatTokenCount(n: number): string {
  return n.toLocaleString('hu-HU')
}
