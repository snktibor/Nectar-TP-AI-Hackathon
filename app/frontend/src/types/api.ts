export type DocumentType =
  | 'MASTER_FILE'
  | 'LOCAL_FILE'
  | 'CONTRACT'
  | 'BENCHMARK_STUDY'
  | 'OTHER'

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
}

export interface ConsistencyError {
  error_id: string
  description: string
  severity: RiskSeverity
  source_documents: string[]
  evidence: string | null
}

export interface BenchmarkRisk {
  risk_id: string
  metric: string
  observed_value: number
  benchmark_range: [number, number]
  severity: RiskSeverity
  rationale: string
}

export interface MissingElement {
  element_id: string
  name: string
  required_by: string
  severity: RiskSeverity
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
}
