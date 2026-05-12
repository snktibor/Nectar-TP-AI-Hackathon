import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CheckCircle2, Circle, LoaderCircle } from 'lucide-react'
import { phantomDesign } from '../../design-system/phantomDesign'

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
type StepState = 'done' | 'active' | 'pending'

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-phantom-surface-muted text-phantom-muted ring-phantom-line',
  accent: 'bg-phantom-accent-soft text-phantom-accent ring-phantom-accent/20',
  success: 'bg-phantom-success-soft text-phantom-success-text ring-phantom-success-border',
  warning: 'bg-phantom-severity-medium-soft text-phantom-severity-medium-text ring-phantom-severity-medium-border',
  danger: 'bg-phantom-danger-soft text-phantom-danger-text ring-phantom-danger-border',
  info: 'bg-phantom-surface-muted text-phantom-muted ring-phantom-line',
}

const metricIconClasses: Record<Tone, string> = {
  neutral: 'bg-phantom-surface text-phantom-muted ring-phantom-line',
  accent: 'bg-phantom-accent-soft text-phantom-accent ring-phantom-accent/20',
  success: 'bg-phantom-success-soft text-phantom-success-text ring-phantom-success-border',
  warning: 'bg-phantom-severity-medium-soft text-phantom-severity-medium-text ring-phantom-severity-medium-border',
  danger: 'bg-phantom-danger-soft text-phantom-danger-text ring-phantom-danger-border',
  info: 'bg-phantom-surface-muted text-phantom-muted ring-phantom-line',
}

const stepClasses: Record<StepState, string> = {
  done: 'border-phantom-success-border bg-phantom-success-soft text-phantom-success-text',
  active: 'border-phantom-accent bg-phantom-accent-soft text-phantom-accent',
  pending: 'border-phantom-line bg-phantom-surface-muted text-phantom-subtle',
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
    <div className="mb-5 flex flex-col gap-3 animate-phantom-fade-in-down sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-phantom-accent">
            {eyebrow}
          </p>
        ) : null}
        <h2 className={phantomDesign.components.panelTitle}>{title}</h2>
        {description ? (
          <p className={phantomDesign.components.panelDescription}>{description}</p>
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
        'inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold leading-none whitespace-nowrap ring-1 ring-inset max-[359px]:h-6 max-[359px]:px-2 max-[359px]:text-[11px]',
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
    <div className="group min-w-0 rounded-phantom-control border border-phantom-line bg-phantom-surface p-3 transition-phantom duration-phantom-base animate-phantom-fade-in-up hover:border-phantom-line-strong hover:bg-phantom-accent-soft/15 max-[359px]:p-2.5 sm:p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            title={label}
            className="break-words text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-phantom-subtle"
          >
            {label}
          </p>
          <p className="mt-2 break-words text-xl font-semibold leading-7 text-phantom-ink max-[359px]:text-lg max-[359px]:leading-6 sm:text-2xl sm:leading-8">{value}</p>
        </div>
        <div
          className={[
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-phantom-control ring-1 ring-inset max-[359px]:h-8 max-[359px]:w-8',
            metricIconClasses[tone],
          ].join(' ')}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {detail ? <p className="mt-3 break-words text-sm leading-5 text-phantom-muted">{detail}</p> : null}
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
    <div className="flex min-h-[13rem] flex-col items-center justify-center rounded-phantom-card border border-dashed border-phantom-line bg-phantom-surface-muted p-6 text-center animate-phantom-fade-in">
      <div className="flex h-12 w-12 items-center justify-center rounded-phantom-control bg-phantom-surface text-phantom-accent ring-1 ring-phantom-line animate-phantom-bounce-in">
        <Icon className="h-7 w-7 animate-phantom-pulse-soft" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-phantom-ink">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-phantom-muted">{description}</p>
      {children ? <div className="mt-5 w-full max-w-xl">{children}</div> : null}
    </div>
  )
}

export function WorkflowTimeline({ steps }: { readonly steps: TimelineStep[] }): JSX.Element {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {steps.map((step, index) => {
        let Icon: LucideIcon = Circle
        if (step.state === 'done') {
          Icon = CheckCircle2
        } else if (step.state === 'active') {
          Icon = LoaderCircle
        }
        const iconClass = step.state === 'active' ? 'force-spin h-4 w-4 animate-spin' : 'h-4 w-4'

        return (
          <div
            key={step.title}
            style={{ animationDelay: `${index * 80}ms` }}
            className={[
              'rounded-phantom-card border p-3 transition-phantom duration-phantom-base animate-phantom-fade-in-up hover:border-phantom-line-strong max-[359px]:p-2.5',
              stepClasses[step.state],
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <Icon className={iconClass} />
              <p className="text-sm font-semibold">{step.title}</p>
            </div>
            <p className="mt-1 text-xs leading-5 opacity-80">{step.description}</p>
          </div>
        )
      })}
    </div>
  )
}