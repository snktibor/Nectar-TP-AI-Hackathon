import { useRef, useState } from 'react'
import { FileText, CheckCircle, Loader2 } from 'lucide-react'
import type { DocumentType, DocumentUploadResponse } from '../types/api'

export type SlotKey = 'master_file' | 'local_file' | 'contract' | 'benchmark' | 'invoice'

interface SlotConfig {
  key: SlotKey
  label: string
  documentType: DocumentType
  required: boolean
}

const SLOT_CONFIGS: SlotConfig[] = [
  { key: 'master_file', label: 'Master File', documentType: 'MASTER_FILE', required: true },
  { key: 'local_file', label: 'Local File', documentType: 'LOCAL_FILE', required: true },
  { key: 'contract', label: 'Contract', documentType: 'CONTRACT', required: true },
  { key: 'benchmark', label: 'Benchmark Study', documentType: 'BENCHMARK_STUDY', required: false },
  { key: 'invoice', label: 'Invoice / Other', documentType: 'OTHER', required: false },
]

const REQUIRED_SLOTS: SlotKey[] = ['master_file', 'local_file', 'contract']

interface UploadPanelProps {
  sessionId: string
  uploadedDocs: Partial<Record<SlotKey, DocumentUploadResponse>>
  onUploaded: (slot: SlotKey, doc: DocumentUploadResponse) => void
  onStartAudit: () => void
  isDisabled: boolean
}

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

export default function UploadPanel({
  sessionId,
  uploadedDocs,
  onUploaded,
  onStartAudit,
  isDisabled,
}: UploadPanelProps): JSX.Element {
  const fileInputRefs = useRef<Array<HTMLInputElement | null>>(
    Array.from({ length: SLOT_CONFIGS.length }, () => null),
  )
  const [loadingSlots, setLoadingSlots] = useState<Partial<Record<SlotKey, boolean>>>({})
  const [slotErrors, setSlotErrors] = useState<Partial<Record<SlotKey, string>>>({})

  const requiredUploaded = REQUIRED_SLOTS.filter((key) => uploadedDocs[key] !== undefined).length
  const allRequiredUploaded = requiredUploaded === REQUIRED_SLOTS.length
  const canStartAudit = allRequiredUploaded && !isDisabled

  function handleSlotClick(index: number): void {
    if (isDisabled) return
    const ref = fileInputRefs.current[index]
    if (ref) {
      ref.value = ''
      ref.click()
    }
  }

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
    slot: SlotKey,
    documentType: DocumentType,
  ): Promise<void> {
    const file = event.target.files?.[0]
    if (!file) return

    setLoadingSlots((prev) => ({ ...prev, [slot]: true }))
    setSlotErrors((prev) => ({ ...prev, [slot]: undefined }))

    try {
      const formData = new FormData()
      formData.append('session_id', sessionId)
      formData.append('document_type', documentType)
      formData.append('file', file)

      const response = await fetch(`${API_BASE}/api/v1/documents/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const json = await response.json() as { success: boolean; data: DocumentUploadResponse | null; error: { message: string } | null }

      if (!json.success || !json.data) {
        throw new Error(json.error?.message ?? 'Upload failed')
      }

      onUploaded(slot, json.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setSlotErrors((prev) => ({ ...prev, [slot]: message }))
    } finally {
      setLoadingSlots((prev) => ({ ...prev, [slot]: false }))
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
      <h2 className="mb-1 text-base font-semibold text-gray-900">Document Upload</h2>
      <p className="mb-5 text-sm text-gray-500">
        Upload transfer pricing documents to begin the audit.
      </p>

      <div className="space-y-3">
        {SLOT_CONFIGS.map((slot, index) => {
          const uploaded = uploadedDocs[slot.key]
          const loading = loadingSlots[slot.key] ?? false
          const error = slotErrors[slot.key]

          return (
            <div key={slot.key}>
              <button
                type="button"
                onClick={() => handleSlotClick(index)}
                disabled={isDisabled || loading}
                className={[
                  'flex w-full items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 text-left transition-colors',
                  uploaded
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-gray-50 hover:border-orange-300 hover:bg-orange-50',
                  isDisabled || loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                ].join(' ')}
              >
                <div className="shrink-0">
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                  ) : uploaded ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <FileText className="h-5 w-5 text-gray-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">{slot.label}</span>
                    {slot.required && (
                      <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-600">
                        Required
                      </span>
                    )}
                  </div>
                  {uploaded ? (
                    <span className="block truncate text-xs text-gray-500">
                      {uploaded.filename}
                    </span>
                  ) : loading ? (
                    <span className="text-xs text-orange-500">Uploading…</span>
                  ) : (
                    <span className="text-xs text-gray-400">Click to select file</span>
                  )}
                </div>
              </button>

              {error && (
                <p className="mt-1 text-xs text-red-600">{error}</p>
              )}

              <input
                ref={(el) => {
                  fileInputRefs.current[index] = el
                }}
                type="file"
                accept="*/*"
                className="hidden"
                onChange={(e) => void handleFileChange(e, slot.key, slot.documentType)}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          <span className={requiredUploaded === REQUIRED_SLOTS.length ? 'text-green-600 font-medium' : 'text-gray-500'}>
            {requiredUploaded} / {REQUIRED_SLOTS.length}
          </span>{' '}
          required documents uploaded
        </span>
      </div>

      <button
        type="button"
        onClick={onStartAudit}
        disabled={!canStartAudit}
        className={[
          'mt-4 w-full rounded-lg px-4 py-3 text-sm font-semibold tracking-wide transition-colors',
          canStartAudit
            ? 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700'
            : 'cursor-not-allowed bg-gray-100 text-gray-400',
        ].join(' ')}
      >
        START AUDIT
      </button>
    </div>
  )
}
