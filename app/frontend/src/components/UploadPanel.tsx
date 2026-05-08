import { useRef, useState } from 'react'
import { FileText, CheckCircle, Loader2 } from 'lucide-react'
import type { ApiResponse, DocumentType, DocumentUploadResponse } from '../types/api'
import { phantomDesign } from '../design-system/phantomDesign'

export type SlotKey = 'master_file' | 'local_file' | 'contract' | 'benchmark' | 'invoice'

interface SlotConfig {
  readonly key: SlotKey
  readonly label: string
  readonly documentType: DocumentType
  readonly required: boolean
}

const SLOT_CONFIGS: SlotConfig[] = [
  { key: 'master_file', label: 'Fő Fájl', documentType: 'MASTER_FILE', required: true },
  { key: 'local_file', label: 'Helyi Fájl', documentType: 'LOCAL_FILE', required: true },
  { key: 'contract', label: 'Szerződés', documentType: 'CONTRACT', required: true },
  { key: 'benchmark', label: 'Benchmark tanulmány', documentType: 'BENCHMARK_STUDY', required: false },
  { key: 'invoice', label: 'Számla / Egyéb', documentType: 'OTHER', required: false },
]

const REQUIRED_SLOTS: SlotKey[] = ['master_file', 'local_file', 'contract']

interface UploadPanelProps {
  readonly sessionId: string
  readonly uploadedDocs: Partial<Record<SlotKey, DocumentUploadResponse>>
  readonly onUploaded: (slot: SlotKey, doc: DocumentUploadResponse) => void
  readonly onStartAudit: () => void
  readonly isDisabled: boolean
}

const API_BASE = import.meta.env.VITE_API_BASE_URL

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

      const json = (await response.json()) as ApiResponse<DocumentUploadResponse>

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
    <div className={phantomDesign.components.panel}>
      <div className={phantomDesign.components.panelHeader}>
        <h2 className={phantomDesign.components.panelTitle}>Dokumentum feltöltés</h2>
        <p className={phantomDesign.components.panelDescription}>
        Tölts fel transzfer árazási dokumentumokat az audit megkezdéséhez.
        </p>
      </div>

      <div className="space-y-3">
        {SLOT_CONFIGS.map((slot, index) => {
          const uploaded = uploadedDocs[slot.key]
          const loading = loadingSlots[slot.key] ?? false
          const error = slotErrors[slot.key]
          let slotIcon = <FileText className="h-5 w-5 text-phantom-subtle" />
          let slotStatus = <span className="text-xs text-phantom-subtle">Kattints a fájl kiválasztásához</span>

          if (loading) {
            slotIcon = <Loader2 className="h-5 w-5 animate-spin text-phantom-accent" />
            slotStatus = <span className="text-xs text-phantom-accent">Feltöltés...</span>
          } else if (uploaded) {
            slotIcon = <CheckCircle className="h-5 w-5 text-phantom-success-text" />
            slotStatus = (
              <span className="block truncate text-xs text-phantom-muted" title={uploaded.filename}>
                {uploaded.filename}
              </span>
            )
          }

          return (
            <div key={slot.key}>
              <button
                type="button"
                onClick={() => handleSlotClick(index)}
                disabled={isDisabled || loading}
                aria-disabled={isDisabled || loading}
                className={[
                  phantomDesign.components.uploadSlotBase,
                  uploaded ? phantomDesign.components.uploadSlotUploaded : phantomDesign.components.uploadSlotIdle,
                  isDisabled || loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                ].join(' ')}
              >
                <div className="shrink-0">{slotIcon}</div>

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-phantom-ink">{slot.label}</span>
                    {slot.required && (
                      <span className="rounded-full bg-phantom-accent-soft px-1.5 py-0.5 text-xs font-medium text-phantom-accent ring-1 ring-phantom-accent/20">
                        Kötelező
                      </span>
                    )}
                  </div>
                  {slotStatus}
                </div>
              </button>

              {error && (
                <p className="mt-1 break-words text-xs text-phantom-danger-text">{error}</p>
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
        <span className="text-xs text-phantom-muted">
          <span className={requiredUploaded === REQUIRED_SLOTS.length ? 'font-medium text-phantom-success-text' : 'text-phantom-muted'}>
            {requiredUploaded} / {REQUIRED_SLOTS.length}
          </span>{' '}
          required documents uploaded
        </span>
      </div>

      <button
        type="button"
        onClick={onStartAudit}
        disabled={!canStartAudit}
        aria-disabled={!canStartAudit}
        className={[
          phantomDesign.components.buttonBase,
          phantomDesign.components.buttonPrimary,
          'mt-4',
        ].join(' ')}
      >
        START AUDIT
      </button>
    </div>
  )
}
