import { type ReactNode } from 'react'
import {
  type LucideIcon,
  FileText,
  LayoutDashboard,
} from 'lucide-react'
import { phantomDesign } from '../design-system/phantomDesign'

export type DashboardTab = 'analysis' | 'reports' | 'documents'

interface DashboardShellProps {
  readonly activeTab: DashboardTab
  readonly onTabChange: (tab: DashboardTab) => void
  readonly leftPanel: ReactNode
  readonly rightPanel: ReactNode
}

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
        'group flex h-10 w-full min-w-0 items-center gap-2 overflow-hidden rounded-phantom-control border px-3 text-left transition-phantom duration-phantom-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus active:scale-[0.98]',
        isActive
          ? 'border-phantom-accent/25 bg-phantom-accent-soft text-phantom-accent shadow-phantom-soft'
          : 'border-phantom-line bg-phantom-surface text-phantom-muted hover:-translate-y-px hover:border-phantom-accent/30 hover:bg-phantom-accent-soft/40 hover:text-phantom-accent hover:shadow-phantom-soft',
      ].join(' ')}
    >
      <Icon
        className={[
          'h-4 w-4 shrink-0 transition-transform duration-phantom-base group-hover:scale-110',
          isActive ? 'text-phantom-accent' : 'text-phantom-subtle group-hover:text-phantom-accent',
        ].join(' ')}
      />
      <span
        className={[
          'truncate text-sm font-medium transition-colors duration-phantom-base',
          isActive ? 'text-phantom-accent' : 'text-phantom-muted group-hover:text-phantom-accent',
        ].join(' ')}
      >
        {label}
      </span>
      {isActive ? (
        <>
          <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-phantom-accent animate-phantom-pulse-dot" aria-hidden="true" />
          <span className="sr-only">Aktív</span>
        </>
      ) : null}
    </button>
  )
}

function SidebarProfileCard(): JSX.Element {
  return (
    <section className="group rounded-phantom-control border border-phantom-line bg-phantom-surface px-3 py-2 transition-phantom duration-phantom-base hover:-translate-y-px hover:border-phantom-accent/30 hover:bg-phantom-accent-soft/30 hover:shadow-phantom-soft">
      <div className="flex items-center gap-2.5">
        <img
          src="/favicon.ico"
          alt="Profilkep"
          className="h-8 w-8 object-contain transition-transform duration-phantom-base group-hover:scale-110 group-hover:rotate-6"
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

interface MinimalSidebarProps {
  readonly activeTab: DashboardTab
  readonly onTabChange: (tab: DashboardTab) => void
}

function MinimalSidebar({ activeTab, onTabChange }: MinimalSidebarProps): JSX.Element {
  const navItems: ReadonlyArray<{ icon: LucideIcon; label: string; tab: DashboardTab }> = [
    { icon: FileText, label: 'Dokumentumok', tab: 'documents' },
    { icon: LayoutDashboard, label: 'Analízis', tab: 'analysis' },
    { icon: LayoutDashboard, label: 'Riport', tab: 'reports' },
  ]
  return (
    <aside className="flex flex-col justify-between border-b border-phantom-line bg-phantom-surface-muted p-3 animate-phantom-fade-in sm:p-4 lg:min-h-screen lg:border-b-0 lg:border-r">
      <div className="space-y-4 px-1 py-1">
        <div className="pl-1 animate-phantom-fade-in-down" style={{ animationDelay: '20ms' }}>
          <p className="cursor-default text-sm font-semibold uppercase tracking-[0.08em] text-phantom-ink">
            <span className="text-phantom-accent">Nectar</span>{' '}
            <span>TP</span>
          </p>
        </div>

        <nav aria-label="Oldal menü" className="relative pl-3">
          <div className="pointer-events-none absolute bottom-1 left-0 top-1 w-px bg-phantom-line" />

          <div className="space-y-1.5">
            {navItems.map((item, index) => (
              <div
                key={item.tab}
                style={{ animationDelay: `${80 + index * 70}ms` }}
                className="animate-phantom-slide-in-right"
              >
                <SidebarButton
                  icon={item.icon}
                  label={item.label}
                  isActive={activeTab === item.tab}
                  onClick={() => onTabChange(item.tab)}
                />
              </div>
            ))}
          </div>
        </nav>
      </div>

      <div className="space-y-2">
        <div className="animate-phantom-fade-in-up" style={{ animationDelay: '320ms' }}>
          <SidebarProfileCard />
        </div>
      </div>
    </aside>
  )
}

export default function DashboardShell({
  activeTab,
  onTabChange,
  leftPanel,
  rightPanel,
}: DashboardShellProps): JSX.Element {
  return (
    <div className="h-full w-full bg-phantom-canvas">
      <div className="grid h-full min-h-0 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <MinimalSidebar activeTab={activeTab} onTabChange={onTabChange} />

        <div className={[phantomDesign.layout.container, 'grid h-full min-h-0 gap-3 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]'].join(' ')}>
          <div className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]">
            {leftPanel}
          </div>
          <div className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]">
            {rightPanel}
          </div>
        </div>
      </div>
    </div>
  )
}
