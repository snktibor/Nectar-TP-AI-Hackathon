import { FileUp, Loader2 } from 'lucide-react'
import type {
  BackendAuditStatusResponse,
  WorkspacePhase,
} from '../lib/backendAudit'
import { formatStageLabel } from '../lib/backendAudit'

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

  const gaugePercent = (() => {
    if (isCompleted) return 100
    if (isRunning && auditStatus) return Math.max(5, Math.min(99, auditStatus.progress))
    if (isReady) return 100
    return 0
  })()

  const headline = (() => {
    if (isCompleted) return 'Audit kész'
    if (isRunning) return auditStatus ? formatStageLabel(auditStatus.stage) : 'Audit indítás'
    if (isFailed) return 'Audit hiba'
    if (isReady) return 'Auditálásra kész'
    return 'Töltsd fel a dokumentumokat'
  })()

  const subline = (() => {
    if (isCompleted) return 'Nyisd meg a Dokumentumok fület a fájlonkénti megállapításokhoz.'
    if (isRunning) return 'Az ügynökök elemzik a dokumentumcsomagot…'
    if (isFailed) return auditError ?? 'Ismeretlen hiba történt.'
    if (isReady) return 'Mind az 5 kötelező kategória osztályozva. Indítsd a beolvasást.'
    return 'Az audithoz pontosan 5 osztályozott dokumentum szükséges.'
  })()

  return (
    <section className="flex h-full min-h-0 flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-8 shadow-md">
      <div className="flex flex-col items-center gap-6 text-center">
        <CircularGauge percent={gaugePercent} />

        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-gray-900">{headline}</h2>
          <p className="max-w-sm text-sm leading-6 text-gray-500">{subline}</p>
        </div>

        <button
          type="button"
          onClick={onAnalyze}
          disabled={!isReady}
          className={[
            'mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white',
            'bg-gradient-to-r from-orange-500 to-orange-400 shadow-lg shadow-orange-500/30',
            'transition-all duration-200 ease-out',
            'hover:from-orange-600 hover:to-orange-500 hover:shadow-orange-500/40 hover:-translate-y-0.5',
            'active:translate-y-0 active:shadow-orange-500/20',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0',
          ].join(' ')}
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              AI Elemzés folyamatban...
            </>
          ) : (
            <>
              <FileUp className="h-4 w-4" />
              Beolvasás indítása
            </>
          )}
        </button>

        {isRunning && auditStatus && (
          <div className="w-full max-w-sm">
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500 ease-out"
                style={{ width: `${Math.max(0, Math.min(100, auditStatus.progress))}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-gray-500">
              {Math.round(auditStatus.progress)}%
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
