import { useEffect, useMemo, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { Check, Download, FileText, Loader2, X } from 'lucide-react'
import { phantomDesign } from '../../design-system/phantomDesign'
import type { BackendAuditReport } from '../../lib/backendAudit'
import { buildEnterpriseReportPayload } from '../../lib/enterpriseReport'
import EnterpriseReportPdfDocument from './EnterpriseReportPdfDocument'

interface ReportGeneratorModalProps {
  readonly open: boolean
  readonly report: BackendAuditReport
  readonly onClose: () => void
}

interface BuildStep {
  readonly id: string
  readonly label: string
  readonly durationMs: number
}

type DownloadState = 'idle' | 'building' | 'error'

const STEPS: ReadonlyArray<BuildStep> = [
  { id: 'scope', label: 'Audit scope és finding adatok összeállítása', durationMs: 700 },
  { id: 'matrix', label: 'Kockázati mátrixok és hőtérkép előállítása', durationMs: 900 },
  { id: 'finance', label: 'Pénzügyi kitettség és remediáció számítása', durationMs: 1000 },
  { id: 'layout', label: 'Enterprise riport elrendezés véglegesítése', durationMs: 850 },
]

export default function ReportGeneratorModal({
  open,
  report,
  onClose,
}: ReportGeneratorModalProps): JSX.Element | null {
  const [completedCount, setCompletedCount] = useState(0)
  const [downloadState, setDownloadState] = useState<DownloadState>('idle')
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const payload = useMemo(() => buildEnterpriseReportPayload(report), [report])

  useEffect(() => {
    if (!open) {
      setCompletedCount(0)
      setDownloadState('idle')
      setDownloadError(null)
      return
    }

    let cancelled = false
    let elapsed = 0
    const timers: number[] = []

    setCompletedCount(0)
    setDownloadState('idle')
    setDownloadError(null)
    STEPS.forEach((step, index) => {
      elapsed += step.durationMs
      const timerId = globalThis.setTimeout(() => {
        if (cancelled) return
        setCompletedCount(index + 1)
      }, elapsed)
      timers.push(timerId)
    })

    return () => {
      cancelled = true
      timers.forEach((timerId) => globalThis.clearTimeout(timerId))
    }
  }, [open])

  const isStagedReady = completedCount >= STEPS.length
  const canDownload = isStagedReady && downloadState === 'idle'

  const downloadFilename = useMemo(() => {
    const datePart = (report.generated_at || new Date().toISOString()).slice(0, 10)
    const sessionPart = report.session_id.slice(0, 8)
    return `NectarTP_Enterprise_Report_${sessionPart}_${datePart}.pdf`
  }, [report.generated_at, report.session_id])

  async function handlePdfDownload(): Promise<void> {
    if (!canDownload) return

    setDownloadState('building')
    setDownloadError(null)

    try {
      const reportBlob = await pdf(<EnterpriseReportPdfDocument payload={payload} />).toBlob()
      if (reportBlob.size === 0) {
        throw new Error('A generált PDF üres.')
      }

      const objectUrl = URL.createObjectURL(reportBlob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = downloadFilename
      document.body.append(link)
      link.click()
      link.remove()
      globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
      setDownloadState('idle')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'A PDF generálása sikertelen.'
      setDownloadState('error')
      setDownloadError(message)
    }
  }

  if (!open) return null

  let actionLabel = 'Riport előkészítése...'
  let actionIcon: JSX.Element = <Loader2 className="force-spin h-4 w-4 animate-spin" />

  if (isStagedReady) {
    if (downloadState === 'building') {
      actionLabel = 'PDF készítése...'
      actionIcon = <Loader2 className="force-spin h-4 w-4 animate-spin" />
    } else if (downloadState === 'error') {
      actionLabel = 'PDF letöltés nem elérhető'
      actionIcon = <Download className="h-4 w-4" />
    } else {
      actionLabel = 'PDF letöltés'
      actionIcon = <Download className="h-4 w-4" />
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center px-3 py-4 sm:px-4 sm:py-6">
      <button
        type="button"
        aria-label="Riport ablak bezárása"
        className="absolute inset-0 z-0 bg-phantom-ink/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 max-h-full w-full max-w-2xl overflow-hidden rounded-phantom-card border border-phantom-line bg-phantom-surface">
        <div className="flex items-start justify-between gap-3 border-b border-phantom-line bg-phantom-surface-muted px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className={phantomDesign.components.iconBadge}>
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="report-modal-title" className="break-words text-base font-semibold text-phantom-ink">
                Big4-szintű TP jelentés generálása
              </h2>
              <p className="break-all text-xs text-phantom-muted">
                20+ oldalas enterprise riport · Session {report.session_id.slice(0, 8)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Riport ablak bezárása"
            className="inline-flex h-8 w-8 items-center justify-center rounded-phantom-control border border-phantom-line bg-phantom-surface text-phantom-muted transition-phantom duration-phantom-base hover:border-phantom-accent hover:text-phantom-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-6">
          <ol className="space-y-3">
            {STEPS.map((step, index) => {
              const isDone = index < completedCount
              const isActive = index === completedCount && !isStagedReady
              const isPending = !isDone && !isActive

              let iconContainerClass = 'bg-phantom-surface text-phantom-muted ring-phantom-line'
              if (isDone) {
                iconContainerClass = 'bg-phantom-accent text-white ring-phantom-accent'
              } else if (isActive || isPending) {
                iconContainerClass = 'bg-phantom-surface text-phantom-accent ring-phantom-accent'
              }

              let stepIcon: JSX.Element = <Loader2 className="force-spin h-3.5 w-3.5 animate-spin" />
              if (isDone) {
                stepIcon = <Check className="h-3.5 w-3.5" strokeWidth={3} />
              } else if (isActive || isPending) {
                stepIcon = <Loader2 className="force-spin h-3.5 w-3.5 animate-spin" />
              }

              const stepLabelClass = isDone || isActive ? 'text-sm text-phantom-ink' : 'text-sm text-phantom-muted'

              return (
                <li key={step.id} className="flex min-w-0 items-center gap-3">
                  <span
                    className={[
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 transition-colors',
                      iconContainerClass,
                    ].join(' ')}
                  >
                    {stepIcon}
                  </span>
                  <span className={[stepLabelClass, 'min-w-0 break-words'].join(' ')}>{step.label}</span>
                </li>
              )
            })}
          </ol>

          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-phantom-surface-muted">
            <div
              className="h-full rounded-full bg-phantom-accent transition-all duration-500 ease-out"
              style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="border-t border-phantom-line bg-phantom-surface px-6 py-5">
          <div className="flex flex-col items-center justify-center gap-2.5 text-center">
            <button
              type="button"
              disabled={!canDownload}
              onClick={() => {
                void handlePdfDownload()
              }}
              className={[
                phantomDesign.components.buttonBase,
                canDownload
                  ? [
                      phantomDesign.components.buttonPrimary,
                      'inline-flex w-full max-w-xs items-center justify-center gap-2',
                    ].join(' ')
                  : 'inline-flex w-full max-w-xs cursor-not-allowed items-center justify-center gap-2 border border-phantom-line bg-phantom-surface-muted text-phantom-muted',
              ].join(' ')}
            >
              {actionIcon}
              {actionLabel}
            </button>

            {downloadError ? (
              <p className="max-w-md text-center text-[11px] leading-4 text-phantom-danger-text">
                {downloadError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
