import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  FileText,
  FileType2,
  FileUp,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react'
import {
  formatBytes,
  getDocumentTypeDisplay,
  isSupportedDocument,
} from '../lib/documentDisplay'
import type { ApiResponse, IngestedDocument, IngestResponse } from '../types/api'
import { StatusPill } from './ui/DashboardPrimitives'

const API_BASE = import.meta.env.VITE_API_BASE_URL
const ACCEPTED_TYPES = '.pdf,.docx'
const MAX_FILE_SIZE = 50 * 1024 * 1024
const MAX_FILES = 5
const FILE_INPUT_ID = 'document-ingest-files'
const DUPLICATE_FILE_MESSAGE = 'Ez a fájl már ki van választva, nem töltöttük fel újra.'
const DUPLICATE_MESSAGE_DISMISS_MS = 3000

interface DocumentIngestorProps {
  readonly sessionId: string
  readonly onIngestComplete?: (documents: IngestedDocument[]) => void
  readonly onResetWorkspace?: () => void
  readonly showRestartAction?: boolean
  readonly selectedDocId?: string | null
  readonly onSelectDocument?: (filename: string) => void
  readonly findingsByFilename?: Readonly<Record<string, number>>
  readonly initialResults?: IngestedDocument[]
}

type IngestPhase = 'empty' | 'ready' | 'uploading' | 'done' | 'error'

type RequiredDocumentType =
  | 'master_file'
  | 'local_file'
  | 'contract'
  | 'benchmark_study'
  | 'invoice'

type ClassificationIssue =
  | {
      kind: 'file_failed'
      filename: string
      reason: string
    }
  | {
      kind: 'file_misclassified'
      filename: string
      detectedType: string
    }
  | {
      kind: 'missing_required'
      requiredType: RequiredDocumentType
    }

const REQUIRED_DOCUMENT_TYPES: RequiredDocumentType[] = [
  'master_file',
  'local_file',
  'contract',
  'benchmark_study',
  'invoice',
]

const REQUIRED_DOCUMENT_TYPE_LABELS_EN: Record<RequiredDocumentType, string> = {
  master_file: 'Master File',
  local_file: 'Local File',
  contract: 'Contract',
  benchmark_study: 'Benchmark Study',
  invoice: 'Invoice',
}

function isRequiredDocumentType(value: string): value is RequiredDocumentType {
  return REQUIRED_DOCUMENT_TYPES.includes(value as RequiredDocumentType)
}

function buildClassificationIssues(documents: IngestedDocument[]): ClassificationIssue[] {
  const issues: ClassificationIssue[] = []
  const matchedTypes = new Set<RequiredDocumentType>()

  for (const document of documents) {
    if (document.status === 'failed') {
      issues.push({
        kind: 'file_failed',
        filename: document.filename,
        reason: document.error ?? 'Ismeretlen osztályozási hiba.',
      })
      continue
    }

    if (isRequiredDocumentType(document.detected_type)) {
      matchedTypes.add(document.detected_type)
      continue
    }

    issues.push({
      kind: 'file_misclassified',
      filename: document.filename,
      detectedType: document.detected_type,
    })
  }

  for (const requiredType of REQUIRED_DOCUMENT_TYPES) {
    if (!matchedTypes.has(requiredType)) {
      issues.push({
        kind: 'missing_required',
        requiredType,
      })
    }
  }

  return issues
}

function collectReplaceableFilenames(documents: IngestedDocument[]): string[] {
  const replaceable = new Set<string>()

  for (const document of documents) {
    if (document.status === 'failed') {
      replaceable.add(document.filename)
      continue
    }

    if (!isRequiredDocumentType(document.detected_type)) {
      replaceable.add(document.filename)
    }
  }

  return Array.from(replaceable)
}

export default function DocumentIngestor({
  sessionId,
  onIngestComplete,
  onResetWorkspace,
  showRestartAction = false,
  selectedDocId = null,
  onSelectDocument,
  findingsByFilename,
  initialResults,
}: DocumentIngestorProps): JSX.Element {
  const hasHydratedResults = (initialResults?.length ?? 0) > 0
  const initialReplaceableFilenames = hasHydratedResults
    ? collectReplaceableFilenames(initialResults ?? [])
    : []
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [phase, setPhase] = useState<IngestPhase>(hasHydratedResults ? 'done' : 'empty')
  const [results, setResults] = useState<IngestedDocument[]>(initialResults ?? [])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [classificationIssues, setClassificationIssues] = useState<ClassificationIssue[]>(
    hasHydratedResults ? buildClassificationIssues(initialResults ?? []) : [],
  )
  const [hasPendingReclassification, setHasPendingReclassification] = useState(false)
  const [pendingReplacementFilenames, setPendingReplacementFilenames] = useState<string[]>(
    initialReplaceableFilenames,
  )
  const [replacementTargetFilename, setReplacementTargetFilename] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isSelectionLocked =
    phase !== 'uploading' &&
    selectedFiles.length >= MAX_FILES &&
    replacementTargetFilename === null
  const lockedUploadMessage =
    'Maximum 5 fájl tölthető fel. Törölj egyet, ha újat szeretnél kiválasztani.'

  useEffect(() => {
    if (errorMessage !== DUPLICATE_FILE_MESSAGE) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setErrorMessage((current) =>
        current === DUPLICATE_FILE_MESSAGE ? null : current,
      )
    }, DUPLICATE_MESSAGE_DISMISS_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [errorMessage])

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const validFiles = Array.from(incoming).filter(
      (file) => isSupportedDocument(file) && file.size <= MAX_FILE_SIZE,
    )

    if (validFiles.length === 0) {
      setErrorMessage('Csak PDF vagy DOCX fájl tölthető fel, maximum 50 MB méretben.')
      return
    }

    let exceededFileLimit = false
    let duplicateFileDetected = false

    setSelectedFiles((previousFiles) => {
      const filesByName = new Map(previousFiles.map((file) => [file.name, file]))
      for (const file of validFiles) {
        if (filesByName.has(file.name)) {
          duplicateFileDetected = true
          continue
        }

        filesByName.set(file.name, file)
      }

      const nextFiles = Array.from(filesByName.values())
      if (nextFiles.length > MAX_FILES) {
        exceededFileLimit = true
        return nextFiles.slice(0, MAX_FILES)
      }

      return nextFiles
    })

    setPhase('ready')
    setClassificationIssues([])
    setHasPendingReclassification(false)
    setPendingReplacementFilenames([])
    setErrorMessage(
      exceededFileLimit
        ? `Maximum ${MAX_FILES} dokumentum adható meg. A többit a rendszer kihagyta.`
        : duplicateFileDetected
          ? DUPLICATE_FILE_MESSAGE
        : null,
    )
  }, [])

  function handleDragOver(event: React.DragEvent): void {
    event.preventDefault()
    event.stopPropagation()

    if (phase === 'uploading' || isSelectionLocked) {
      return
    }

    setIsDragOver(true)
  }

  function handleDragLeave(event: React.DragEvent): void {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
  }

  function handleDrop(event: React.DragEvent): void {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)

    if (phase === 'uploading' || isSelectionLocked) {
      return
    }

    if (event.dataTransfer.files.length > 0) {
      addFiles(event.dataTransfer.files)
    }
  }

  async function hydrateSelectedFilesFromResults(): Promise<File[] | null> {
    if (results.length !== MAX_FILES) {
      return null
    }

    try {
      const hydrated = await Promise.all(
        results.map(async (document) => {
          const response = await fetch(
            `${API_BASE}/api/v1/documents/${encodeURIComponent(sessionId)}/file/${encodeURIComponent(document.filename)}`,
          )
          if (!response.ok) {
            throw new Error(`A fájl nem tölthető vissza: ${document.filename}`)
          }

          const blob = await response.blob()
          return new File([blob], document.filename, {
            type: blob.type,
            lastModified: Date.now(),
          })
        }),
      )

      return hydrated
    } catch {
      return null
    }
  }

  async function handleFileInput(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const incomingFiles = event.target.files

    if (!incomingFiles || incomingFiles.length === 0) {
      if (replacementTargetFilename !== null) {
        setReplacementTargetFilename(null)
      }
      return
    }

    if (replacementTargetFilename !== null) {
      const replacementFile = incomingFiles[0]
      event.currentTarget.value = ''

      let workingFiles = selectedFiles
      if (!workingFiles.some((file) => file.name === replacementTargetFilename)) {
        const hydratedFiles = await hydrateSelectedFilesFromResults()
        if (!hydratedFiles) {
          setReplacementTargetFilename(null)
          setErrorMessage(
            'A korábban feltöltött fájlok nem érhetők el cseréhez. Töltsd fel újra az 5 dokumentumot.',
          )
          return
        }

        workingFiles = hydratedFiles
        setSelectedFiles(hydratedFiles)
      }

      if (!isSupportedDocument(replacementFile) || replacementFile.size > MAX_FILE_SIZE) {
        setReplacementTargetFilename(null)
        setErrorMessage('Csak PDF vagy DOCX fájl tölthető fel, maximum 50 MB méretben.')
        return
      }

      const hasDuplicateConflict = workingFiles.some(
        (file) => file.name === replacementFile.name && file.name !== replacementTargetFilename,
      )
      if (hasDuplicateConflict) {
        setReplacementTargetFilename(null)
        setErrorMessage(null)
        return
      }

      const targetFile = workingFiles.find((file) => file.name === replacementTargetFilename)
      if (!targetFile) {
        setReplacementTargetFilename(null)
        setErrorMessage('A cserélendő fájl már nem található. Kérlek próbáld újra.')
        return
      }

      const isSameFileAsTarget =
        replacementFile.name === targetFile.name &&
        replacementFile.size === targetFile.size &&
        replacementFile.lastModified === targetFile.lastModified
      if (isSameFileAsTarget) {
        setReplacementTargetFilename(null)
        setErrorMessage('Ugyanazt a fájlt nem lehet visszacserélni. Válassz másik fájlt.')
        return
      }

      const nextFiles = workingFiles.map((file) =>
        file.name === replacementTargetFilename ? replacementFile : file,
      )

      const nextResults = results.map((document) =>
        document.filename === replacementTargetFilename
          ? {
              ...document,
              filename: replacementFile.name,
              size_bytes: replacementFile.size,
              page_count: 0,
              chunk_count: 0,
              confidence: 0,
              detected_type: 'other',
              status: 'success' as const,
              error: null,
            }
          : document,
      )

      setSelectedFiles(nextFiles)
      setResults(nextResults)
      setClassificationIssues(buildClassificationIssues(nextResults))
      const nextPendingReplacementFilenames = pendingReplacementFilenames.filter(
        (filename) => filename !== replacementTargetFilename,
      )
      setPendingReplacementFilenames(nextPendingReplacementFilenames)
      setErrorMessage(null)
      setReplacementTargetFilename(null)

      if (nextPendingReplacementFilenames.length > 0) {
        setHasPendingReclassification(true)
        setPhase('done')
        return
      }

      setHasPendingReclassification(false)
      void handleIngest(nextFiles)
      return
    }

    if (isSelectionLocked) {
      event.currentTarget.value = ''
      return
    }

    addFiles(incomingFiles)
    event.currentTarget.value = ''
  }

  function removeFile(name: string): void {
    let shouldResetWorkspace = false

    setSelectedFiles((previousFiles) => {
      const nextFiles = previousFiles.filter((file) => file.name !== name)
      if (nextFiles.length === 0) {
        shouldResetWorkspace = true
        setPhase('empty')
      }
      return nextFiles
    })

    if (shouldResetWorkspace) {
      setHasPendingReclassification(false)
      setPendingReplacementFilenames([])
      onResetWorkspace?.()
    }
  }

  function replaceSingleFile(filename: string): void {
    if (phase === 'uploading') {
      return
    }

    setReplacementTargetFilename(filename)
    setErrorMessage(null)
    fileInputRef.current?.click()
  }

  function handleUploadAreaClick(event: React.MouseEvent<HTMLLabelElement>): void {
    if (isSelectionLocked) {
      event.preventDefault()
    }
  }

  function handleRestartFromIngestor(): void {
    if (phase === 'uploading') {
      return
    }

    setSelectedFiles([])
    setResults([])
    setClassificationIssues([])
    setHasPendingReclassification(false)
    setPendingReplacementFilenames([])
    setErrorMessage(null)
    setReplacementTargetFilename(null)
    setIsDragOver(false)
    setPhase('empty')
    onResetWorkspace?.()
  }

  async function handleIngest(filesToIngest: File[] = selectedFiles): Promise<void> {
    if (filesToIngest.length !== MAX_FILES) {
      setPhase('error')
      setErrorMessage(`Pontosan ${MAX_FILES} dokumentum szükséges a beolvasáshoz.`)
      return
    }

    setPhase('uploading')
    setHasPendingReclassification(false)
    setErrorMessage(null)
    setClassificationIssues([])
    setResults([])

    try {
      const formData = new FormData()
      formData.append('session_id', sessionId)
      for (const file of filesToIngest) {
        formData.append('files', file)
      }

      const response = await fetch(`${API_BASE}/api/v1/documents/ingest`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`A feltöltés sikertelen volt (HTTP ${response.status}).`)
      }

      const json = (await response.json()) as ApiResponse<IngestResponse>
      if (!json.success || !json.data) {
        throw new Error('A dokumentumok beolvasása sikertelen volt.')
      }

      const issues = buildClassificationIssues(json.data.documents)
      const replaceableFilenames = collectReplaceableFilenames(json.data.documents)

      setResults(json.data.documents)
      setPhase('done')
      setClassificationIssues(issues)
      setHasPendingReclassification(false)
      setPendingReplacementFilenames(replaceableFilenames)
      setErrorMessage(null)
      onIngestComplete?.(json.data.documents)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'A dokumentumok beolvasása sikertelen volt.'
      setErrorMessage(message)
      setClassificationIssues([])
      setPendingReplacementFilenames([])
      setPhase('error')
    }
  }

  const successfulResults = results.filter((document) => document.status === 'success')
  const canRestartWorkflow = showRestartAction && (selectedFiles.length > 0 || results.length > 0)

  return (
    <section className="h-full rounded-2xl border border-gray-100 bg-white p-4 shadow-md sm:p-5 lg:p-6">
      <div className="mb-4 flex min-h-14 flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-slate-50 px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">Dokumentum feltöltés</p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {canRestartWorkflow && (
            <button
              type="button"
              onClick={handleRestartFromIngestor}
              disabled={phase === 'uploading'}
              className={[
                'inline-flex h-7 items-center justify-center gap-1 rounded-phantom-control border border-phantom-line bg-phantom-surface-muted px-2.5 text-xs font-semibold text-phantom-muted transition-phantom duration-phantom-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus',
                phase === 'uploading'
                  ? 'cursor-not-allowed opacity-50'
                  : 'hover:border-phantom-accent hover:text-phantom-ink',
              ].join(' ')}
              aria-label="Feltöltési folyamat újrakezdése"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Újrakezdés</span>
            </button>
          )}
          <StatusPill tone={phase === 'done' ? 'success' : 'neutral'}>PDF / DOCX</StatusPill>
        </div>
      </div>

      {phase !== 'uploading' && phase !== 'done' && (
        <label
          htmlFor={FILE_INPUT_ID}
          title={isSelectionLocked ? lockedUploadMessage : undefined}
          aria-disabled={isSelectionLocked}
          onClick={handleUploadAreaClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={[
            'group flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-6 text-center transition-phantom duration-phantom-base sm:p-8',
            isSelectionLocked
              ? 'cursor-not-allowed border-gray-200 bg-slate-50/70'
              : 'cursor-pointer',
            !isSelectionLocked && isDragOver
              ? 'border-phantom-accent bg-phantom-accent-soft shadow-phantom-soft'
              : '',
            !isSelectionLocked && !isDragOver
              ? 'border-gray-200 bg-slate-50 hover:border-phantom-accent hover:bg-phantom-accent-soft hover:shadow-phantom-soft'
              : '',
          ].join(' ')}
        >
          <div
            className={[
              'flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-phantom-soft ring-1 ring-gray-100 transition-phantom duration-phantom-base',
              isSelectionLocked
                ? 'text-gray-400'
                : 'text-phantom-accent group-hover:-translate-y-0.5',
            ].join(' ')}
          >
            <Upload className="h-7 w-7" />
          </div>
          <div>
            <p className={['text-sm font-semibold', isSelectionLocked ? 'text-gray-500' : 'text-gray-900'].join(' ')}>
              {isDragOver
                ? 'Engedd el itt a dokumentumokat'
                : 'Húzd ide a dokumentumokat, vagy kattints'}
            </p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              {`PDF vagy DOCX, max 50 MB / fájl. Pontosan ${MAX_FILES} dokumentum szükséges.`}
            </p>
          </div>
        </label>
      )}

      <input
        id={FILE_INPUT_ID}
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple={replacementTargetFilename === null}
        className="hidden"
        onChange={handleFileInput}
      />

      {(phase === 'ready' || phase === 'error' || phase === 'uploading' || (phase === 'done' && hasPendingReclassification)) && selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="mb-1 rounded-xl border border-gray-100 bg-white px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-500">
                Kiválasztva: {selectedFiles.length}/{MAX_FILES}
              </p>
              {selectedFiles.length === MAX_FILES ? (
                <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Készen áll
                </span>
              ) : (
                <StatusPill tone="warning">
                  {`Még ${MAX_FILES - selectedFiles.length} hiányzik`}
                </StatusPill>
              )}
            </div>
          </div>

          {selectedFiles.map((file) => {
            const isPdf = file.name.toLowerCase().endsWith('.pdf')
            const FileIcon = isPdf ? FileText : FileType2
            const iconWrapClass = isPdf
              ? 'bg-red-50 text-red-600 ring-red-100'
              : 'bg-blue-50 text-blue-600 ring-blue-100'
            return (
            <div
              key={file.name}
              className={[
                'flex items-center gap-3 rounded-xl border p-3 shadow-sm',
                phase === 'error'
                  ? 'border-phantom-danger-border bg-phantom-danger-soft'
                  : 'border-gray-100 bg-white',
              ].join(' ')}
            >
              <div className={['flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1', iconWrapClass].join(' ')}>
                <FileIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={[
                    'truncate text-sm font-medium',
                    phase === 'error' ? 'text-phantom-danger-text' : 'text-phantom-ink',
                  ].join(' ')}
                  title={file.name}
                >
                  {file.name}
                </p>
                <p className="text-xs text-phantom-muted">{formatBytes(file.size)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => removeFile(file.name)}
                  disabled={phase === 'uploading'}
                  className={[
                    'shrink-0 rounded-phantom-control p-2 text-phantom-subtle transition-phantom duration-phantom-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus',
                    phase === 'uploading'
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:bg-phantom-surface-muted hover:text-phantom-ink',
                  ].join(' ')}
                  aria-label={`Eltávolítás: ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            )
          })}
        </div>
      )}

      {phase === 'done' && results.length > 0 && (
        <div className="space-y-4">
          <div className="rounded-phantom-card border border-phantom-line bg-phantom-surface px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-phantom-success-text">
                Feldolgozva: {successfulResults.length}/{results.length}
              </p>
              <StatusPill tone={classificationIssues.length === 0 ? 'success' : 'danger'}>
                {classificationIssues.length === 0 ? 'Kategóriák rendben' : 'Kategória hiba'}
              </StatusPill>
            </div>
          </div>

          {classificationIssues.length > 0 && (
            <div className="rounded-phantom-card border border-phantom-danger-border bg-phantom-danger-soft p-4">
              <p className="text-sm font-semibold text-phantom-danger-text">
                A kötelező 5 kategória osztályozása nem sikerült teljesen.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {classificationIssues.map((issue, index) => (
                  <li key={`${issue.kind}-${index}`} className="text-xs text-phantom-danger-text">
                    {issue.kind === 'missing_required' && (
                      <>
                        Hiányzó kötelező kategória:{' '}
                        <span className="font-bold">
                          {REQUIRED_DOCUMENT_TYPE_LABELS_EN[issue.requiredType]}
                        </span>
                        .
                      </>
                    )}

                    {issue.kind === 'file_misclassified' && (
                      <>
                        <span className="font-bold">{issue.filename}</span>: Detektált kategória{' '}
                        <span className="font-bold">{issue.detectedType}</span>.
                      </>
                    )}

                    {issue.kind === 'file_failed' && (
                      <>
                        <span className="font-bold">{issue.filename}</span>: {issue.reason}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasPendingReclassification && (
            <div className="rounded-phantom-card border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">
                Fájlcsere megtörtént
              </p>
              <p className="mt-1 text-xs text-amber-700">
                {pendingReplacementFilenames.length > 0
                  ? `Még ${pendingReplacementFilenames.length} hibás fájl cseréje szükséges. Az utolsó csere után automatikusan újraindul az osztályozás.`
                  : 'Folyamatban: automatikus újraosztályozás indul.'}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {results.map((document) => {
              const typeConfig = getDocumentTypeDisplay(document.detected_type)
              const isMisclassified =
                document.status === 'success' && !isRequiredDocumentType(document.detected_type)

              if (document.status === 'failed') {
                return (
                  <div
                    key={document.document_id}
                    className="rounded-phantom-card border border-phantom-danger-border bg-phantom-danger-soft p-3"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-phantom-danger-text" />
                      <div className="min-w-0 flex flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-phantom-danger-text" title={document.filename}>
                            {document.filename}
                          </p>
                          <button
                            type="button"
                            onClick={() => replaceSingleFile(document.filename)}
                            className="inline-flex h-7 shrink-0 items-center justify-center rounded-phantom-control border border-phantom-danger-border bg-phantom-surface px-3 text-xs font-semibold text-phantom-danger-text transition-phantom duration-phantom-base hover:bg-phantom-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus"
                          >
                            Fájl csere
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-phantom-danger-text">Feldolgozás meghiúsult.</p>
                      </div>
                    </div>
                  </div>
                )
              }

              const findingCount = findingsByFilename?.[document.filename] ?? 0
              const isSelected = selectedDocId === document.filename
              const isSelectable = !isMisclassified && Boolean(onSelectDocument)

              return (
                <div
                  key={document.document_id}
                  role={isSelectable ? 'button' : undefined}
                  tabIndex={isSelectable ? 0 : undefined}
                  onClick={
                    isSelectable
                      ? () => onSelectDocument?.(document.filename)
                      : undefined
                  }
                  onKeyDown={
                    isSelectable
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onSelectDocument?.(document.filename)
                          }
                        }
                      : undefined
                  }
                  className={[
                    'rounded-xl border p-3 transition-all duration-150 shadow-sm',
                    isMisclassified
                      ? 'border-phantom-danger-border bg-phantom-danger-soft'
                      : isSelected
                        ? 'border-orange-300 bg-orange-50 shadow-md ring-1 ring-orange-200'
                        : 'border-gray-100 bg-white hover:border-orange-200 hover:bg-orange-50/40',
                    isSelectable
                      ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400'
                      : '',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-2">
                    {isMisclassified ? (
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-phantom-danger-text" />
                    ) : (
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-phantom-success-text" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p
                            className={[
                              'truncate text-sm font-semibold',
                              isMisclassified ? 'text-phantom-danger-text' : 'text-gray-900',
                            ].join(' ')}
                            title={document.filename}
                          >
                            {document.filename}
                          </p>
                          <span
                            className={[
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
                              typeConfig.badgeClassName,
                            ].join(' ')}
                          >
                            {typeConfig.label}
                          </span>
                          {!isMisclassified && findingCount > 0 && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200"
                              title={`${findingCount} megállapítás ehhez a dokumentumhoz`}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {findingCount}
                            </span>
                          )}
                          {!isMisclassified && findingCount === 0 && findingsByFilename && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200"
                              title="Nincs megállapítás"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              0
                            </span>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {isMisclassified && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                replaceSingleFile(document.filename)
                              }}
                              className="inline-flex h-7 shrink-0 items-center justify-center rounded-phantom-control border border-phantom-danger-border bg-phantom-surface px-3 text-xs font-semibold text-phantom-danger-text transition-phantom duration-phantom-base hover:bg-phantom-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus"
                            >
                              Fájl csere
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>{document.page_count} oldal</span>
                        <span>{document.chunk_count} részlet</span>
                        <span>{formatBytes(document.size_bytes)}</span>
                        <span>{Math.round(document.confidence * 100)}% bizalom</span>
                      </div>

                    </div>
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      )}

      {errorMessage && errorMessage !== lockedUploadMessage && phase !== 'uploading' && (
        <div className="mt-4 rounded-phantom-card border border-phantom-danger-border bg-phantom-danger-soft p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-phantom-danger-text" />
            <div>
              <p className="text-sm font-semibold text-phantom-danger-text">Figyelmeztetés</p>
              <p className="mt-1 text-xs text-phantom-danger-text">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {(phase === 'ready' || phase === 'error' || phase === 'uploading') && (
        <button
          type="button"
          onClick={() => void handleIngest()}
          disabled={selectedFiles.length !== MAX_FILES || phase === 'uploading'}
          className={[
            'mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white',
            'bg-gradient-to-r from-orange-500 to-orange-400 shadow-lg shadow-orange-500/30',
            'transition-all duration-200 ease-out',
            'hover:from-orange-600 hover:to-orange-500 hover:shadow-orange-500/40 hover:-translate-y-0.5',
            'active:translate-y-0 active:shadow-orange-500/20',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0',
          ].join(' ')}
        >
          {phase === 'uploading' ? (
            <>
              <Loader2 className="force-spin h-4 w-4 animate-spin" />
              AI Elemzés folyamatban...
            </>
          ) : (
            <>
              <FileUp className="h-4 w-4" />
              {`Beolvasás indítása (${selectedFiles.length}/${MAX_FILES})`}
            </>
          )}
        </button>
      )}
    </section>
  )
}
