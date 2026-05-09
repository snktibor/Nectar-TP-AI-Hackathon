import { type ReactNode } from 'react'
import {
  type LucideIcon,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldAlert,
} from 'lucide-react'

export type DashboardTab = 'analysis' | 'documents' | 'reports'

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
        'group flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-xl border px-3 py-2 text-left transition-phantom duration-phantom-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus active:scale-[0.98]',
        isActive
          ? 'border-orange-200 bg-orange-50 shadow-phantom-soft'
          : 'border-gray-100 bg-white hover:-translate-y-px hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-phantom-soft',
      ].join(' ')}
    >
      <Icon
        className={[
          'h-4 w-4 shrink-0 transition-transform duration-phantom-base group-hover:scale-110',
          isActive ? 'text-orange-600' : 'text-gray-400 group-hover:text-orange-500',
        ].join(' ')}
      />
      <span
        className={[
          'truncate text-sm font-medium transition-colors duration-phantom-base',
          isActive ? 'text-orange-700' : 'text-gray-600 group-hover:text-orange-700',
        ].join(' ')}
      >
        {label}
      </span>
      {isActive ? (
        <>
          <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500 animate-phantom-pulse-dot" aria-hidden="true" />
          <span className="sr-only">Aktív</span>
        </>
      ) : null}
    </button>
  )
}

function SidebarProfileCard(): JSX.Element {
  return (
    <section className="group rounded-xl border border-gray-100 bg-white px-3 py-2 shadow-sm transition-phantom duration-phantom-base hover:-translate-y-px hover:border-orange-200 hover:shadow-phantom-soft">
      <div className="flex items-center gap-2.5">
        <img
          src="/favicon.ico"
          alt="Profilkep"
          className="h-8 w-8 object-contain transition-transform duration-phantom-base group-hover:scale-110 group-hover:rotate-6"
          loading="lazy"
        />
        <div className="min-w-0">
          <p className="text-[11px] leading-4 text-gray-400">Profil</p>
          <p className="truncate text-sm font-semibold leading-5 text-gray-900">Hajdú Patrik</p>
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
    { icon: LayoutDashboard, label: 'Elemzés', tab: 'analysis' },
    { icon: FileText, label: 'Dokumentumok', tab: 'documents' },
    { icon: ShieldAlert, label: 'Riportok', tab: 'reports' },
  ]
  return (
    <aside className="flex flex-col justify-between border-b border-gray-100 bg-slate-50 p-3 animate-phantom-fade-in sm:p-4 lg:min-h-screen lg:border-b-0 lg:border-r lg:p-5">
      <div className="space-y-4 px-1 py-1">
        <div className="pl-1 animate-phantom-fade-in-down" style={{ animationDelay: '20ms' }}>
          <p className="group cursor-default text-sm font-semibold uppercase tracking-[0.08em] text-gray-900 transition-all duration-phantom-base hover:tracking-[0.12em]">
            <span className="text-orange-600 transition-colors duration-phantom-base group-hover:text-orange-500">REDLINE</span>{' '}
            <span className="transition-colors duration-phantom-base group-hover:text-orange-700">PHANTOM</span>
          </p>
        </div>

        <nav aria-label="Oldal menü" className="relative pl-3">
          <div className="pointer-events-none absolute bottom-1 left-0 top-1 w-px bg-gray-200" />

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
          <SidebarButton
            icon={Settings}
            label="Beállítások"
            isActive={false}
            onClick={() => {
              /* settings is local-state only, intentionally inert */
            }}
          />
        </div>
        <div className="animate-phantom-fade-in-up" style={{ animationDelay: '380ms' }}>
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
    <div className="h-full w-full bg-white">
      <div className="grid h-full min-h-0 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <MinimalSidebar activeTab={activeTab} onTabChange={onTabChange} />

        <div className="grid h-full min-h-0 gap-3 p-2 sm:p-3 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:p-4">
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
