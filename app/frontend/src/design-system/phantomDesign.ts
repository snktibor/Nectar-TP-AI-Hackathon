import type { RiskSeverity } from '../types/api'

export const phantomDesign = {
  colors: {
    canvas: '#FAF6EE',
    surface: '#FFFFFF',
    surfaceMuted: '#F2EBDC',
    surfaceRaised: '#FFFFFF',
    ink: '#0A0A0A',
    inkMuted: '#2F2F2F',
    inkSubtle: 'rgba(10,10,10,0.6)',
    line: '#0A0A0A',
    lineStrong: '#0A0A0A',
    accent: '#C7F458',
    accentHover: '#B8E83F',
    accentSoft: '#E9F9B6',
    purple: '#5B2EE5',
    pink: '#FF3D8A',
    cyan: '#00D4FF',
    amber: '#FFB800',
    cream: '#FAF6EE',
    paper: '#F2EBDC',
  },
  severity: {
    CRITICAL: {
      label: 'Kritikus',
      tone: '#D32F2F',
      badge:
        'bg-phantom-severity-critical-soft text-phantom-severity-critical-text ring-1 ring-phantom-ink',
      text: 'text-phantom-severity-critical-text',
      border: 'border-l-phantom-severity-critical',
      icon: 'text-phantom-severity-critical-text',
    },
    HIGH: {
      label: 'Magas',
      tone: '#F57C00',
      badge:
        'bg-phantom-severity-high-soft text-phantom-severity-high-text ring-1 ring-phantom-ink',
      text: 'text-phantom-severity-high-text',
      border: 'border-l-phantom-severity-high',
      icon: 'text-phantom-severity-high-text',
    },
    MEDIUM: {
      label: 'Közepes',
      tone: '#FBC02D',
      badge:
        'bg-phantom-severity-medium-soft text-phantom-severity-medium-text ring-1 ring-phantom-ink',
      text: 'text-phantom-severity-medium-text',
      border: 'border-l-phantom-severity-medium',
      icon: 'text-phantom-severity-medium-text',
    },
    LOW: {
      label: 'Alacsony',
      tone: '#388E3C',
      badge:
        'bg-phantom-severity-low-soft text-phantom-severity-low-text ring-1 ring-phantom-ink',
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
    panel:
      'rounded-phantom-card border-2 border-phantom-ink bg-phantom-surface p-4 shadow-phantom-soft sm:p-5 lg:p-6',
    panelHeader: 'mb-4 space-y-1 sm:mb-5',
    panelTitle: 'font-display text-lg font-extrabold leading-7 tracking-tight text-phantom-ink',
    panelDescription: 'text-sm leading-5 text-phantom-muted',
    subtleCard:
      'rounded-phantom-card border-2 border-phantom-ink bg-phantom-surface-muted p-3 sm:p-4',
    statusPill:
      'inline-flex items-center rounded-full border-2 border-phantom-ink bg-phantom-surface px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.12em] shadow-phantom-sticker',
    metaPill:
      'inline-flex items-center rounded-full border-2 border-phantom-ink bg-phantom-surface px-2 py-0.5 text-xs font-bold text-phantom-ink shadow-phantom-sticker',
    tag:
      'inline-flex items-center rounded-phantom-control border-2 border-phantom-ink bg-phantom-surface px-1.5 py-0.5 font-mono text-xs text-phantom-ink shadow-phantom-sticker',
    buttonBase:
      'min-h-11 w-full rounded-phantom-control border-2 border-phantom-ink px-4 py-3 text-sm font-display font-extrabold transition-phantom duration-phantom-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phantom-surface disabled:cursor-not-allowed',
    buttonPrimary:
      'bg-phantom-accent text-phantom-ink shadow-phantom-button hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#0A0A0A] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_#0A0A0A] disabled:bg-phantom-disabled disabled:text-phantom-subtle disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0',
    uploadSlotBase:
      'flex min-h-16 w-full min-w-0 items-center gap-3 rounded-phantom-card border-2 border-dashed px-3 py-3 text-left transition-phantom duration-phantom-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phantom-surface sm:px-4',
    uploadSlotIdle:
      'border-phantom-ink bg-phantom-surface hover:bg-phantom-accent-soft hover:shadow-phantom-soft',
    uploadSlotUploaded:
      'border-phantom-ink bg-phantom-success-soft text-phantom-ink shadow-phantom-soft',
    uploadSlotDisabled:
      'cursor-not-allowed opacity-70 hover:translate-y-0 hover:shadow-none',
  },
  motion: {
    transition: 'transition-phantom duration-phantom-base ease-phantom-standard',
  },
} as const

export type PhantomSeverityConfig = (typeof phantomDesign.severity)[RiskSeverity]
