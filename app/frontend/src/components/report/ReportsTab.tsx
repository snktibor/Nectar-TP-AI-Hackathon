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
    <section className="flex h-full min-h-0 flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-8 shadow-md animate-phantom-fade-in">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="group relative animate-phantom-bounce-in" style={{ animationDelay: '40ms' }}>
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-phantom-accent-soft text-phantom-accent ring-1 ring-phantom-accent/20 transition-transform duration-phantom-base group-hover:-translate-y-0.5 group-hover:scale-105 group-hover:shadow-phantom-soft">
            <FileText className="h-10 w-10 transition-transform duration-phantom-base group-hover:-rotate-3" strokeWidth={1.5} />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-phantom-accent ring-1 ring-phantom-line animate-phantom-pulse-soft transition-transform duration-phantom-base group-hover:scale-110 group-hover:rotate-12">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
        </div>

        <h2
          className="mt-6 font-serif text-xl font-semibold text-phantom-ink animate-phantom-fade-in-up"
          style={{ animationDelay: '120ms' }}
        >
          Hivatalos Transzferár Jelentés
        </h2>
        <p
          className="mt-2 text-sm leading-6 text-phantom-muted animate-phantom-fade-in-up"
          style={{ animationDelay: '180ms' }}
        >
          Generáljon egy nyomtatásra kész, NAV-konform PDF jelentést az AI által
          talált összes konzisztencia hibáról, benchmark kockázatról és a
          kapcsolódó entitásokról.
        </p>

        {isReady && (
          <div className="mt-5 grid w-full grid-cols-3 gap-2">
            {[
              { label: 'Megállapítások', value: String(findingsTotal) },
              { label: 'Kockázat', value: auditReport.overall_risk, uppercase: true },
              { label: 'Session', value: auditReport.session_id.slice(0, 8), mono: true },
            ].map((card, index) => (
              <div
                key={card.label}
                style={{ animationDelay: `${240 + index * 70}ms` }}
                className="rounded-lg border border-phantom-line bg-phantom-surface-muted px-3 py-2 transition-phantom duration-phantom-base animate-phantom-fade-in-up hover:-translate-y-0.5 hover:border-phantom-accent/40 hover:shadow-phantom-soft"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-phantom-muted">
                  {card.label}
                </p>
                <p
                  className={[
                    'mt-0.5 truncate text-base font-semibold text-phantom-ink',
                    card.uppercase ? 'uppercase' : '',
                    card.mono ? 'font-mono text-xs' : '',
                  ].join(' ')}
                >
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          disabled={!isReady}
          onClick={() => setIsReportModalOpen(true)}
          style={{ animationDelay: '460ms' }}
          className={[
            'group/report mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold shadow-sm transition-all duration-phantom-base animate-phantom-fade-in-up',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-accent focus-visible:ring-offset-2',
            isReady
              ? 'bg-phantom-accent text-white hover:-translate-y-px hover:scale-[1.02] hover:bg-phantom-accent-hover hover:shadow-phantom-lift active:translate-y-0 active:scale-95'
              : 'cursor-not-allowed bg-phantom-surface-muted text-phantom-muted',
          ].join(' ')}
        >
          {isReady ? (
            <>
              <Sparkles className="h-4 w-4 transition-transform duration-phantom-base group-hover/report:rotate-12 group-hover/report:scale-125" />
              Jelentés Generálása
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 animate-phantom-pulse-soft" />
              Futtassa le előbb az auditot
            </>
          )}
        </button>

        <p
          className="mt-3 inline-flex items-center gap-1 text-[11px] text-phantom-muted animate-phantom-fade-in-up"
          style={{ animationDelay: '540ms' }}
        >
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
