import { useEffect, useMemo, useState } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { Check, Download, FileText, Loader2, X } from 'lucide-react'
import type { BackendAuditReport } from '../../lib/backendAudit'
import ReportTemplate, {
  type EntityGraph,
  type TaxVerificationResult,
} from './ReportTemplate'

interface ReportGeneratorModalProps {
  readonly open: boolean
  readonly report: BackendAuditReport
  readonly entityGraph?: EntityGraph
  readonly taxVerificationResults?: ReadonlyArray<TaxVerificationResult>
  readonly onClose: () => void
}

interface BuildStep {
  readonly id: string
  readonly label: string
  readonly durationMs: number
}

const STEPS: ReadonlyArray<BuildStep> = [
  { id: 'compose',  label: 'Composing executive narrative',     durationMs: 900 },
  { id: 'risk',     label: 'Aggregating risk dashboard metrics', durationMs: 800 },
  { id: 'findings', label: 'Rendering findings with citations',  durationMs: 1100 },
  { id: 'finalize', label: 'Finalizing PDF layout',              durationMs: 700 },
]

export default function ReportGeneratorModal({
  open,
  report,
  entityGraph,
  taxVerificationResults,
  onClose,
}: ReportGeneratorModalProps): JSX.Element | null {
  const [completedCount, setCompletedCount] = useState(0)

  // Reset and replay the staged loader every time the modal opens.
  useEffect(() => {
    if (!open) {
      setCompletedCount(0)
      return
    }
    let cancelled = false
    let elapsed = 0
    const timeouts: number[] = []

    STEPS.forEach((step, idx) => {
      elapsed += step.durationMs
      const handle = window.setTimeout(() => {
        if (cancelled) return
        setCompletedCount(idx + 1)
      }, elapsed)
      timeouts.push(handle)
    })

    return () => {
      cancelled = true
      timeouts.forEach((h) => window.clearTimeout(h))
    }
  }, [open])

  const isReady = completedCount >= STEPS.length

  const downloadFilename = useMemo(() => {
    const datePart = (report.generated_at || new Date().toISOString()).slice(0, 10)
    const sessionPart = report.session_id.slice(0, 8)
    return `RedlinePhantom_TP_Report_${sessionPart}_${datePart}.pdf`
  }, [report.generated_at, report.session_id])

  const documentElement = useMemo(
    () => (
      <ReportTemplate
        report={report}
        entityGraph={entityGraph}
        taxVerificationResults={taxVerificationResults}
      />
    ),
    [report, entityGraph, taxVerificationResults],
  )

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-phantom-ink/50 px-4 py-6 backdrop-blur-sm animate-phantom-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-phantom-line animate-phantom-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-phantom-line bg-phantom-surface-muted px-6 py-4 animate-phantom-fade-in-down">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-phantom-accent/10 text-phantom-accent animate-phantom-bounce-in">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="report-modal-title"
                className="font-serif text-base font-semibold text-phantom-ink animate-phantom-fade-in-up"
                style={{ animationDelay: '80ms' }}
              >
                Generate Compliance Report
              </h2>
              <p className="text-xs text-phantom-muted animate-phantom-fade-in-up" style={{ animationDelay: '140ms' }}>
                Session {report.session_id.slice(0, 8)} · A4 PDF deliverable
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="group rounded-md p-1 text-phantom-muted transition-phantom duration-phantom-base hover:bg-white hover:text-phantom-ink active:scale-90"
          >
            <X className="h-5 w-5 transition-transform duration-phantom-base group-hover:rotate-90" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <ol className="space-y-3">
            {STEPS.map((step, idx) => {
              const isDone = idx < completedCount
              const isActive = idx === completedCount && !isReady
              return (
                <li
                  key={step.id}
                  style={{ animationDelay: `${180 + idx * 80}ms` }}
                  className="flex items-center gap-3 animate-phantom-slide-in-right"
                >
                  <span
                    className={[
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 transition-colors',
                      isDone
                        ? 'bg-phantom-accent text-white ring-phantom-accent'
                        : isActive
                        ? 'bg-white text-phantom-accent ring-phantom-accent'
                        : 'bg-white text-phantom-muted ring-phantom-line',
                    ].join(' ')}
                  >
                    {isDone ? (
                      <Check className="h-3.5 w-3.5 animate-phantom-bounce-in" strokeWidth={3} />
                    ) : isActive ? (
                      <Loader2 className="force-spin h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <span className="text-[10px] font-semibold">{idx + 1}</span>
                    )}
                  </span>
                  <span
                    className={[
                      'text-sm transition-colors',
                      isDone
                        ? 'text-phantom-ink'
                        : isActive
                        ? 'font-medium text-phantom-ink'
                        : 'text-phantom-muted',
                    ].join(' ')}
                  >
                    {step.label}
                  </span>
                </li>
              )
            })}
          </ol>

          {/* Progress bar */}
          <div
            className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-phantom-surface-muted animate-phantom-fade-in-up"
            style={{ animationDelay: `${180 + STEPS.length * 80}ms` }}
          >
            <div
              className="phantom-progress-stripes h-full rounded-full bg-phantom-accent transition-[width] duration-500 ease-out"
              style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Footer / CTA */}
        <div className="border-t border-phantom-line bg-white px-6 py-5 animate-phantom-fade-in-up" style={{ animationDelay: `${260 + STEPS.length * 80}ms` }}>
          {isReady ? (
            <PDFDownloadLink
              document={documentElement}
              fileName={downloadFilename}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-phantom-accent px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-phantom-accent-hover hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-accent focus-visible:ring-offset-2"
            >
              {({ loading, error }) => {
                if (error) {
                  return (
                    <span className="text-sm font-medium text-white">
                      Failed to render PDF — please retry.
                    </span>
                  )
                }
                if (loading) {
                  return (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing download…
                    </>
                  )
                }
                return (
                  <>
                    <Download className="h-4 w-4" />
                    Download PDF Report
                  </>
                )
              }}
            </PDFDownloadLink>
          ) : (
            <button
              type="button"
              disabled
              className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-phantom-surface-muted px-5 py-3.5 text-sm font-semibold text-phantom-muted"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Building report…
            </button>
          )}
          <p className="mt-3 text-center text-[11px] text-phantom-muted">
            Confidential — contains tax-sensitive information.
          </p>
        </div>
      </div>
    </div>
  )
}
