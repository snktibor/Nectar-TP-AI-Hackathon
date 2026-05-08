import { useState, useEffect, useRef } from 'react'
import type {
  DocumentUploadResponse,
  AuditStatusResponse,
  AuditReport,
  ApiResponse,
  AuditStartResponse,
} from './types/api'
import Header from './components/Header'
import UploadPanel from './components/UploadPanel'
import type { SlotKey } from './components/UploadPanel'
import ResultsPanel from './components/ResultsPanel'
import type { AuditPhase } from './components/ResultsPanel'

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

const SESSION_ID = crypto.randomUUID()

export default function App(): JSX.Element {
  const [uploadedDocs, setUploadedDocs] = useState<
    Partial<Record<SlotKey, DocumentUploadResponse>>
  >({})
  const [auditPhase, setAuditPhase] = useState<AuditPhase>('idle')
  const [auditTaskId, setAuditTaskId] = useState<string | null>(null)
  const [auditStatus, setAuditStatus] = useState<AuditStatusResponse | null>(null)
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null)
  const [auditError, setAuditError] = useState<string | null>(null)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function clearPolling(): void {
    if (pollingRef.current !== null) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  useEffect(() => {
    if (auditPhase !== 'polling' || auditTaskId === null) return

    async function fetchStatus(): Promise<void> {
      if (auditTaskId === null) return

      try {
        const response = await fetch(
          `${API_BASE}/api/v1/audits/status/${auditTaskId}`,
        )
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        const json = (await response.json()) as ApiResponse<AuditStatusResponse>

        if (!json.success || !json.data) {
          throw new Error(json.error?.message ?? 'Status check failed')
        }

        const statusData = json.data
        setAuditStatus(statusData)

        if (statusData.status === 'COMPLETED') {
          clearPolling()
          await fetchResults(auditTaskId)
        } else if (statusData.status === 'FAILED') {
          clearPolling()
          setAuditError(statusData.error?.message ?? 'Audit failed')
          setAuditPhase('failed')
        }
      } catch (err) {
        clearPolling()
        const message = err instanceof Error ? err.message : 'Status polling failed'
        setAuditError(message)
        setAuditPhase('failed')
      }
    }

    async function fetchResults(taskId: string): Promise<void> {
      try {
        const response = await fetch(`${API_BASE}/api/v1/audits/results/${taskId}`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        const json = (await response.json()) as ApiResponse<AuditReport>

        if (!json.success || !json.data) {
          throw new Error(json.error?.message ?? 'Failed to fetch results')
        }

        setAuditReport(json.data)
        setAuditPhase('completed')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch results'
        setAuditError(message)
        setAuditPhase('failed')
      }
    }

    void fetchStatus()
    pollingRef.current = setInterval(() => {
      void fetchStatus()
    }, 1500)

    return () => {
      clearPolling()
    }
  }, [auditPhase, auditTaskId])

  useEffect(() => {
    return () => {
      clearPolling()
    }
  }, [])

  async function handleStartAudit(): Promise<void> {
    setAuditPhase('starting')
    setAuditError(null)
    setAuditReport(null)
    setAuditStatus(null)

    try {
      const response = await fetch(`${API_BASE}/api/v1/audits/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: SESSION_ID }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const json = (await response.json()) as ApiResponse<AuditStartResponse>

      if (!json.success || !json.data) {
        throw new Error(json.error?.message ?? 'Failed to start audit')
      }

      const taskId = json.data.audit_task_id
      setAuditTaskId(taskId)
      setAuditPhase('polling')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start audit'
      setAuditError(message)
      setAuditPhase('failed')
    }
  }

  function handleDocUploaded(slot: SlotKey, doc: DocumentUploadResponse): void {
    setUploadedDocs((prev) => ({ ...prev, [slot]: doc }))
  }

  const isAuditRunning = auditPhase === 'starting' || auditPhase === 'polling'

  return (
    <div className="min-h-screen bg-gray-50">
      <Header sessionId={SESSION_ID} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <UploadPanel
              sessionId={SESSION_ID}
              uploadedDocs={uploadedDocs}
              onUploaded={handleDocUploaded}
              onStartAudit={() => void handleStartAudit()}
              isDisabled={isAuditRunning}
            />
          </div>
          <div className="lg:col-span-2">
            <ResultsPanel
              phase={auditPhase}
              auditStatus={auditStatus}
              auditReport={auditReport}
              auditError={auditError}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
