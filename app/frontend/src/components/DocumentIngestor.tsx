import { useState, useRef, useCallback } from 'react'
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  FileUp,
} from 'lucide-react'
import type { ApiResponse, IngestResponse, IngestedDocument } from '../types/api'
import { phantomDesign } from '../design-system/phantomDesign'

const API_BASE = import.meta.env.VITE_API_BASE_URL
const ACCEPTED_TYPES = '.pdf,.docx'
const MAX_FILE_SIZE = 50 * 1024 * 1024

interface DocumentIngestorProps {
  readonly sessionId: string
  readonly onIngestComplete?: (documents: IngestedDocument[]) => void
}

type IngestPhase = 'empty' | 'ready' | 'uploading' | 'done' | 'error'

const DOC_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  master_file: {
    label: 'Master File',
    color: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  },
  local_file: {
    label: 'Local File',
    color: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  },
  benchmark_study: {
    label: 'Benchmark',
    color: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  },
  contract: {
    label: 'Contract',
    color: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  },
  invoice: {
    label: 'Invoice',
    color: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  },
  financial_statement: {
    label: 'Financial',
    color: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  },
  regulatory_document: {
    label: 'Regulatory',
    color: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  },
  other: {
    label: 'Other',
    color: 'bg-gray-50 text-gray-700 ring-gray-600/20',
  },
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentIngestor({
  sessionId,
  onIngestComplete,
}: DocumentIngestorProps): JSX.Element {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [phase, setPhase] = useState<IngestPhase>('empty')
  const [results, setResults] = useState<IngestedDocument[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const valid: File[] = []
    const fileArray = Array.from(incoming)

    for (const file of fileArray) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!['pdf', 'docx'].includes(ext)) continue
      if (file.size > MAX_FILE_SIZE) continue
      if (file.size === 0) continue
      valid.push(file)
    }

    if (valid.length === 0) return

    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name))
      const deduped = valid.filter((f) => !existingNames.has(f.name))
      return [...prev, ...deduped]
    })
    setPhase('ready')
    setErrorMessage(null)
  }, [])

  function handleDragOver(e: React.DragEvent): void {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent): void {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent): void {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>): void {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files)
    }
  }

  function removeFile(name: string): void {
    setSelectedFiles((prev) => {
      const next = prev.filter((f) => f.name !== name)
      if (next.length === 0) setPhase('empty')
      return next
    })
  }

  async function handleIngest(): Promise<void> {
    if (selectedFiles.length === 0) return

    setPhase('uploading')
    setErrorMessage(null)
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
        const errorJson = await response.json().catch(() => null)
        const msg =
          errorJson?.error?.message ??
          `HTTP ${response.status}: ${response.statusText}`
        throw new Error(msg)
      }

      const json = (await response.json()) as ApiResponse<IngestResponse>

      if (!json.success || !json.data) {
        throw new Error(json.error?.message ?? 'Ingest failed')
      }

      setResults(json.data.documents)
      setPhase('done')
      onIngestComplete?.(json.data.documents)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ingest failed'
      setErrorMessage(message)
      setPhase('error')
    }
  }

  function handleReset(): void {
    setSelectedFiles([])
    setResults([])
    setPhase('empty')
    setErrorMessage(null)
  }

  return (
    <div className={phantomDesign.components.panel}>
      <div className={phantomDesign.components.panelHeader}>
        <h2 className={phantomDesign.components.panelTitle}>
          Document Ingestor
        </h2>
        <p className={phantomDesign.components.panelDescription}>
          Upload transfer pricing documents for automatic classification and
          indexing.
        </p>
      </div>

      {/* Drop Zone — visible when no results yet */}
      {phase !== 'done' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
          }}
          className={[
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-phantom-card border-2 border-dashed p-8 text-center transition-phantom duration-phantom-base',
            isDragOver
              ? 'border-phantom-accent bg-phantom-accent-soft'
              : 'border-phantom-line bg-phantom-surface-muted hover:border-phantom-accent hover:bg-phantom-accent-soft',
            phase === 'uploading' ? 'pointer-events-none opacity-60' : '',
          ].join(' ')}
        >
          <Upload
            className={[
              'h-8 w-8',
              isDragOver ? 'text-phantom-accent' : 'text-phantom-subtle',
            ].join(' ')}
          />
          <div>
            <p className="text-sm font-medium text-phantom-ink">
              {isDragOver
                ? 'Drop files here'
                : 'Drag & drop documents here'}
            </p>
            <p className="mt-1 text-xs text-phantom-muted">
              PDF, DOCX — max 50 MB per file
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      )}

      {/* Selected files list (before ingest) */}
      {(phase === 'ready' || phase === 'error') && selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-phantom-muted">
            {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}{' '}
            selected
          </p>
          {selectedFiles.map((file) => (
            <div
              key={file.name}
              className="flex items-center gap-3 rounded-phantom-card border border-phantom-line bg-phantom-surface p-3"
            >
              <FileText className="h-4 w-4 shrink-0 text-phantom-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-phantom-ink" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-phantom-muted">
                  {formatBytes(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeFile(file.name)
                }}
                className="shrink-0 rounded p-1 text-phantom-subtle hover:bg-phantom-surface-muted hover:text-phantom-ink"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Skeleton loader during upload */}
      {phase === 'uploading' && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-phantom-accent border-t-transparent" />
            <p className="text-sm font-medium text-phantom-accent">
              Analyzing and indexing documents...
            </p>
          </div>
          {selectedFiles.map((file) => (
            <div
              key={file.name}
              className="animate-pulse rounded-phantom-card border border-phantom-line bg-phantom-surface-muted p-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 rounded bg-phantom-line" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-phantom-line" />
                  <div className="h-2 w-1/3 rounded bg-phantom-line" />
                </div>
                <div className="h-5 w-16 rounded-full bg-phantom-line" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results cards */}
      {phase === 'done' && results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-phantom-success-text">
              {results.filter((r) => r.status === 'success').length} of{' '}
              {results.length} documents processed successfully
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-medium text-phantom-accent hover:text-phantom-accent-hover"
            >
              Upload more
            </button>
          </div>
          {results.map((doc) => {
            const typeConfig = DOC_TYPE_LABELS[doc.detected_type] ?? DOC_TYPE_LABELS['other']

            if (doc.status === 'failed') {
              return (
                <div
                  key={doc.document_id}
                  className="rounded-phantom-card border border-red-200 bg-red-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-red-800" title={doc.filename}>
                        {doc.filename}
                      </p>
                      <p className="mt-1 text-xs text-red-600">
                        {doc.error ?? 'Processing failed'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={doc.document_id}
                className="rounded-phantom-card border border-phantom-line bg-phantom-surface p-4"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-phantom-success-text" />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p
                        className="truncate text-sm font-medium text-phantom-ink"
                        title={doc.filename}
                      >
                        {doc.filename}
                      </p>
                      <span
                        className={[
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
                          typeConfig.color,
                        ].join(' ')}
                      >
                        {typeConfig.label}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-phantom-muted">
                      <span>{doc.page_count} pages</span>
                      <span>{doc.chunk_count} chunks</span>
                      <span>{formatBytes(doc.size_bytes)}</span>
                      <span>
                        {Math.round(doc.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Error state */}
      {phase === 'error' && errorMessage && (
        <div className="mt-4 rounded-phantom-card border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-800">Ingest failed</p>
              <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action button */}
      {(phase === 'ready' || phase === 'error') && (
        <button
          type="button"
          onClick={() => void handleIngest()}
          disabled={selectedFiles.length === 0}
          className={[
            phantomDesign.components.buttonBase,
            phantomDesign.components.buttonPrimary,
            'mt-4 flex items-center justify-center gap-2',
          ].join(' ')}
        >
          <FileUp className="h-4 w-4" />
          ANALYZE {selectedFiles.length} DOCUMENT
          {selectedFiles.length > 1 ? 'S' : ''}
        </button>
      )}
    </div>
  )
}
