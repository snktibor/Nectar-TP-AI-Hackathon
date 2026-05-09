import { useCallback, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import { phantomDesign } from '../design-system/phantomDesign'
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

interface DocumentIngestorProps {
  readonly sessionId: string
  readonly onIngestComplete?: (documents: IngestedDocument[]) => void
  readonly onResetWorkspace?: () => void
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

export default function DocumentIngestor({
  sessionId,
  onIngestComplete,
  onResetWorkspace,
}: DocumentIngestorProps): JSX.Element {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [phase, setPhase] = useState<IngestPhase>('empty')
  const [results, setResults] = useState<IngestedDocument[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [classificationIssues, setClassificationIssues] = useState<ClassificationIssue[]>([])
  const [replacementTargetFilename, setReplacementTargetFilename] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isSelectionLocked =
    (phase === 'ready' || phase === 'error') &&
    selectedFiles.length >= MAX_FILES &&
    replacementTargetFilename === null
  const lockedUploadMessage =
    'Már 5 fájl van kiválasztva. Törölj egyet, ha újat szeretnél feltölteni.'

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const validFiles = Array.from(incoming).filter(
      (file) => isSupportedDocument(file) && file.size <= MAX_FILE_SIZE,
    )

    if (validFiles.length === 0) {
      setErrorMessage('Csak PDF vagy DOCX fájl tölthető fel, maximum 50 MB méretben.')
      return
    }

    let exceededFileLimit = false

    setSelectedFiles((previousFiles) => {
      const filesByName = new Map(previousFiles.map((file) => [file.name, file]))
      for (const file of validFiles) {
        if (!filesByName.has(file.name)) {
          filesByName.set(file.name, file)
        }
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
    setErrorMessage(
      exceededFileLimit
        ? `Maximum ${MAX_FILES} dokumentum adható meg. A többit a rendszer kihagyta.`
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

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>): void {
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

      if (!isSupportedDocument(replacementFile) || replacementFile.size > MAX_FILE_SIZE) {
        setReplacementTargetFilename(null)
        setErrorMessage('Csak PDF vagy DOCX fájl tölthető fel, maximum 50 MB méretben.')
        return
      }

      const hasDuplicateConflict = selectedFiles.some(
        (file) => file.name === replacementFile.name && file.name !== replacementTargetFilename,
      )
      if (hasDuplicateConflict) {
        setReplacementTargetFilename(null)
        setErrorMessage('Már létezik ugyanezzel a fájlnévvel egy másik kiválasztott dokumentum.')
        return
      }

      const targetExists = selectedFiles.some((file) => file.name === replacementTargetFilename)
      if (!targetExists) {
        setReplacementTargetFilename(null)
        setErrorMessage('A cserélendő fájl már nem található. Kérlek próbáld újra.')
        return
      }

      const nextFiles = selectedFiles.map((file) =>
        file.name === replacementTargetFilename ? replacementFile : file,
      )

      setSelectedFiles(nextFiles)
      setResults([])
      setClassificationIssues([])
      setErrorMessage(null)
      setPhase('ready')
      setReplacementTargetFilename(null)
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
      onResetWorkspace?.()
    }
  }

  function replaceSingleFile(filename: string): void {
    if (phase === 'uploading') {
      return
    }

    setReplacementTargetFilename(filename)
    setErrorMessage(null)
    onResetWorkspace?.()
    fileInputRef.current?.click()
  }

  function handleUploadAreaClick(event: React.MouseEvent<HTMLLabelElement>): void {
    if (isSelectionLocked) {
      event.preventDefault()
    }
  }

  async function handleIngest(filesToIngest: File[] = selectedFiles): Promise<void> {
    if (filesToIngest.length !== MAX_FILES) {
      setPhase('error')
      setErrorMessage(`Pontosan ${MAX_FILES} dokumentum szükséges a beolvasáshoz.`)
      return
    }

    setPhase('uploading')
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

      setResults(json.data.documents)
      setPhase('done')
      setClassificationIssues(issues)
      setErrorMessage(null)
      onIngestComplete?.(json.data.documents)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'A dokumentumok beolvasása sikertelen volt.'
      setErrorMessage(message)
      setClassificationIssues([])
      setPhase('error')
    }
  }

  const successfulResults = results.filter((document) => document.status === 'success')

  return (
    <section className={[phantomDesign.components.panel, 'h-full'].join(' ')}>
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="tag-sticker bg-phantom-pink text-white">
            <Upload className="h-3 w-3" />
            FELTÖLTÉS
          </span>
          <StatusPill tone={phase === 'done' ? 'success' : 'neutral'}>PDF / DOCX</StatusPill>
        </div>
        <h2 className="headline headline-lg">
          Tölts fel{' '}
          <span className="scribble-underline">5 dokumentumot</span>.
        </h2>
        <p className="text-sm text-phantom-muted">
          Master File, Local File, szerződés, benchmark és egy számla — pontosan ennyi kell az auditfutáshoz.
        </p>
      </div>

      {phase !== 'done' && phase !== 'uploading' && (
        <>
          <label
            htmlFor={isSelectionLocked ? undefined : FILE_INPUT_ID}
            title={
              isSelectionLocked
                ? lockedUploadMessage
                : undefined
            }
            onClick={handleUploadAreaClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={[
              'group flex flex-col items-center justify-center gap-4 rounded-phantom-card border-2 border-dashed border-phantom-ink p-6 text-center transition-phantom duration-phantom-base sm:p-8',
              isSelectionLocked
                ? 'cursor-not-allowed bg-phantom-surface-muted opacity-70'
                : 'cursor-pointer',
              !isSelectionLocked && isDragOver
                ? 'bg-phantom-accent-soft shadow-phantom-soft'
                : !isSelectionLocked
                  ? 'bg-phantom-paper hover:bg-phantom-accent-soft hover:shadow-phantom-soft'
                  : '',
            ].join(' ')}
          >
            <div
              className={[
                'flex h-16 w-16 items-center justify-center rounded-phantom-card border-2 border-phantom-ink transition-phantom duration-phantom-base',
                isSelectionLocked
                  ? 'bg-phantom-surface-muted text-phantom-subtle'
                  : 'bg-phantom-paper text-phantom-ink shadow-phantom-sticker group-hover:-translate-y-0.5',
              ].join(' ')}
            >
              <Upload className="h-7 w-7" />
            </div>
            <div>
              <p className="font-display text-base font-extrabold text-phantom-ink">
                {isSelectionLocked
                  ? '5/5 fájl kiválasztva'
                  : isDragOver
                  ? 'Engedd el itt a dokumentumokat'
                  : 'Húzd ide a dokumentumokat, vagy kattints'}
              </p>
              <p className="mt-1 text-xs leading-5 text-phantom-muted">
                {isSelectionLocked
                  ? 'A feltöltés zárolva, amíg nem törölsz egy fájlt.'
                  : `PDF vagy DOCX, max 50 MB / fájl. Pontosan ${MAX_FILES} dokumentum szükséges.`}
              </p>
            </div>
          </label>
        </>
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

      {(phase === 'ready' || phase === 'error' || phase === 'uploading') && selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="mb-1 rounded-phantom-card border-2 border-phantom-ink bg-phantom-paper px-4 py-2.5 shadow-phantom-sticker">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-xs font-extrabold uppercase tracking-[0.18em] text-phantom-ink">
                Kiválasztva: {selectedFiles.length}/{MAX_FILES}
              </p>
              <StatusPill tone={selectedFiles.length === MAX_FILES ? 'success' : 'warning'}>
                {selectedFiles.length === MAX_FILES
                  ? 'Készen áll'
                  : `Még ${MAX_FILES - selectedFiles.length} hiányzik`}
              </StatusPill>
            </div>
          </div>

          {selectedFiles.map((file) => (
            <div
              key={file.name}
              className={[
                'flex items-center gap-3 rounded-phantom-card border-2 border-phantom-ink bg-phantom-surface p-3 shadow-phantom-sticker transition-transform duration-phantom-base',
              ].join(' ')}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-phantom-control border-2 border-phantom-ink bg-phantom-cyan text-phantom-ink">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-phantom-ink" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-phantom-muted">{formatBytes(file.size)}</p>
              </div>
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
          ))}
        </div>
      )}

      {phase === 'uploading' && (
        <div className="mt-4 rounded-phantom-card border-2 border-phantom-ink bg-phantom-paper p-4 shadow-phantom-sticker">
          <div className="flex items-center gap-3">
            <div className="force-spin h-5 w-5 animate-spin rounded-full border-2 border-phantom-ink border-t-transparent" />
            <p className="font-display text-sm font-extrabold text-phantom-ink">
              Beolvasás folyamatban...
            </p>
          </div>
        </div>
      )}

      {phase === 'done' && results.length > 0 && (
        <div className="space-y-4">
          <div className="rounded-phantom-card border-2 border-phantom-ink bg-phantom-surface px-4 py-2.5 shadow-phantom-sticker">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-display text-sm font-extrabold text-phantom-ink">
                Feldolgozva: {successfulResults.length}/{results.length}
              </p>
              <StatusPill tone={classificationIssues.length === 0 ? 'success' : 'danger'}>
                {classificationIssues.length === 0 ? 'Kategóriák rendben' : 'Kategória hiba'}
              </StatusPill>
            </div>
          </div>

          {classificationIssues.length > 0 && (
            <div className="rounded-phantom-card border-2 border-phantom-ink bg-phantom-ink p-4 text-white shadow-phantom-soft">
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-sm font-extrabold uppercase tracking-[0.12em]">
                  Osztályozási hibák
                </p>
                <span className="font-display text-3xl font-black leading-none text-phantom-accent">
                  {classificationIssues.length}
                </span>
              </div>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {classificationIssues.map((issue, index) => (
                  <li key={`${issue.kind}-${index}`} className="text-xs text-white/90">
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

          <div className="space-y-2">
            {results.map((document) => {
              const typeConfig = getDocumentTypeDisplay(document.detected_type)
              const isMisclassified =
                document.status === 'success' && !isRequiredDocumentType(document.detected_type)

              if (document.status === 'failed') {
                return (
                  <div
                    key={document.document_id}
                    className="rounded-phantom-card border-2 border-phantom-ink bg-phantom-pink p-3 text-white shadow-phantom-sticker"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-white" />
                      <div className="min-w-0 flex flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-display truncate text-sm font-extrabold text-white" title={document.filename}>
                            {document.filename}
                          </p>
                          <button
                            type="button"
                            onClick={() => replaceSingleFile(document.filename)}
                            className="inline-flex h-7 shrink-0 items-center justify-center rounded-phantom-control border-2 border-phantom-ink bg-phantom-surface px-3 font-display text-xs font-extrabold text-phantom-ink shadow-phantom-sticker transition-transform duration-phantom-base hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus"
                          >
                            Fájl csere
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-white/90">Feldolgozás meghiúsult.</p>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={document.document_id}
                  className={[
                    'rounded-phantom-card border-2 border-phantom-ink p-3 shadow-phantom-sticker',
                    isMisclassified
                      ? 'bg-phantom-amber'
                      : 'bg-phantom-surface',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-2">
                    {isMisclassified ? (
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-phantom-ink" />
                    ) : (
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-phantom-ink" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p
                            className="font-display truncate text-sm font-extrabold text-phantom-ink"
                            title={document.filename}
                          >
                            {document.filename}
                          </p>
                          <span
                            className={[
                              'inline-flex items-center rounded-full border-2 border-phantom-ink px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.1em] shadow-phantom-sticker',
                              typeConfig.badgeClassName,
                            ].join(' ')}
                          >
                            {typeConfig.label}
                          </span>
                        </div>

                        {isMisclassified && (
                          <button
                            type="button"
                            onClick={() => replaceSingleFile(document.filename)}
                            className="inline-flex h-7 shrink-0 items-center justify-center rounded-phantom-control border-2 border-phantom-ink bg-phantom-surface px-3 font-display text-xs font-extrabold text-phantom-ink shadow-phantom-sticker transition-transform duration-phantom-base hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus"
                          >
                            Fájl csere
                          </button>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-phantom-muted">
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
        <div className="mt-4 rounded-phantom-card border-2 border-phantom-ink bg-phantom-pink p-4 text-white shadow-phantom-sticker">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-white" />
            <div>
              <p className="font-display text-sm font-extrabold uppercase tracking-[0.12em]">
                Figyelmeztetés
              </p>
              <p className="mt-1 text-xs text-white/90">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {(phase === 'ready' || phase === 'error') && (
        <button
          type="button"
          onClick={() => void handleIngest()}
          disabled={selectedFiles.length !== MAX_FILES}
          className={[
            phantomDesign.components.buttonBase,
            phantomDesign.components.buttonPrimary,
            'mt-4 flex items-center justify-center gap-2',
          ].join(' ')}
        >
          <Wand2 className="h-4 w-4" />
          Beolvasás indítása ({selectedFiles.length}/{MAX_FILES})
        </button>
      )}
    </section>
  )
}
