import { useState } from 'react'
import { FileText, Sparkles, ShieldAlert, Lock } from 'lucide-react'
import type { BackendAuditReport } from '../../lib/backendAudit'
import ReportGeneratorModal from './ReportGeneratorModal'

interface ReportsTabProps {
  readonly auditReport: BackendAuditReport | null
}

export default function ReportsTab({ auditReport }: ReportsTabProps): JSX.Element {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  const isReady = auditReport !== null

  const findingsTotal = auditReport
    ? auditReport.consistency_errors.length +
      auditReport.benchmark_risks.length +
      auditReport.missing_elements.length
    : 0

  return (
    <section className="flex h-full min-h-0 flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-8 shadow-md">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-phantom-accent-soft text-phantom-accent ring-1 ring-phantom-accent/20">
            <FileText className="h-10 w-10" strokeWidth={1.5} />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-phantom-accent ring-1 ring-phantom-line">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
        </div>

        <h2 className="mt-6 font-serif text-xl font-semibold text-phantom-ink">
          Hivatalos Transzferár Jelentés
        </h2>
        <p className="mt-2 text-sm leading-6 text-phantom-muted">
          Generáljon egy nyomtatásra kész, NAV-konform PDF jelentést az AI által
          talált összes konzisztencia hibáról, benchmark kockázatról és a
          kapcsolódó entitásokról.
        </p>

        {isReady && (
          <div className="mt-5 grid w-full grid-cols-3 gap-2">
            <div className="rounded-lg border border-phantom-line bg-phantom-surface-muted px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-phantom-muted">
                Megállapítások
              </p>
              <p className="mt-0.5 text-base font-semibold text-phantom-ink">
                {findingsTotal}
              </p>
            </div>
            <div className="rounded-lg border border-phantom-line bg-phantom-surface-muted px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-phantom-muted">
                Kockázat
              </p>
              <p className="mt-0.5 text-base font-semibold text-phantom-ink uppercase">
                {auditReport.overall_risk}
              </p>
            </div>
            <div className="rounded-lg border border-phantom-line bg-phantom-surface-muted px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-phantom-muted">
                Session
              </p>
              <p className="mt-0.5 truncate font-mono text-xs font-semibold text-phantom-ink">
                {auditReport.session_id.slice(0, 8)}
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={!isReady}
          onClick={() => setIsReportModalOpen(true)}
          className={[
            'mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold shadow-sm transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-accent focus-visible:ring-offset-2',
            isReady
              ? 'bg-phantom-accent text-white hover:-translate-y-px hover:bg-phantom-accent-hover hover:shadow-md active:translate-y-0'
              : 'cursor-not-allowed bg-phantom-surface-muted text-phantom-muted',
          ].join(' ')}
        >
          {isReady ? (
            <>
              <Sparkles className="h-4 w-4" />
              Jelentés Generálása
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              Futtassa le előbb az auditot
            </>
          )}
        </button>

        <p className="mt-3 inline-flex items-center gap-1 text-[11px] text-phantom-muted">
          <ShieldAlert className="h-3 w-3" />
          Bizalmas — adózási információt tartalmaz.
        </p>
      </div>

      {isReady && (
        <ReportGeneratorModal
          open={isReportModalOpen}
          report={auditReport}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}
    </section>
  )
}
