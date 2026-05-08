import { useState, type ReactNode } from 'react'
import {
  type LucideIcon,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldAlert,
} from 'lucide-react'

interface DashboardShellProps {
  readonly leftPanel: ReactNode
  readonly rightPanel: ReactNode
}

type SidebarItem = 'analysis' | 'documents' | 'reports' | 'settings'

interface SidebarButtonProps {
  readonly icon: LucideIcon
  readonly label: string
  readonly isActive: boolean
  readonly onClick: () => void
}

function SidebarButton({
  icon: Icon,
  label,
  isActive,
  onClick,
}: SidebarButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-phantom-control border px-3 py-2 text-left transition-phantom duration-phantom-base',
        isActive
          ? 'border-phantom-accent/30 bg-phantom-accent-soft'
          : 'border-phantom-line bg-phantom-surface hover:border-phantom-line hover:bg-phantom-surface-muted',
      ].join(' ')}
    >
      <Icon
        className={[
          'h-4 w-4 shrink-0',
          isActive ? 'text-phantom-accent' : 'text-phantom-subtle',
        ].join(' ')}
      />
      <span
        className={[
          'truncate text-sm font-medium',
          isActive ? 'text-phantom-accent' : 'text-phantom-muted',
        ].join(' ')}
      >
        {label}
      </span>
      {isActive ? (
        <>
          <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-phantom-accent" aria-hidden="true" />
          <span className="sr-only">Aktív</span>
        </>
      ) : null}
    </button>
  )
}

function SidebarProfileCard(): JSX.Element {
  return (
    <section className="rounded-phantom-card border border-phantom-line bg-phantom-surface px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2.5">
        <img
          src="/favicon.ico"
          alt="Profilkep"
          className="h-8 w-8 object-contain"
          loading="lazy"
        />
        <div className="min-w-0">
          <p className="text-[11px] leading-4 text-phantom-subtle">Profil</p>
          <p className="truncate text-sm font-semibold leading-5 text-phantom-ink">Hajdú Patrik</p>
        </div>
      </div>
    </section>
  )
}

function MinimalSidebar(): JSX.Element {
  const [activeItem, setActiveItem] = useState<SidebarItem>('analysis')

  return (
    <aside className="flex flex-col justify-between border-b border-phantom-line/70 bg-phantom-surface-muted/80 p-3 sm:p-4 lg:min-h-screen lg:border-b-0 lg:border-r lg:p-5">
      <div className="space-y-4 px-1 py-1">
        <div className="pl-1">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-phantom-ink">
            <span className="text-phantom-accent">REDLINE</span>{' '}
            <span>PHANTOM</span>
          </p>
        </div>

        <nav aria-label="Oldal menü" className="relative pl-3">
          <div className="pointer-events-none absolute bottom-1 left-0 top-1 w-px bg-phantom-line" />

          <div className="space-y-1.5">
            <SidebarButton
              icon={LayoutDashboard}
              label="Elemzés"
              isActive={activeItem === 'analysis'}
              onClick={() => setActiveItem('analysis')}
            />

            <SidebarButton
              icon={FileText}
              label="Dokumentumok"
              isActive={activeItem === 'documents'}
              onClick={() => setActiveItem('documents')}
            />

            <SidebarButton
              icon={ShieldAlert}
              label="Riportok"
              isActive={activeItem === 'reports'}
              onClick={() => setActiveItem('reports')}
            />
          </div>
        </nav>
      </div>

      <div className="space-y-2">
        <SidebarButton
          icon={Settings}
          label="Beállítások"
          isActive={activeItem === 'settings'}
          onClick={() => setActiveItem('settings')}
        />
        <SidebarProfileCard />
      </div>
    </aside>
  )
}

export default function DashboardShell({
  leftPanel,
  rightPanel,
}: DashboardShellProps): JSX.Element {
  return (
    <div className="h-full w-full bg-phantom-surface">
      <div className="grid h-full min-h-0 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <MinimalSidebar />

        <div className="grid h-full min-h-0 gap-3 p-2 sm:p-3 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:p-4">
          <div className="min-h-0 min-w-0 overflow-auto">{leftPanel}</div>
          <div className="min-h-0 min-w-0 overflow-auto">{rightPanel}</div>
        </div>
      </div>
    </div>
  )
}
