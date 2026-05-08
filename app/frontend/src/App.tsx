import { useEffect, useRef, useState } from 'react'
import AnalysisWorkspace from './components/AnalysisWorkspace'
import DashboardShell from './components/DashboardShell'
import DocumentIngestor from './components/DocumentIngestor'
import DocumentViewer from './components/DocumentViewer'
import { phantomDesign } from './design-system/phantomDesign'
import type {
  BackendAuditReport,
  BackendAuditStartResponse,
  BackendAuditStatusResponse,
  WorkspacePhase,
} from './lib/backendAudit'
import type { CitationTarget } from './types/viewer'
import type { ApiResponse, IngestedDocument } from './types/api'

const API_BASE = import.meta.env.VITE_API_BASE_URL
const SESSION_ID = crypto.randomUUID()

type RequiredDocumentType =
  | 'master_file'
  | 'local_file'
  | 'contract'
  | 'benchmark_study'
  | 'invoice'

const REQUIRED_AUDIT_TYPES = new Set<RequiredDocumentType>([
  'master_file',
  'local_file',
  'contract',
  'benchmark_study',
  'invoice',
])

function isRequiredAuditType(value: string): value is RequiredDocumentType {
  return REQUIRED_AUDIT_TYPES.has(value as RequiredDocumentType)
}

function hasCompleteRequiredCoverage(documents: IngestedDocument[]): boolean {
  const successful = documents.filter((document) => document.status === 'success')
  if (successful.length !== REQUIRED_AUDIT_TYPES.size) {
    return false
  }

  const coveredTypes = new Set<RequiredDocumentType>()
  for (const document of successful) {
    if (!isRequiredAuditType(document.detected_type)) {
      return false
    }

    coveredTypes.add(document.detected_type)
  }

  return coveredTypes.size === REQUIRED_AUDIT_TYPES.size
}

export default function App(): JSX.Element {
  const [ingestedDocuments, setIngestedDocuments] = useState<IngestedDocument[]>([])
  const [workspacePhase, setWorkspacePhase] = useState<WorkspacePhase>('empty')
  const [auditTaskId, setAuditTaskId] = useState<string | null>(null)
  const [auditStatus, setAuditStatus] = useState<BackendAuditStatusResponse | null>(null)
  const [auditReport, setAuditReport] = useState<BackendAuditReport | null>(null)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [activeCitation, setActiveCitation] = useState<CitationTarget | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const hasReadyAuditCoverage = hasCompleteRequiredCoverage(ingestedDocuments)

  function clearPolling(): void {
    if (pollingRef.current !== null) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  function clearAuditState(): void {
    setAuditTaskId(null)
    setAuditStatus(null)
    setAuditReport(null)
    setAuditError(null)
  }

  async function fetchAuditResults(taskId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/v1/audits/results/${taskId}`)
      if (!response.ok) {
        throw new Error(`A riport lekérése sikertelen (HTTP ${response.status}).`)
      }

      const json = (await response.json()) as ApiResponse<BackendAuditReport>
      if (!json.success || !json.data) {
        throw new Error(json.error?.message ?? 'Az audit riport nem érhető el.')
      }

      setAuditReport(json.data)
      setWorkspacePhase('completed')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Az audit riport lekérése sikertelen.'
      setAuditError(message)
      setWorkspacePhase('failed')
    }
  }

  useEffect(() => {
    if (workspacePhase !== 'polling' || auditTaskId === null) {
      return
    }

    async function fetchStatus(): Promise<void> {
      if (auditTaskId === null) return

      try {
        const response = await fetch(`${API_BASE}/api/v1/audits/status/${auditTaskId}`)
        if (!response.ok) {
          throw new Error(`A státusz lekérése sikertelen (HTTP ${response.status}).`)
        }

        const json = (await response.json()) as ApiResponse<BackendAuditStatusResponse>
        if (!json.success || !json.data) {
          throw new Error(json.error?.message ?? 'Az audit státusz nem érhető el.')
        }

        const statusData = json.data
        setAuditStatus(statusData)

        if (statusData.status === 'completed') {
          clearPolling()
          await fetchAuditResults(auditTaskId)
          return
        }

        if (statusData.status === 'failed') {
          clearPolling()
          setAuditError(statusData.error?.message ?? 'Az audit futása megszakadt.')
          setWorkspacePhase('failed')
        }
      } catch (error) {
        clearPolling()
        const message = error instanceof Error ? error.message : 'Az audit státusz lekérése sikertelen.'
        setAuditError(message)
        setWorkspacePhase('failed')
      }
    }

    void fetchStatus()
    pollingRef.current = setInterval(() => {
      void fetchStatus()
    }, 1500)

    return () => {
      clearPolling()
    }
  }, [workspacePhase, auditTaskId])

  useEffect(() => {
    return () => {
      clearPolling()
    }
  }, [])

  async function handleAnalyze(): Promise<void> {
    if (!hasReadyAuditCoverage) return

    clearPolling()
    setWorkspacePhase('starting')
    clearAuditState()

    try {
      const response = await fetch(`${API_BASE}/api/v1/audits/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: SESSION_ID }),
      })

      if (!response.ok) {
        throw new Error(`Az audit indítása sikertelen (HTTP ${response.status}).`)
      }

      const json = (await response.json()) as ApiResponse<BackendAuditStartResponse>
      if (!json.success || !json.data) {
        throw new Error(json.error?.message ?? 'Az audit indítása sikertelen.')
      }

      setAuditTaskId(json.data.audit_task_id)
      setWorkspacePhase('polling')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Az audit indítása sikertelen.'
      setAuditError(message)
      setWorkspacePhase('failed')
    }
  }

  function handleIngestComplete(documents: IngestedDocument[]): void {
    clearPolling()
    setIngestedDocuments(documents)
    clearAuditState()
    setActiveCitation(null)

    if (hasCompleteRequiredCoverage(documents)) {
      setWorkspacePhase('ready')
      return
    }

    setWorkspacePhase(documents.length > 0 ? 'blocked' : 'empty')
  }

  function handleCloseReport(): void {
    clearPolling()
    clearAuditState()
    setActiveCitation(null)

    if (hasReadyAuditCoverage) {
      setWorkspacePhase('ready')
      return
    }

    setWorkspacePhase(ingestedDocuments.length > 0 ? 'blocked' : 'empty')
  }

  function handleResetWorkspaceFromLeft(): void {
    clearPolling()
    clearAuditState()
    setActiveCitation(null)
    setIngestedDocuments([])
    setWorkspacePhase('empty')
  }

  return (
    <div className={[phantomDesign.layout.page, 'h-screen'].join(' ')}>
      <main className="h-full w-full">
        <DashboardShell
          leftPanel={
            activeCitation !== null ? (
              <DocumentViewer
                citation={activeCitation}
                onClose={handleCloseReport}
              />
            ) : (
              <DocumentIngestor
                sessionId={SESSION_ID}
                onIngestComplete={handleIngestComplete}
                onResetWorkspace={handleResetWorkspaceFromLeft}
              />
            )
          }
          rightPanel={(
            <AnalysisWorkspace
              documents={ingestedDocuments}
              phase={workspacePhase}
              auditStatus={auditStatus}
              auditReport={auditReport}
              auditError={auditError}
              onAnalyze={() => void handleAnalyze()}
              sessionId={SESSION_ID}
              onCitationClick={setActiveCitation}
              onCloseReport={handleCloseReport}
            />
          )}
        />
      </main>
    </div>
  )
}
