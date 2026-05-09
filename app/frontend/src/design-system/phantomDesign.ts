import type { RiskSeverity } from '../types/api'

export const phantomDesign = {
  colors: {
    canvas: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceMuted: '#F8FAFC',
    surfaceRaised: '#FFFFFF',
    ink: '#0F172A',
    inkMuted: '#475569',
    inkSubtle: '#64748B',
    line: '#E5E7EB',
    lineStrong: '#CBD5E1',
    accent: '#FF7B47',
    accentHover: '#EF6E3A',
    accentSoft: '#FFE9DF',
    mint: '#FFF4ED',
    sky: '#F8FAFC',
    lavender: '#F0EFE8',
    amber: '#FFEFE4',
  },
  severity: {
    CRITICAL: {
      label: 'Kritikus',
      tone: '#D32F2F',
      badge: 'bg-phantom-severity-critical-soft text-phantom-severity-critical-text ring-phantom-severity-critical-border',
      text: 'text-phantom-severity-critical-text',
      border: 'border-l-phantom-severity-critical',
      icon: 'text-phantom-severity-critical-text',
    },
    HIGH: {
      label: 'Magas',
      tone: '#F57C00',
      badge: 'bg-phantom-severity-high-soft text-phantom-severity-high-text ring-phantom-severity-high-border',
      text: 'text-phantom-severity-high-text',
      border: 'border-l-phantom-severity-high',
      icon: 'text-phantom-severity-high-text',
    },
    MEDIUM: {
      label: 'Közepes',
      tone: '#FBC02D',
      badge: 'bg-phantom-severity-medium-soft text-phantom-severity-medium-text ring-phantom-severity-medium-border',
      text: 'text-phantom-severity-medium-text',
      border: 'border-l-phantom-severity-medium',
      icon: 'text-phantom-severity-medium-text',
    },
    LOW: {
      label: 'Alacsony',
      tone: '#388E3C',
      badge: 'bg-phantom-severity-low-soft text-phantom-severity-low-text ring-phantom-severity-low-border',
      text: 'text-phantom-severity-low-text',
      border: 'border-l-phantom-severity-low',
      icon: 'text-phantom-severity-low-text',
    },
  } satisfies Record<
    RiskSeverity,
    {
      label: string
      tone: string
      badge: string
      text: string
      border: string
      icon: string
    }
  >,
  layout: {
    page: 'min-h-screen overflow-x-hidden bg-phantom-canvas text-phantom-ink antialiased',
    container: 'w-full px-2 py-2 sm:px-3 sm:py-3 lg:px-4 lg:py-4',
    dashboardGrid: 'grid min-w-0 gap-4 lg:grid-cols-3 lg:gap-5 xl:gap-6',
  },
  components: {
    panel: 'h-full min-w-0 rounded-phantom-card border border-phantom-line bg-phantom-surface p-4 animate-phantom-fade-in transition-phantom duration-phantom-base hover:border-phantom-line-strong hover:shadow-phantom-soft sm:p-5 lg:p-6',
    scrollPanel: 'h-full min-w-0 overflow-y-auto overflow-x-hidden rounded-phantom-card border border-phantom-line bg-phantom-surface p-4 animate-phantom-fade-in transition-phantom duration-phantom-base hover:border-phantom-line-strong hover:shadow-phantom-soft [scrollbar-gutter:stable] sm:p-5 lg:p-6',
    panelHeaderBar:
      'mb-4 flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-phantom-control border border-phantom-line bg-phantom-surface-muted px-4 py-3 animate-phantom-fade-in-down transition-phantom duration-phantom-base hover:border-phantom-accent/25 hover:bg-phantom-accent-soft/20',
    contentCard: 'w-full rounded-phantom-card border border-phantom-line bg-phantom-surface p-5 animate-phantom-scale-in transition-phantom duration-phantom-base hover:-translate-y-px hover:border-phantom-accent/25 hover:shadow-phantom-soft sm:p-6',
    contentCardMuted: 'w-full rounded-phantom-card border border-phantom-line bg-phantom-surface-muted p-5 animate-phantom-scale-in transition-phantom duration-phantom-base hover:-translate-y-px hover:border-phantom-accent/25 hover:shadow-phantom-soft sm:p-6',
    compactCard: 'rounded-phantom-control border border-phantom-line bg-phantom-surface px-3 py-2.5 transition-phantom duration-phantom-base hover:-translate-y-px hover:border-phantom-accent/25 hover:bg-phantom-accent-soft/20',
    rowCard:
      'group flex items-center gap-3 rounded-phantom-control border border-phantom-line bg-phantom-surface p-3 transition-phantom duration-phantom-base hover:-translate-y-px hover:border-phantom-accent/40 hover:bg-phantom-accent-soft/30 hover:shadow-phantom-soft',
    iconBadge:
      'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-phantom-control border border-phantom-accent/20 bg-phantom-accent-soft text-phantom-accent',
    panelHeader: 'mb-4 space-y-1 sm:mb-5',
    panelTitle: 'text-base font-semibold leading-6 text-phantom-ink',
    panelDescription: 'text-sm leading-5 text-phantom-muted',
    subtleCard: 'rounded-phantom-card border border-phantom-line bg-phantom-surface-muted p-3 sm:p-4',
    statusPill: 'inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold leading-none whitespace-nowrap ring-1 ring-inset',
    metaPill: 'rounded-full bg-phantom-surface-muted px-2 py-0.5 text-xs font-medium text-phantom-muted ring-1 ring-phantom-line',
    tag: 'rounded-phantom-control bg-phantom-surface-muted px-1.5 py-0.5 font-mono text-xs text-phantom-muted ring-1 ring-phantom-line',
    analysisSubTabBase:
      'relative h-7 shrink-0 whitespace-nowrap rounded-phantom-control border px-3 text-xs font-medium transition-phantom duration-phantom-base hover:-translate-y-px hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 hover:shadow-phantom-soft active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-0',
    analysisSubTabActive:
      'border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 shadow-phantom-soft',
    analysisSubTabIdle:
      'border-blue-100 bg-blue-50/45 text-blue-700/85',
    buttonBase:
      'min-h-11 w-full rounded-phantom-control px-4 py-3 text-sm font-semibold transition-phantom duration-phantom-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phantom-surface disabled:cursor-not-allowed',
    buttonPrimary:
      'bg-phantom-accent text-phantom-canvas shadow-phantom-button hover:-translate-y-px hover:scale-[1.01] hover:bg-phantom-accent-hover hover:shadow-phantom-lift active:translate-y-0 active:scale-[0.99] active:bg-phantom-accent-pressed disabled:bg-phantom-disabled disabled:text-phantom-subtle disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:scale-100',
    uploadSlotBase:
      'flex min-h-16 w-full min-w-0 items-center gap-3 rounded-phantom-card border border-dashed px-3 py-3 text-left transition-phantom duration-phantom-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phantom-surface sm:px-4',
    uploadSlotIdle:
      'border-phantom-line bg-phantom-surface-muted hover:-translate-y-px hover:border-phantom-accent hover:bg-phantom-accent-soft hover:shadow-phantom-soft',
    uploadSlotUploaded:
      'border-phantom-success-border bg-phantom-success-soft text-phantom-success-text shadow-phantom-soft',
    uploadSlotDisabled: 'cursor-not-allowed opacity-70 hover:translate-y-0 hover:shadow-none',
  },
  motion: {
    transition: 'transition-phantom duration-phantom-base ease-phantom-standard',
  },
} as const

export type PhantomSeverityConfig = (typeof phantomDesign.severity)[RiskSeverity]