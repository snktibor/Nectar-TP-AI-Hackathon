import { useEffect, useMemo, useRef, useState } from 'react'
import AnalysisReadyView from './components/AnalysisReadyView'
import AnalysisWorkspace from './components/AnalysisWorkspace'
import DashboardShell, { type DashboardTab } from './components/DashboardShell'
import DocumentIngestor from './components/DocumentIngestor'
import FilteredFindingsPanel from './components/FilteredFindingsPanel'
import ResultsPanel from './components/ResultsPanel'
import ReportsTab from './components/report/ReportsTab'
import { phantomDesign } from './design-system/phantomDesign'
import {
  isClassificationConfidenceAccepted,
  isGeneratedReportFilename,
} from './lib/documentDisplay'
import type {
  BackendAuditReport,
  BackendAuditStartResponse,
  BackendAuditStatusResponse,
  BackendDocTypeScope,
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
    if (isGeneratedReportFilename(document.filename)) {
      return false
    }

    if (!isRequiredAuditType(document.detected_type)) {
      return false
    }

    if (!isClassificationConfidenceAccepted(document.confidence)) {
      return false
    }

    coveredTypes.add(document.detected_type)
  }

  return coveredTypes.size === REQUIRED_AUDIT_TYPES.size
}

function buildFindingsByFilename(
  report: BackendAuditReport | null,
  documents: IngestedDocument[],
): Record<string, number> {
  const counts: Record<string, number> = {}
  if (!report) return counts

  const filenamesByScope = new Map<BackendDocTypeScope, string[]>()
  for (const doc of documents) {
    if (doc.status !== 'success') continue
    const scope = doc.detected_type as BackendDocTypeScope
    const arr = filenamesByScope.get(scope) ?? []
    arr.push(doc.filename)
    filenamesByScope.set(scope, arr)
  }

  const bumpScope = (scope: BackendDocTypeScope | undefined): void => {
    if (!scope) return
    const filenames = filenamesByScope.get(scope)
    if (!filenames) return
    for (const filename of filenames) {
      counts[filename] = (counts[filename] ?? 0) + 1
    }
  }

  for (const err of report.consistency_errors) {
    bumpScope(err.attribution?.doc_type_scope)
  }
  for (const risk of report.benchmark_risks) {
    bumpScope(risk.attribution?.doc_type_scope)
  }
  for (const missing of report.missing_elements) {
    counts[missing.expected_in] = (counts[missing.expected_in] ?? 0) + 1
  }

  return counts
}

export default function App(): JSX.Element {
  const [ingestedDocuments, setIngestedDocuments] = useState<IngestedDocument[]>([])
  const [workspacePhase, setWorkspacePhase] = useState<WorkspacePhase>('empty')
  const [auditTaskId, setAuditTaskId] = useState<string | null>(null)
  const [auditStatus, setAuditStatus] = useState<BackendAuditStatusResponse | null>(null)
  const [auditReport, setAuditReport] = useState<BackendAuditReport | null>(null)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [activeCitation, setActiveCitation] = useState<CitationTarget | null>(null)
  const [ingestorRenderKey, setIngestorRenderKey] = useState(0)
  const [activeTab, setActiveTab] = useState<DashboardTab>('documents')
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const hasReadyAuditCoverage = hasCompleteRequiredCoverage(ingestedDocuments)
  const findingsByFilename = useMemo(
    () => buildFindingsByFilename(auditReport, ingestedDocuments),
    [auditReport, ingestedDocuments],
  )
  const selectedDocType = useMemo<BackendDocTypeScope | null>(() => {
    if (selectedDocId === null) return null
    const doc = ingestedDocuments.find((d) => d.filename === selectedDocId)
    if (doc?.status !== 'success') return null
    return doc.detected_type as BackendDocTypeScope
  }, [selectedDocId, ingestedDocuments])

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

  async function startAudit(): Promise<void> {
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
    setSelectedDocId(null)

    if (hasCompleteRequiredCoverage(documents)) {
      void startAudit()
      return
    }

    setWorkspacePhase(documents.length > 0 ? 'blocked' : 'empty')
  }

  function handleResetWorkspaceFromLeft(): void {
    clearPolling()
    clearAuditState()
    setActiveCitation(null)
    setIngestedDocuments([])
    setSelectedDocId(null)
    setWorkspacePhase('empty')
    setIngestorRenderKey((previousKey) => previousKey + 1)
  }

  function handleSelectDocument(filename: string): void {
    setSelectedDocId(filename)
    setActiveCitation(null)
  }

  function handleClearSelection(): void {
    setSelectedDocId(null)
    setActiveCitation(null)
  }

  function handleCloseGlobalReport(): void {
    if (workspacePhase === 'failed') {
      clearAuditState()
      let nextPhase: WorkspacePhase = 'empty'
      if (hasReadyAuditCoverage) {
        nextPhase = 'ready'
      } else if (ingestedDocuments.length > 0) {
        nextPhase = 'blocked'
      }
      setWorkspacePhase(nextPhase)
    }
  }

  function handleCitationClick(target: CitationTarget): void {
    setActiveCitation(target)
    if (target.sourceKind === 'document') {
      setSelectedDocId(target.filename)
      setActiveTab('documents')
    }
  }

  function handleTabChange(nextTab: DashboardTab): void {
    setActiveTab(nextTab)
  }

  const leftPanelContent = (() => {
    if (activeTab === 'analysis') {
      return (
        <AnalysisReadyView
          phase={workspacePhase}
          report={auditReport}
          successfulDocumentCount={ingestedDocuments.filter((document) => document.status === 'success').length}
        />
      )
    }

    if (activeTab === 'reports') {
      return <ReportsTab auditReport={auditReport} />
    }

    if (selectedDocId !== null) {
      return (
        <ResultsPanel
          selectedDocId={selectedDocId}
          sessionId={SESSION_ID}
          activeCitation={activeCitation}
          onClose={handleClearSelection}
        />
      )
    }

    return (
      <DocumentIngestor
        key={`ingestor-${ingestorRenderKey}`}
        sessionId={SESSION_ID}
        onIngestComplete={handleIngestComplete}
        onResetWorkspace={handleResetWorkspaceFromLeft}
        showRestartAction={workspacePhase === 'completed'}
        selectedDocId={selectedDocId}
        onSelectDocument={handleSelectDocument}
        findingsByFilename={findingsByFilename}
        initialResults={ingestedDocuments}
      />
    )
  })()

  const leftPanelKey = `${activeTab}:${selectedDocId ?? 'none'}`
  const leftPanel = (
    <div key={leftPanelKey} className="h-full animate-phantom-fade-in-up">
      {leftPanelContent}
    </div>
  )

  const showDocumentScopedFindings = activeTab === 'documents' && selectedDocId !== null

  const rightPanelContent =
    showDocumentScopedFindings ? (
      <FilteredFindingsPanel
        selectedDocId={selectedDocId}
        selectedDocType={selectedDocType}
        sessionId={SESSION_ID}
        auditReport={auditReport}
        onCitationClick={handleCitationClick}
      />
    ) : (
      <AnalysisWorkspace
        phase={workspacePhase}
        auditStatus={auditStatus}
        auditReport={auditReport}
        auditError={auditError}
        sessionId={SESSION_ID}
        onCitationClick={handleCitationClick}
        onCloseReport={handleCloseGlobalReport}
      />
    )

  const rightPanelKey = showDocumentScopedFindings
    ? `filtered:${selectedDocId}`
    : `workspace:${activeTab}`
  const rightPanel = (
    <div key={rightPanelKey} className="h-full animate-phantom-fade-in-up">
      {rightPanelContent}
    </div>
  )

  return (
    <div className={[phantomDesign.layout.page, 'h-screen'].join(' ')}>
      <main className="h-full w-full">
        <DashboardShell
          activeTab={activeTab}
          onTabChange={handleTabChange}
          leftPanel={leftPanel}
          rightPanel={rightPanel}
        />
      </main>
    </div>
  )
}
