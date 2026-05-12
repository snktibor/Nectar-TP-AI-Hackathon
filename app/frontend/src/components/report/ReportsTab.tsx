import { useState } from 'react'
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
    <section className={[phantomDesign.components.panel, 'relative flex flex-col overflow-hidden'].join(' ')}>
      <div className={phantomDesign.components.contentCardMuted}>
        <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-7 text-phantom-ink">Hivatalos Transzferár Jelentés</h2>
            <p className="mt-2 text-sm leading-6 text-phantom-muted">
              Generáljon 20+ oldalas, enterprise minőségű, 8 fejezetes TP megfelelőségi jelentést
              vezetői összefoglalóval, kockázati hőtérképpel, pénzügyi kitettség-becsléssel és teljes
              remediációs ütemtervvel.
            </p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className={phantomDesign.components.compactCard}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-phantom-subtle">Kimenet</p>
            <p className="mt-1 text-sm font-medium text-phantom-ink">Nyomtatható, Big4-szintű PDF</p>
          </div>
          <div className={phantomDesign.components.compactCard}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-phantom-subtle">Terjedelem</p>
            <p className="mt-1 text-sm font-medium text-phantom-ink">20-25 oldal (finding darabszámtól függően)</p>
          </div>
        </div>

        <div className={[phantomDesign.components.compactCard, 'mt-3'].join(' ')}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-phantom-subtle">Mit tartalmaz a jelentés</p>
          <ul className="mt-1.5 space-y-1 text-sm leading-5 text-phantom-muted">
            <li>• 00-08 fejezetes struktúra: címlap, tartalomjegyzék, executive summary, módszertan.</li>
            <li>• Kockázati mátrixok, NAV kitettségi számítás, részletes finding-oldalak (#1-től #N-ig).</li>
            <li>• 30/90/180 napos remediációs terv, jogi hivatkozásjegyzék és módszertani disclaimer.</li>
          </ul>
        </div>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={!isReady}
            onClick={() => setIsReportModalOpen(true)}
            className={[
              phantomDesign.components.buttonBase,
              'inline-flex h-9 w-full items-center justify-center px-3 text-sm sm:h-8 sm:w-auto sm:px-3 sm:text-xs',
              isReady
                ? phantomDesign.components.buttonPrimary
                : 'cursor-not-allowed border border-phantom-line bg-phantom-surface text-phantom-subtle',
            ].join(' ')}
          >
            Jelentés Generálása
          </button>

          <p className="inline-flex items-center gap-1.5 break-words text-[11px] text-phantom-subtle">
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
