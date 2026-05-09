import { useState } from 'react'
import { FileText, ShieldAlert } from 'lucide-react'
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
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-gray-100 bg-white p-8">
      <div className="w-full rounded-2xl border border-phantom-line bg-[#f8fafc] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-orange-600">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-gray-900">Hivatalos Transzferár Jelentés</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Generáljon egy nyomtatásra kész, NAV-konform PDF jelentést az AI által talált összes
              konzisztencia hibáról, benchmark kockázatról és a kapcsolódó entitásokról.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Kimenet</p>
            <p className="mt-1 text-sm font-medium text-gray-900">Nyomtatható, NAV-konform PDF</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Tartalom</p>
            <p className="mt-1 text-sm font-medium text-gray-900">Findingok, benchmark kockázatok, entitások, forráshivatkozások</p>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Mit tartalmaz a jelentés</p>
          <ul className="mt-1.5 space-y-1 text-sm leading-5 text-gray-700">
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
              'inline-flex min-h-11 w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition-all sm:w-auto',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-accent focus-visible:ring-offset-2',
              isReady
                ? 'bg-phantom-accent text-white shadow-phantom-soft hover:-translate-y-px hover:bg-phantom-accent-hover hover:shadow-phantom-lift'
                : 'cursor-not-allowed border border-phantom-line bg-white text-gray-600',
            ].join(' ')}
          >
            Jelentés Generálása
          </button>

          <p className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
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
