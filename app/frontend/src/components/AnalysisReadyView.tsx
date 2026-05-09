import { FileUp, Loader2, Sparkles } from 'lucide-react'
import type {
  BackendAuditStatusResponse,
  WorkspacePhase,
} from '../lib/backendAudit'
import { formatStageLabel } from '../lib/backendAudit'
import AnalyticsDashboard from './AnalyticsDashboard'

interface AnalysisReadyViewProps {
  readonly phase: WorkspacePhase
  readonly auditStatus: BackendAuditStatusResponse | null
  readonly auditError: string | null
  readonly onAnalyze: () => void
}

const RADIUS = 88
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function CircularGauge({ percent }: Readonly<{ percent: number }>): JSX.Element {
  const clamped = Math.max(0, Math.min(100, percent))
  const dashOffset = CIRCUMFERENCE * (1 - clamped / 100)

  return (
    <svg
      viewBox="0 0 200 200"
      className="h-56 w-56"
      role="img"
      aria-label={`${Math.round(clamped)} százalékos készültség`}
    >
      <circle
        cx="100"
        cy="100"
        r={RADIUS}
        stroke="rgb(243 244 246)"
        strokeWidth="14"
        fill="none"
      />
      <circle
        cx="100"
        cy="100"
        r={RADIUS}
        stroke="url(#gauge-orange)"
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 100 100)"
        style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
      />
      <defs>
        <linearGradient id="gauge-orange" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#fb923c" />
        </linearGradient>
      </defs>
      <text
        x="100"
        y="98"
        textAnchor="middle"
        className="fill-gray-900"
        style={{ fontSize: 38, fontWeight: 700 }}
      >
        {Math.round(clamped)}%
      </text>
      <text
        x="100"
        y="124"
        textAnchor="middle"
        className="fill-gray-500"
        style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.04em' }}
      >
        KÉSZÜLTSÉG
      </text>
    </svg>
  )
}

export default function AnalysisReadyView({
  phase,
  auditStatus,
  auditError,
  onAnalyze,
}: AnalysisReadyViewProps): JSX.Element {
  const isRunning = phase === 'starting' || phase === 'polling'
  const isCompleted = phase === 'completed'
  const isFailed = phase === 'failed'
  const isReady = phase === 'ready'

  // ---------------------------------------------------------------------------
  // State 3: Audit completed — replace gauge with the AnalyticsDashboard.
  // ---------------------------------------------------------------------------
  if (isCompleted) {
    return (
      <section className="flex h-full min-h-0 flex-col overflow-y-auto rounded-2xl border border-gray-100 bg-white p-6 shadow-md animate-phantom-fade-in [scrollbar-gutter:stable] sm:p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 animate-phantom-fade-in-down">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <Sparkles className="h-3.5 w-3.5" />
                Audit kész
              </span>
            </div>
            <h2 className="mt-2 text-xl font-semibold text-gray-900">Elemzési Áttekintés</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Multi-ágens audit eredmények — befektetői szintű kockázati áttekintés.
            </p>
          </div>
        </header>

        <div className="animate-phantom-fade-in-up">
          <AnalyticsDashboard />
        </div>
      </section>
    )
  }

  // ---------------------------------------------------------------------------
  // States 1 & 2: Idle/Ready or Running — keep the circular gauge layout.
  // ---------------------------------------------------------------------------
  const gaugePercent = (() => {
    if (isRunning && auditStatus) return Math.max(5, Math.min(99, auditStatus.progress))
    if (isReady) return 100
    return 0
  })()

  const headline = (() => {
    if (isRunning) return auditStatus ? formatStageLabel(auditStatus.stage) : 'Audit indítás'
    if (isFailed) return 'Audit hiba'
    if (isReady) return 'Auditálásra kész'
    return 'Töltsd fel a dokumentumokat'
  })()

  const subline = (() => {
    if (isRunning) return 'Az ügynökök elemzik a dokumentumcsomagot…'
    if (isFailed) return auditError ?? 'Ismeretlen hiba történt.'
    if (isReady) return 'Mind az 5 kötelező kategória osztályozva. Indítsd a beolvasást.'
    return 'Az audithoz pontosan 5 osztályozott dokumentum szükséges.'
  })()

  return (
    <section className="flex h-full min-h-0 flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-8 shadow-md animate-phantom-fade-in">
      <div className="flex flex-col items-center gap-6 text-center animate-phantom-fade-in">
        <div className={isRunning ? 'animate-phantom-pulse-soft' : 'animate-phantom-bounce-in'}>
          <CircularGauge percent={gaugePercent} />
        </div>

        <div key={headline} className="space-y-1 animate-phantom-fade-in-up">
          <h2 className="text-xl font-semibold text-gray-900">{headline}</h2>
          <p className="max-w-sm text-sm leading-6 text-gray-500">{subline}</p>
        </div>

        <button
          type="button"
          onClick={onAnalyze}
          disabled={!isReady}
          className={[
            'group/start mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white',
            'bg-gradient-to-r from-orange-500 to-orange-400 shadow-lg shadow-orange-500/30',
            'transition-all duration-200 ease-out',
            'hover:from-orange-600 hover:to-orange-500 hover:shadow-orange-500/40 hover:-translate-y-0.5 hover:scale-[1.03]',
            'active:translate-y-0 active:scale-95 active:shadow-orange-500/20',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:scale-100',
            isRunning ? 'animate-phantom-progress-glow' : '',
          ].join(' ')}
        >
          {isRunning ? (
            <>
              <Loader2 className="force-spin h-4 w-4 animate-spin" />
              AI Elemzés folyamatban...
            </>
          ) : (
            <>
              <FileUp className="h-4 w-4 transition-transform duration-phantom-base group-hover/start:-translate-y-0.5 group-hover/start:scale-110" />
              Beolvasás indítása
            </>
          )}
        </button>

        {isRunning && auditStatus && (
          <div className="w-full max-w-sm animate-phantom-fade-in-up">
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="phantom-progress-stripes h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400 transition-[width] duration-700 ease-out"
                style={{ width: `${Math.max(0, Math.min(100, auditStatus.progress))}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-gray-500 tabular-nums">
              {Math.round(auditStatus.progress)}%
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
