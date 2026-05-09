import { useState, type ReactNode } from 'react'
import {
  type LucideIcon,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  Sparkles,
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
        'flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-phantom-control border-2 px-3 py-2 text-left font-display font-extrabold transition-phantom duration-phantom-base',
        isActive
          ? 'border-phantom-ink bg-phantom-paper text-phantom-ink shadow-phantom-sticker'
          : 'border-phantom-ink bg-phantom-surface text-phantom-ink hover:bg-phantom-paper hover:shadow-phantom-sticker',
      ].join(' ')}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate text-sm">{label}</span>
      {isActive ? (
        <>
          <span className="pulse-dot ml-auto" aria-hidden="true" />
          <span className="sr-only">Aktív</span>
        </>
      ) : null}
    </button>
  )
}

function SidebarProfileCard(): JSX.Element {
  return (
    <section className="rounded-phantom-card border-2 border-phantom-ink bg-phantom-surface px-3 py-2 shadow-phantom-sticker">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-phantom-control border-2 border-phantom-ink bg-phantom-cyan">
          <span className="font-display text-sm font-black text-phantom-ink">HP</span>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-phantom-muted">
            Profil
          </p>
          <p className="font-display truncate text-sm font-black leading-5 text-phantom-ink">
            Hajdú Patrik
          </p>
        </div>
      </div>
    </section>
  )
}

function BrandSticker(): JSX.Element {
  return (
    <div className="space-y-2 pl-1">
      <span className="tag-sticker bg-phantom-pink text-white">
        <Sparkles className="h-3 w-3" />
        TP AUDITOR
      </span>
      <p className="font-display text-xl font-black leading-tight tracking-tight text-phantom-ink">
        REDLINE
        <br />
        <span className="scribble-underline">PHANTOM</span>
      </p>
    </div>
  )
}

function MinimalSidebar(): JSX.Element {
  const [activeItem, setActiveItem] = useState<SidebarItem>('analysis')

  return (
    <aside className="flex flex-col justify-between border-b-2 border-phantom-ink bg-phantom-paper p-3 sm:p-4 lg:min-h-screen lg:border-b-0 lg:border-r-2 lg:p-5">
      <div className="space-y-5 px-1 py-1">
        <BrandSticker />

        <nav aria-label="Oldal menü" className="relative">
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
    <div className="h-full w-full bg-phantom-canvas">
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
