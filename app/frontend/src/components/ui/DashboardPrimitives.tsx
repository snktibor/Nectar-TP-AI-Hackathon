import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CheckCircle2, Circle, LoaderCircle } from 'lucide-react'

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
type StepState = 'done' | 'active' | 'pending'

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-phantom-surface text-phantom-ink',
  accent: 'bg-phantom-accent-soft text-phantom-ink',
  success: 'bg-phantom-success-soft text-phantom-ink',
  warning: 'bg-phantom-amber text-phantom-ink',
  danger: 'bg-phantom-pink text-phantom-ink',
  info: 'bg-phantom-cyan text-phantom-ink',
}

const metricIconClasses: Record<Tone, string> = {
  neutral: 'bg-phantom-surface text-phantom-ink',
  accent: 'bg-phantom-accent-soft text-phantom-ink',
  success: 'bg-phantom-success-soft text-phantom-ink',
  warning: 'bg-phantom-amber text-phantom-ink',
  danger: 'bg-phantom-pink text-phantom-ink',
  info: 'bg-phantom-cyan text-phantom-ink',
}

const stepClasses: Record<StepState, string> = {
  done: 'border-2 border-phantom-ink bg-phantom-cyan text-phantom-ink shadow-phantom-sticker',
  active: 'border-2 border-phantom-ink bg-phantom-paper text-phantom-ink shadow-phantom-sticker',
  pending: 'border-2 border-phantom-ink bg-phantom-surface text-phantom-ink/70',
}

interface SectionHeaderProps {
  readonly eyebrow?: string
  readonly title: string
  readonly description?: string
  readonly action?: ReactNode
}

interface StatusPillProps {
  readonly tone?: Tone
  readonly children: ReactNode
}

interface MetricCardProps {
  readonly label: string
  readonly value: string | number
  readonly detail?: string
  readonly icon: LucideIcon
  readonly tone?: Tone
}

interface EmptyPanelProps {
  readonly icon: LucideIcon
  readonly title: string
  readonly description: string
  readonly children?: ReactNode
}

export interface TimelineStep {
  readonly title: string
  readonly description: string
  readonly state: StepState
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: SectionHeaderProps): JSX.Element {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-phantom-card border-2 border-phantom-ink bg-phantom-paper p-4 shadow-phantom-sticker sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <span className="tag-sticker">
            {eyebrow}
          </span>
        ) : null}
        <h2 className="font-display text-xl font-black leading-tight tracking-tight text-phantom-ink">
          {title}
        </h2>
        {description ? (
          <p className="text-sm leading-5 text-phantom-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function StatusPill({ tone = 'neutral', children }: StatusPillProps): JSX.Element {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border-2 border-phantom-ink px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.12em] shadow-phantom-sticker',
        toneClasses[tone],
      ].join(' ')}
    >
      {children}
    </span>
  )
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
}: MetricCardProps): JSX.Element {
  return (
    <div className="min-w-0 rounded-phantom-card border-2 border-phantom-ink bg-phantom-surface p-4 shadow-phantom-soft transition-transform duration-phantom-base hover:-translate-y-0.5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-[11px] font-extrabold uppercase tracking-[0.18em] text-phantom-muted">
            {label}
          </p>
          <p className="font-display mt-2 break-words text-3xl font-black leading-none tracking-tight text-phantom-ink sm:text-4xl">
            {value}
          </p>
        </div>
        <div
          className={[
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-phantom-control border-2 border-phantom-ink shadow-phantom-sticker',
            metricIconClasses[tone],
          ].join(' ')}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {detail ? (
        <p className="mt-3 break-words text-sm leading-5 text-phantom-muted">{detail}</p>
      ) : null}
    </div>
  )
}

export function EmptyPanel({
  icon: Icon,
  title,
  description,
  children,
}: EmptyPanelProps): JSX.Element {
  return (
    <div className="flex min-h-[26rem] flex-col items-center justify-center rounded-phantom-card border-2 border-dashed border-phantom-ink bg-phantom-surface-muted p-8 text-center shadow-phantom-soft">
      <div className="flex h-16 w-16 items-center justify-center rounded-phantom-card border-2 border-phantom-ink bg-phantom-paper text-phantom-ink shadow-phantom-sticker">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="font-display mt-5 text-2xl font-black tracking-tight text-phantom-ink">
        {title}
      </h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-phantom-muted">{description}</p>
      {children ? <div className="mt-5 w-full max-w-xl">{children}</div> : null}
    </div>
  )
}

export function WorkflowTimeline({ steps }: { readonly steps: TimelineStep[] }): JSX.Element {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {steps.map((step) => {
        const Icon =
          step.state === 'done' ? CheckCircle2 : step.state === 'active' ? LoaderCircle : Circle
        const iconClass =
          step.state === 'active' ? 'force-spin h-4 w-4 animate-spin' : 'h-4 w-4'

        return (
          <div
            key={step.title}
            className={[
              'rounded-phantom-card p-3 transition-phantom duration-phantom-base',
              stepClasses[step.state],
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <Icon className={iconClass} />
              <p className="font-display text-sm font-extrabold">{step.title}</p>
            </div>
            <p className="mt-1 text-xs leading-5 opacity-80">{step.description}</p>
          </div>
        )
      })}
    </div>
  )
}
