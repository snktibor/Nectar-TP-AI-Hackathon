import { useState } from 'react'
import { FileText, ShieldAlert } from 'lucide-react'
import { phantomDesign } from '../../design-system/phantomDesign'
import type { BackendAuditReport } from '../../lib/backendAudit'
import ReportGeneratorModal from './ReportGeneratorModal'

interface ReportsTabProps {
  readonly auditReport: BackendAuditReport | null
}

export default function ReportsTab({ auditReport }: ReportsTabProps): JSX.Element {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  const isReady = auditReport !== null

  function closeReportModal(): void {
    setIsReportModalOpen(false)
  }

  return (
    <section className={[phantomDesign.components.panel, 'flex flex-col'].join(' ')}>
      <div className={phantomDesign.components.contentCardMuted}>
        <div className="flex items-start gap-3">
          <span className={phantomDesign.components.iconBadge}>
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-7 text-phantom-ink">Hivatalos Transzferár Jelentés</h2>
            <p className="mt-2 text-sm leading-6 text-phantom-muted">
              Generáljon egy nyomtatásra kész, NAV-konform PDF jelentést az AI által talált összes
              konzisztencia hibáról, benchmark kockázatról és a kapcsolódó entitásokról.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className={phantomDesign.components.compactCard}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-phantom-subtle">Kimenet</p>
            <p className="mt-1 text-sm font-medium text-phantom-ink">Nyomtatható, NAV-konform PDF</p>
          </div>
          <div className={phantomDesign.components.compactCard}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-phantom-subtle">Tartalom</p>
            <p className="mt-1 text-sm font-medium text-phantom-ink">Findingok, benchmark kockázatok, entitások, forráshivatkozások</p>
          </div>
        </div>

        <div className={[phantomDesign.components.compactCard, 'mt-3'].join(' ')}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-phantom-subtle">Mit tartalmaz a jelentés</p>
          <ul className="mt-1.5 space-y-1 text-sm leading-5 text-phantom-muted">
            <li>• Vezetői összefoglaló az audit eredményeiről és NAV-kockázati szintről.</li>
            <li>• Részletes findinglista súlyossággal, indoklással és dokumentum-hivatkozásokkal.</li>
            <li>• Benchmark eltérések, teljességi hiányok és javasolt remediációs lépések.</li>
          </ul>
        </div>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={!isReady}
            onClick={() => setIsReportModalOpen(true)}
            className={[
              'inline-flex min-h-11 w-full items-center justify-center rounded-phantom-control px-5 py-3 text-sm font-semibold transition-phantom duration-phantom-base sm:w-auto',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phantom-surface',
              isReady
                ? 'bg-phantom-accent text-white shadow-phantom-button hover:bg-phantom-accent-hover'
                : 'cursor-not-allowed border border-phantom-line bg-phantom-surface text-phantom-subtle',
            ].join(' ')}
          >
            Jelentés Generálása
          </button>

          <p className="inline-flex items-center gap-1.5 text-[11px] text-phantom-subtle">
            <ShieldAlert className="h-3.5 w-3.5" />
            Bizalmas — adózási információt tartalmaz.
          </p>
        </div>
      </div>

      {isReady && (
        <ReportGeneratorModal
          open={isReportModalOpen}
          report={auditReport}
          onClose={closeReportModal}
        />
      )}
    </section>
  )
}
