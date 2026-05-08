import type { RiskSeverity } from '../types/api'

export const phantomDesign = {
  colors: {
    canvas: '#F4F3EE',
    surface: '#FFFFFF',
    surfaceMuted: '#EEEDE6',
    surfaceRaised: '#FFFFFF',
    ink: '#111812',
    inkMuted: '#2F362F',
    inkSubtle: '#5C655B',
    line: '#D9D8CF',
    lineStrong: '#C7C6BD',
    accent: '#FF7B47',
    accentHover: '#EF6E3A',
    accentSoft: '#FFE9DF',
    mint: '#FFF4ED',
    sky: '#F7F6F1',
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
    panel: 'rounded-phantom-card border border-phantom-line bg-phantom-surface p-4 shadow-phantom-soft sm:p-5 lg:p-6',
    panelHeader: 'mb-4 space-y-1 sm:mb-5',
    panelTitle: 'text-base font-semibold leading-6 text-phantom-ink',
    panelDescription: 'text-sm leading-5 text-phantom-muted',
    subtleCard: 'rounded-phantom-card border border-phantom-line bg-phantom-surface-muted p-3 sm:p-4',
    statusPill: 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold leading-5 ring-1 ring-inset',
    metaPill: 'rounded-full bg-phantom-surface-muted px-2 py-0.5 text-xs font-medium text-phantom-muted ring-1 ring-phantom-line',
    tag: 'rounded-phantom-control bg-phantom-surface-muted px-1.5 py-0.5 font-mono text-xs text-phantom-muted ring-1 ring-phantom-line',
    buttonBase:
      'min-h-11 w-full rounded-phantom-control px-4 py-3 text-sm font-semibold transition-phantom duration-phantom-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phantom-surface disabled:cursor-not-allowed',
    buttonPrimary:
      'bg-phantom-accent text-phantom-ink shadow-phantom-button hover:-translate-y-px hover:bg-phantom-accent-hover hover:shadow-phantom-lift active:translate-y-0 active:bg-phantom-accent-pressed disabled:bg-phantom-disabled disabled:text-phantom-subtle disabled:shadow-none disabled:hover:translate-y-0',
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