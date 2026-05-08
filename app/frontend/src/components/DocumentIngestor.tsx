import { useCallback, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle,
  FileText,
  FileUp,
  RotateCcw,
  Upload,
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
}

type IngestPhase = 'empty' | 'ready' | 'uploading' | 'done' | 'error'

type RequiredDocumentType =
  | 'master_file'
  | 'local_file'
  | 'contract'
  | 'benchmark_study'
  | 'invoice'

const REQUIRED_DOCUMENT_TYPES: RequiredDocumentType[] = [
  'master_file',
  'local_file',
  'contract',
  'benchmark_study',
  'invoice',
]

const REQUIRED_DOCUMENT_TYPE_LABELS: Record<RequiredDocumentType, string> = {
  master_file: 'Fő Fájl',
  local_file: 'Helyi Fájl',
  contract: 'Szerződés',
  benchmark_study: 'Benchmark tanulmány',
  invoice: 'Számla',
}

function isRequiredDocumentType(value: string): value is RequiredDocumentType {
  return REQUIRED_DOCUMENT_TYPES.includes(value as RequiredDocumentType)
}

function buildClassificationIssues(documents: IngestedDocument[]): string[] {
  const issues: string[] = []
  const matchedTypes = new Set<RequiredDocumentType>()

  for (const document of documents) {
    if (document.status === 'failed') {
      issues.push(`${document.filename}: ${document.error ?? 'Ismeretlen osztályozási hiba.'}`)
      continue
    }

    if (isRequiredDocumentType(document.detected_type)) {
      matchedTypes.add(document.detected_type)
      continue
    }

    issues.push(
      `${document.filename}: nem kötelező kategóriába került (${document.detected_type}).`,
    )
  }

  for (const requiredType of REQUIRED_DOCUMENT_TYPES) {
    if (!matchedTypes.has(requiredType)) {
      issues.push(
        `Hiányzó kötelező kategória: ${REQUIRED_DOCUMENT_TYPE_LABELS[requiredType]}.`,
      )
    }
  }

  return issues
}

export default function DocumentIngestor({
  sessionId,
  onIngestComplete,
}: DocumentIngestorProps): JSX.Element {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [phase, setPhase] = useState<IngestPhase>('empty')
  const [results, setResults] = useState<IngestedDocument[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [classificationIssues, setClassificationIssues] = useState<string[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

    if (event.dataTransfer.files.length > 0) {
      addFiles(event.dataTransfer.files)
    }
  }

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>): void {
    if (event.target.files && event.target.files.length > 0) {
      addFiles(event.target.files)
      event.currentTarget.value = ''
    }
  }

  function removeFile(name: string): void {
    setSelectedFiles((previousFiles) => {
      const nextFiles = previousFiles.filter((file) => file.name !== name)
      if (nextFiles.length === 0) setPhase('empty')
      return nextFiles
    })
  }

  function resetUploadFlow(openPicker = false): void {
    setSelectedFiles([])
    setResults([])
    setErrorMessage(null)
    setClassificationIssues([])
    setIsDragOver(false)
    setPhase('empty')

    if (openPicker) {
      fileInputRef.current?.click()
    }
  }

  async function handleIngest(): Promise<void> {
    if (selectedFiles.length !== MAX_FILES) {
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
      for (const file of selectedFiles) {
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
      setErrorMessage(
        issues.length > 0
          ? `A kötelező ${MAX_FILES} kategória besorolása nem teljesült.`
          : null,
      )
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
      <div className="mb-4 flex min-h-14 flex-wrap items-center justify-between gap-2 rounded-phantom-card border border-phantom-line bg-phantom-surface-muted/60 px-4 py-3">
        <p className="text-sm font-semibold text-phantom-ink">Dokumentum feltöltés</p>
        <StatusPill tone={phase === 'done' ? 'success' : 'neutral'}>PDF / DOCX</StatusPill>
      </div>

      {phase !== 'done' && (
        <>
          <label
            htmlFor={FILE_INPUT_ID}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={[
              'group flex cursor-pointer flex-col items-center justify-center gap-4 rounded-phantom-card border border-dashed p-6 text-center transition-phantom duration-phantom-base sm:p-8',
              isDragOver
                ? 'border-phantom-accent bg-phantom-accent-soft shadow-phantom-soft'
                : 'border-phantom-line bg-phantom-surface-muted hover:border-phantom-accent hover:bg-phantom-accent-soft hover:shadow-phantom-soft',
              phase === 'uploading' ? 'pointer-events-none opacity-70' : '',
            ].join(' ')}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-phantom-card bg-phantom-surface text-phantom-accent shadow-phantom-soft ring-1 ring-phantom-line transition-phantom duration-phantom-base group-hover:-translate-y-0.5">
              <Upload className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-semibold text-phantom-ink">
                {isDragOver
                  ? 'Engedd el itt a dokumentumokat'
                  : 'Húzd ide a dokumentumokat, vagy kattints'}
              </p>
              <p className="mt-1 text-xs leading-5 text-phantom-muted">
                PDF vagy DOCX, max 50 MB / fájl. Pontosan {MAX_FILES} dokumentum szükséges.
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
        multiple
        className="hidden"
        onChange={handleFileInput}
      />

      {(phase === 'ready' || phase === 'error') && selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-phantom-muted">
              Kiválasztva: {selectedFiles.length}/{MAX_FILES}
            </p>
            <StatusPill tone={selectedFiles.length === MAX_FILES ? 'success' : 'warning'}>
              {selectedFiles.length === MAX_FILES
                ? 'Készen áll'
                : `Még ${MAX_FILES - selectedFiles.length} hiányzik`}
            </StatusPill>
          </div>

          {selectedFiles.map((file) => (
            <div
              key={file.name}
              className="flex items-center gap-3 rounded-phantom-card border border-phantom-line bg-phantom-surface p-3 shadow-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-phantom-control bg-phantom-surface-muted text-phantom-muted ring-1 ring-phantom-line">
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
                className="shrink-0 rounded-phantom-control p-2 text-phantom-subtle transition-phantom duration-phantom-base hover:bg-phantom-surface-muted hover:text-phantom-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus"
                aria-label={`Eltávolítás: ${file.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {phase === 'uploading' && (
        <div className="mt-4 rounded-phantom-card border border-phantom-line bg-phantom-surface-muted p-4">
          <div className="flex items-center gap-3">
            <div className="force-spin h-5 w-5 animate-spin rounded-full border-2 border-phantom-accent border-t-transparent" />
            <p className="text-sm font-semibold text-phantom-ink">Beolvasás folyamatban...</p>
          </div>
        </div>
      )}

      {phase === 'done' && results.length > 0 && (
        <div className="space-y-4">
          <div className="rounded-phantom-card border border-phantom-line bg-phantom-surface px-4 py-3 min-h-14">
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
              <ul className="mt-2 space-y-1">
                {classificationIssues.map((issue, index) => (
                  <li key={`${issue}-${index}`} className="text-xs text-phantom-danger-text">
                    - {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            {results.map((document) => {
              const typeConfig = getDocumentTypeDisplay(document.detected_type)

              if (document.status === 'failed') {
                return (
                  <div
                    key={document.document_id}
                    className="rounded-phantom-card border border-phantom-danger-border bg-phantom-danger-soft p-4"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-phantom-danger-text" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-phantom-danger-text" title={document.filename}>
                          {document.filename}
                        </p>
                        <p className="mt-1 text-xs text-phantom-danger-text">Feldolgozás meghiúsult.</p>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={document.document_id}
                  className="rounded-phantom-card border border-phantom-line bg-phantom-surface p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-phantom-success-text" />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p
                          className="truncate text-sm font-semibold text-phantom-ink"
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
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-phantom-muted">
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

          <button
            type="button"
            onClick={() => resetUploadFlow()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-phantom-control border border-phantom-line bg-phantom-surface-muted px-3 py-2 text-xs font-semibold text-phantom-ink transition-phantom duration-phantom-base hover:border-phantom-accent hover:bg-phantom-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus"
          >
            <RotateCcw className="h-4 w-4" />
            Fájlok újrafeltöltése
          </button>
        </div>
      )}

      {errorMessage && phase !== 'uploading' && (
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
          <FileUp className="h-4 w-4" />
          Beolvasás indítása ({selectedFiles.length}/{MAX_FILES})
        </button>
      )}
    </section>
  )
}
