import { AlertOctagon, CheckCircle2, Target, Timer } from 'lucide-react'

interface RiskBadge {
  readonly label: string
  readonly tone: string
}

const RISK_BADGES: readonly RiskBadge[] = [
  { label: 'Funkcionális Elemzés Ellentmondás', tone: 'bg-red-100 text-red-800' },
  { label: 'Berry-ráta (1.19 > IQR 1.10)', tone: 'bg-red-100 text-red-800' },
  { label: 'Hiányzó DEMPE Elemzés', tone: 'bg-orange-100 text-orange-800' },
  { label: 'Számlázási Dátum Eltérés', tone: 'bg-gray-100 text-gray-800' },
]

interface SeverityChip {
  readonly count: number
  readonly label: string
  readonly tone: string
}

const SEVERITY_CHIPS: readonly SeverityChip[] = [
  { count: 4, label: 'Kritikus', tone: 'bg-red-100 text-red-800' },
  { count: 2, label: 'Magas', tone: 'bg-orange-100 text-orange-800' },
  { count: 2, label: 'Közepes', tone: 'bg-amber-100 text-amber-800' },
]

function CardShell({
  icon,
  title,
  children,
}: Readonly<{
  icon: JSX.Element
  title: string
  children: React.ReactNode
}>): JSX.Element {
  return (
    <article className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <header className="mb-4 flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </header>
      <div className="flex-1">{children}</div>
    </article>
  )
}

function FinancialRiskCard(): JSX.Element {
  return (
    <CardShell
      icon={<AlertOctagon className="h-5 w-5 text-red-600" />}
      title="Kritikus Adókockázat & Bírságpotenciál"
    >
      <p className="text-4xl font-bold text-red-600 animate-pulse tabular-nums">
        ~18 500 000 Ft
      </p>
      <p className="mt-3 text-xs leading-5 text-gray-600">
        A 5M Ft-os licencdíj-eltérés és az érvénytelen Berry-ráta (1.19) miatti adóalap-korrekció
        50%-os bírsággal kalkulálva.
      </p>
    </CardShell>
  )
}

function AuditSynthesisCard(): JSX.Element {
  return (
    <CardShell
      icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
      title="Multi-Ágens Futási Eredmény"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold text-gray-900 tabular-nums">9</span>
        <span className="text-lg font-semibold text-gray-700">Megállapítás</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SEVERITY_CHIPS.map((chip) => (
          <span
            key={chip.label}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${chip.tone}`}
          >
            <span className="tabular-nums">{chip.count}</span>
            <span>{chip.label}</span>
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-gray-600">
        6/6 ágens sikeresen lefutott. 5 konzisztencia hiba, 1 benchmark kockázat és 3 teljességi
        hiányosság azonosítva a dokumentumokban.
      </p>
    </CardShell>
  )
}

function ComparisonBar({
  label,
  value,
  width,
  variant,
}: Readonly<{
  label: string
  value: string
  width: string
  variant: 'baseline' | 'phantom'
}>): JSX.Element {
  const barColor = variant === 'phantom' ? 'bg-orange-500' : 'bg-gray-300'
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-semibold text-gray-900 tabular-nums">{value}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${barColor}`} style={{ width }} />
      </div>
    </div>
  )
}

function CognitiveSavingsCard(): JSX.Element {
  return (
    <CardShell
      icon={<Timer className="h-5 w-5 text-orange-500" />}
      title="Audit Időszükséglet Összehasonlítás"
    >
      <div className="space-y-3">
        <ComparisonBar
          label="Hagyományos (Szenior Tanácsadó)"
          value="16 munkaóra"
          width="100%"
          variant="baseline"
        />
        <ComparisonBar
          label="Redline Phantom AI"
          value="10 perc"
          width="10%"
          variant="phantom"
        />
      </div>
      <p className="mt-4 text-xs leading-5 text-gray-600">
        Automatizált 3-irányú ellenőrzés (Szerződés vs. Számla vs. Local File).
      </p>
    </CardShell>
  )
}

function SemanticHeatmapCard(): JSX.Element {
  return (
    <CardShell
      icon={<Target className="h-5 w-5 text-red-600" />}
      title="Azonosított Kockázati Zónák"
    >
      <div className="flex flex-wrap gap-2">
        {RISK_BADGES.map((badge) => (
          <span
            key={badge.label}
            className={`rounded-full px-3 py-1 text-sm font-medium ${badge.tone}`}
          >
            {badge.label}
          </span>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-gray-600">
        Súlyosság szerint rangsorolt, ágens-attribúcióval ellátott kockázati zónák.
      </p>
    </CardShell>
  )
}

export default function AnalyticsDashboard(): JSX.Element {
  return (
    <section
      aria-label="Analitikai irányítópult"
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
    >
      <FinancialRiskCard />
      <AuditSynthesisCard />
      <CognitiveSavingsCard />
      <SemanticHeatmapCard />
    </section>
  )
}
