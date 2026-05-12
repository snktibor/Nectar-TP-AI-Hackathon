import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AnalysisReadyView from './components/AnalysisReadyView'
import AnalysisWorkspace from './components/AnalysisWorkspace'
import DashboardShell, { type DashboardTab } from './components/DashboardShell'
import DocumentIngestor from './components/DocumentIngestor'
import FilteredFindingsPanel from './components/FilteredFindingsPanel'
import ResultsPanel from './components/ResultsPanel'
import SplashScreen from './components/SplashScreen'
import ReportsTab from './components/report/ReportsTab'
import { phantomDesign } from './design-system/phantomDesign'
import {
  isClassificationConfidenceAccepted,
  isGeneratedReportFilename,
} from './lib/documentDisplay'
import { buildFindingsByFilename } from './lib/findingFilters'
import { toApiUrl, toUserFacingApiError } from './lib/api'
import type {
  BackendAuditReport,
  BackendAuditStartResponse,
  BackendAuditStatusResponse,
  BackendDocTypeScope,
  WorkspacePhase,
} from './lib/backendAudit'
import type { CitationTarget } from './types/viewer'
import type { ApiResponse, IngestedDocument } from './types/api'

const INTRO_DURATION_MS = 2000
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

function normalizeFilename(filename: string): string {
  const normalizedPath = filename.trim().replace(/\\/g, '/')
  return (normalizedPath.split('/').pop() ?? normalizedPath).toLowerCase()
}

function canonicalDocumentFilename(
  documents: readonly IngestedDocument[],
  filename: string,
): string {
  const normalizedFilename = normalizeFilename(filename)
  return documents.find((document) => normalizeFilename(document.filename) === normalizedFilename)?.filename ?? filename
}

function shouldRunBootIntro(): boolean {
  const runtimeWindow = globalThis.window
  if (!runtimeWindow) {
    return true
  }

  const pathname = runtimeWindow.location.pathname.toLowerCase()
  const isEntryPath = pathname === '/' || pathname === '/index.html'
  if (!isEntryPath) {
    return false
  }

  const navEntries = globalThis.performance.getEntriesByType('navigation')
  const firstNavigationEntry = navEntries[0]
  const navEntryType = (firstNavigationEntry as unknown as { type?: unknown } | undefined)?.type
  if (typeof navEntryType !== 'string') {
    return true
  }

  return navEntryType === 'navigate' || navEntryType === 'reload'
}

export default function App(): JSX.Element {
  const [showBootIntro, setShowBootIntro] = useState<boolean>(() => shouldRunBootIntro())
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
  const handleBootIntroComplete = useCallback(() => {
    setShowBootIntro(false)
  }, [])

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
      const response = await fetch(toApiUrl(`/api/v1/audits/results/${taskId}`))
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
      const message = toUserFacingApiError(error, 'Az audit riport lekérése sikertelen.')
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
        const response = await fetch(toApiUrl(`/api/v1/audits/status/${auditTaskId}`))
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
        const message = toUserFacingApiError(error, 'Az audit státusz lekérése sikertelen.')
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
      const response = await fetch(toApiUrl('/api/v1/audits/start'), {
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
      const message = toUserFacingApiError(error, 'Az audit indítása sikertelen.')
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
    if (target.sourceKind === 'document') {
      const filename = canonicalDocumentFilename(ingestedDocuments, target.filename)
      setActiveCitation({ ...target, filename })
      setSelectedDocId(filename)
      setActiveTab('documents')
      return
    }

    setActiveCitation(target)
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

  const leftPanel = (
    <div className="h-full">
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

  const rightPanel = (
    <div className="h-full">
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
      {showBootIntro ? (
        <SplashScreen durationMs={INTRO_DURATION_MS} onComplete={handleBootIntroComplete} />
      ) : null}
    </div>
  )
}
