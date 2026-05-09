import { AlertCircle, BarChart2, ClipboardList, Cpu, DatabaseZap, Sparkles } from 'lucide-react'
import { buildExecutiveStats, formatCompactForint } from '../lib/analysisInsights'
import type { BackendAuditReport, WorkspacePhase } from '../lib/backendAudit'

interface AnalysisReadyViewProps {
  readonly phase: WorkspacePhase
  readonly report: BackendAuditReport | null
  readonly successfulDocumentCount: number
}

export default function AnalysisReadyView({
  phase,
  report,
  successfulDocumentCount,
}: AnalysisReadyViewProps): JSX.Element {
  if (phase === 'completed' && report) {
    const stats = buildExecutiveStats(report, successfulDocumentCount)
    const tiles = [
      {
        icon: AlertCircle,
        label: 'Becsült NAV-kitettség',
        hint: 'Súlyosság + diszkrepancia alapú becslés',
        value: formatCompactForint(stats.estimatedNavExposureFt),
        tone: 'border-phantom-severity-critical-border bg-phantom-severity-critical-soft text-phantom-severity-critical-text',
      },
      {
        icon: ClipboardList,
        label: 'Összes megállapítás',
        hint: 'Konzisztencia + benchmark + teljesség',
        value: stats.totalFindings.toLocaleString('hu-HU'),
        tone: 'border-phantom-line bg-phantom-surface-muted text-phantom-ink',
      },
      {
        icon: BarChart2,
        label: 'IQR feletti eltérés',
        hint: 'Legnagyobb benchmark túllépés',
        value:
          stats.benchmarkOvershootPercent === null
            ? '0,0%'
            : `+${stats.benchmarkOvershootPercent.toFixed(1).replace('.', ',')}%`,
        tone: 'border-phantom-severity-high-border bg-phantom-severity-high-soft text-phantom-severity-high-text',
      },
      {
        icon: AlertCircle,
        label: 'Kritikus finding',
        hint: 'Azonnali beavatkozást igényel',
        value: stats.criticalCount.toLocaleString('hu-HU'),
        tone: 'border-phantom-severity-critical-border bg-phantom-severity-critical-soft text-phantom-severity-critical-text',
      },
      {
        icon: Cpu,
        label: 'Sikeres ágens futás',
        hint: 'Lefutott ügynökök aránya',
        value: `${stats.successfulAgentRuns}/${stats.totalAgentRuns}`,
        tone: 'border-phantom-severity-low-border bg-phantom-severity-low-soft text-phantom-severity-low-text',
      },
      {
        icon: DatabaseZap,
        label: 'Vizsgált dokumentumok',
        hint: 'Kötelező kategóriák lefedettsége',
        value: `${stats.successfulDocumentCount}/5`,
        tone: 'border-phantom-accent/20 bg-phantom-accent-soft text-phantom-accent',
      },
    ]

    return (
      <section className="flex h-full min-h-0 flex-col rounded-2xl border border-gray-100 bg-white p-8 animate-phantom-fade-in">
        <div className="w-full rounded-2xl border border-phantom-line bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-phantom-accent/20 bg-phantom-accent-soft text-phantom-accent">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-gray-900">Analízis eredmény összefoglaló</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                A kulcs mutatók valós auditadatokból számolva, vezetői áttekintéshez.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {tiles.map((tile) => {
              const Icon = tile.icon
              return (
                <article
                  key={tile.label}
                  className={[
                    'rounded-phantom-control border px-3 py-2.5',
                    tile.tone,
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.05em] opacity-90">{tile.label}</p>
                      <p className="mt-0.5 break-words text-[11px] opacity-80">{tile.hint}</p>
                    </div>
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-phantom-control border border-white/60 bg-white/70">
                      <Icon className="h-4 w-4 opacity-80" />
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    {tile.value}
                  </p>
                </article>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="flex h-full min-h-0 flex-col items-start justify-start rounded-2xl border border-gray-100 bg-white p-8 animate-phantom-fade-in">
      <div className="w-full rounded-2xl border border-phantom-line bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-phantom-accent/20 bg-phantom-accent-soft text-phantom-accent">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-gray-900">Analízis után elérhető</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Ez a funkció az analízis elkészítése után válik elérhetővé.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
