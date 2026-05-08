export type DocumentType =
  | 'MASTER_FILE'
  | 'LOCAL_FILE'
  | 'CONTRACT'
  | 'BENCHMARK_STUDY'
  | 'INVOICE'
  | 'OTHER'

export type AgentRunStatus = 'ok' | 'timeout' | 'error'

export interface EvidenceChunk {
  filename: string
  page: number
  chunk_index: number
  quote?: string | null
}

export interface FindingAttribution {
  agent_id: string
  doc_type_scope: DocumentType
  confidence: number
  evidence_chunks: EvidenceChunk[]
  rule_id?: string | null
  prompt_version?: string | null
}

export interface AgentRunResult {
  agent_id: string
  doc_type_scope: DocumentType
  prompt_version: string
  model: string
  started_at: string
  finished_at: string
  tool_calls: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_creation_tokens: number
  consistency_errors: ConsistencyError[]
  benchmark_risks: BenchmarkRisk[]
  missing_elements: MissingElement[]
  status: AgentRunStatus
  error: ErrorDetail | null
}

export type AuditStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'

export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface ErrorDetail {
  code: string
  message: string
}

export interface ResponseMeta {
  request_id: string
  timestamp: string
  api_version: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: ErrorDetail | null
  meta: ResponseMeta
}

export interface DocumentUploadResponse {
  document_id: string
  session_id: string
  document_type: DocumentType
  filename: string
  size_bytes: number
  uploaded_at: string
}

// ---------------------------------------------------------------------------
// Document Ingest
// ---------------------------------------------------------------------------

export interface IngestedDocument {
  document_id: string
  filename: string
  size_bytes: number
  detected_type: string
  confidence: number
  page_count: number
  chunk_count: number
  status: 'success' | 'failed'
  error: string | null
}

export interface IngestResponse {
  session_id: string
  total_files: number
  processed: number
  failed: number
  documents: IngestedDocument[]
}

// ---------------------------------------------------------------------------
// Audits
// ---------------------------------------------------------------------------

export interface AuditStartResponse {
  audit_task_id: string
  session_id: string
  status: AuditStatus
  accepted_at: string
}

export interface AuditStatusResponse {
  audit_task_id: string
  session_id: string
  status: AuditStatus
  progress: number
  stage: string
  started_at: string
  updated_at: string
  error: ErrorDetail | null
  agent_progress?: Record<string, string> | null
}

export interface ConsistencyError {
  error_id: string
  description: string
  severity: RiskSeverity
  source_documents: string[]
  evidence: string | null
  attribution?: FindingAttribution | null
}

export interface BenchmarkRisk {
  risk_id: string
  metric: string
  observed_value: number
  benchmark_range: [number, number]
  severity: RiskSeverity
  rationale: string
  attribution?: FindingAttribution | null
}

export interface MissingElement {
  element_id: string
  name: string
  required_by: string
  severity: RiskSeverity
  attribution?: FindingAttribution | null
}

export interface AuditReport {
  audit_task_id: string
  session_id: string
  generated_at: string
  consistency_errors: ConsistencyError[]
  benchmark_risks: BenchmarkRisk[]
  missing_elements: MissingElement[]
  overall_risk: RiskSeverity
  summary: string
  agent_runs?: AgentRunResult[]
}
