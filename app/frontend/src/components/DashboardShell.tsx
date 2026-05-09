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
        'flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-xl border px-3 py-2 text-left transition-colors duration-150',
        isActive
          ? 'border-orange-200 bg-orange-50'
          : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-slate-50',
      ].join(' ')}
    >
      <Icon
        className={[
          'h-4 w-4 shrink-0',
          isActive ? 'text-orange-600' : 'text-gray-400',
        ].join(' ')}
      />
      <span
        className={[
          'truncate text-sm font-medium',
          isActive ? 'text-orange-700' : 'text-gray-600',
        ].join(' ')}
      >
        {label}
      </span>
      {isActive ? (
        <>
          <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500" aria-hidden="true" />
          <span className="sr-only">Aktív</span>
        </>
      ) : null}
    </button>
  )
}

function SidebarProfileCard(): JSX.Element {
  return (
    <section className="rounded-xl border border-gray-100 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2.5">
        <img
          src="/favicon.ico"
          alt="Profilkep"
          className="h-8 w-8 object-contain"
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
  return (
    <aside className="flex flex-col justify-between border-b border-gray-100 bg-slate-50 p-3 sm:p-4 lg:min-h-screen lg:border-b-0 lg:border-r lg:p-5">
      <div className="space-y-4 px-1 py-1">
        <div className="pl-1">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-900">
            <span className="text-orange-600">REDLINE</span>{' '}
            <span>PHANTOM</span>
          </p>
        </div>

        <nav aria-label="Oldal menü" className="relative pl-3">
          <div className="pointer-events-none absolute bottom-1 left-0 top-1 w-px bg-gray-200" />

          <div className="space-y-1.5">
            <SidebarButton
              icon={LayoutDashboard}
              label="Elemzés"
              isActive={activeTab === 'analysis'}
              onClick={() => onTabChange('analysis')}
            />

            <SidebarButton
              icon={FileText}
              label="Dokumentumok"
              isActive={activeTab === 'documents'}
              onClick={() => onTabChange('documents')}
            />

            <SidebarButton
              icon={ShieldAlert}
              label="Riportok"
              isActive={activeTab === 'reports'}
              onClick={() => onTabChange('reports')}
            />
          </div>
        </nav>
      </div>

      <div className="space-y-2">
        <SidebarButton
          icon={Settings}
          label="Beállítások"
          isActive={false}
          onClick={() => {
            /* settings is local-state only, intentionally inert */
          }}
        />
        <SidebarProfileCard />
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
