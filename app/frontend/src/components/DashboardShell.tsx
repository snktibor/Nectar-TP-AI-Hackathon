import { useEffect, useState, type ReactNode } from 'react'
import {
  type LucideIcon,
  FileText,
  LayoutDashboard,
  Menu,
  X,
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

const NAV_ITEMS: ReadonlyArray<{ icon: LucideIcon; label: string; tab: DashboardTab }> = [
  { icon: FileText, label: 'Dokumentumok', tab: 'documents' },
  { icon: LayoutDashboard, label: 'Analízis', tab: 'analysis' },
  { icon: LayoutDashboard, label: 'Riport', tab: 'reports' },
]

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
        'group flex h-10 w-full min-w-0 items-center gap-2 overflow-hidden rounded-phantom-control border px-3 text-left transition-phantom duration-phantom-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus max-[359px]:h-9 max-[359px]:px-2.5',
        isActive
          ? 'border-phantom-accent/25 bg-phantom-accent-soft text-phantom-accent'
          : 'border-phantom-line bg-phantom-surface text-phantom-muted hover:border-phantom-accent/30 hover:bg-phantom-accent-soft/35 hover:text-phantom-accent',
      ].join(' ')}
    >
      <Icon
        className={[
          'h-4 w-4 shrink-0 transition-colors duration-phantom-base',
          isActive ? 'text-phantom-accent' : 'text-phantom-subtle group-hover:text-phantom-accent',
        ].join(' ')}
      />
      <span
        className={[
          'break-words text-sm font-medium leading-5 transition-colors duration-phantom-base max-[359px]:text-[13px]',
          isActive ? 'text-phantom-accent' : 'text-phantom-muted group-hover:text-phantom-accent',
        ].join(' ')}
      >
        {label}
      </span>
      {isActive ? (
        <>
          <span className="ml-auto mr-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-phantom-accent animate-phantom-pulse-dot" aria-hidden="true" />
          <span className="sr-only">Aktív</span>
        </>
      ) : null}
    </button>
  )
}

interface MinimalSidebarProps {
  readonly activeTab: DashboardTab
  readonly onTabChange: (tab: DashboardTab) => void
}

function MinimalSidebar({ activeTab, onTabChange }: MinimalSidebarProps): JSX.Element {
  return (
    <aside className="hidden flex-col border-r border-phantom-line bg-phantom-surface-muted p-4 animate-phantom-fade-in lg:flex lg:min-h-screen">
      <div className="space-y-6 px-1 py-1">
        <div className="pl-1 pt-1 animate-phantom-fade-in-down" style={{ animationDelay: '20ms' }}>
          <p className="cursor-default text-base font-semibold uppercase tracking-[0.08em] text-phantom-ink xl:text-[17px]">
            <span className="text-phantom-accent">Nectar</span>{' '}
            <span>TP</span>
          </p>
        </div>

        <nav aria-label="Oldal menü" className="relative pl-3 pt-2">
          <div className="pointer-events-none absolute bottom-1 left-0 top-1 w-px bg-phantom-line" />

          <div className="space-y-1.5">
            {NAV_ITEMS.map((item, index) => (
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
    </aside>
  )
}

interface MobileHeaderProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onOpen: () => void
}

interface MobileNavigationProps {
  readonly activeTab: DashboardTab
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onTabChange: (tab: DashboardTab) => void
}

function MobileHeader({
  isOpen,
  onClose,
  onOpen,
}: MobileHeaderProps): JSX.Element {
  return (
    <header className="flex h-[3.25rem] shrink-0 items-center justify-between gap-3 border-b border-phantom-line bg-phantom-surface px-2.5 xs:h-14 xs:px-3 lg:hidden">
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold uppercase tracking-[0.06em] text-phantom-ink xs:text-base">
          <span className="text-phantom-accent">Nectar</span> TP
        </p>
      </div>

      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="mobile-dashboard-menu"
        aria-label={isOpen ? 'Mobil menü bezárása' : 'Mobil menü megnyitása'}
        onClick={isOpen ? onClose : onOpen}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-phantom-control border border-phantom-line bg-phantom-surface-muted text-phantom-ink transition-phantom duration-phantom-base hover:border-phantom-accent/30 hover:bg-phantom-accent-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus xs:h-10 xs:w-10"
      >
        <Menu className="h-5 w-5" />
      </button>
    </header>
  )
}

function MobileMenuDrawer({
  activeTab,
  isOpen,
  onClose,
  onTabChange,
}: MobileNavigationProps): JSX.Element | null {
  if (!isOpen) return null

  function handleTabClick(tab: DashboardTab): void {
    onTabChange(tab)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 h-dvh overflow-hidden lg:hidden" aria-label="Oldal menü">
      <button
        type="button"
        aria-label="Mobil menü bezárása"
        className="absolute inset-0 bg-phantom-ink/45 backdrop-blur-sm"
        onClick={onClose}
      />

      <section
        id="mobile-dashboard-menu"
        className="absolute bottom-0 left-0 top-0 flex h-dvh w-[min(18rem,calc(100vw-2rem))] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden border-r border-phantom-line bg-phantom-surface animate-phantom-slide-in-right xs:w-[min(19rem,calc(100vw-2.5rem))] xs:max-w-[calc(100vw-2rem)]"
      >
        <div className="sticky top-0 z-10 flex min-h-[4.25rem] items-center justify-between gap-3 border-b border-phantom-line bg-phantom-surface px-4 py-4 xs:px-5">
          <div className="min-w-0">
            <p className="break-words text-base font-semibold uppercase tracking-[0.06em] text-phantom-ink xs:text-lg">
              <span className="text-phantom-accent">Nectar</span> TP
            </p>
          </div>
          <button
            type="button"
            aria-label="Mobil menü bezárása"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-phantom-control border border-phantom-line bg-phantom-surface-muted text-phantom-muted transition-phantom duration-phantom-base hover:border-phantom-accent/30 hover:text-phantom-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="min-h-0 flex flex-1 flex-col">
          <div className="phantom-scrollbar-invisible min-h-0 flex-1 overflow-y-auto px-3 py-3 xs:px-4 xs:py-4">
            <nav aria-label="Mobil oldal menü" className="mt-2 space-y-1.5">
              {NAV_ITEMS.map((item) => (
                <SidebarButton
                  key={item.tab}
                  icon={item.icon}
                  label={item.label}
                  isActive={activeTab === item.tab}
                  onClick={() => handleTabClick(item.tab)}
                />
              ))}
            </nav>
          </div>
        </div>
      </section>
    </div>
  )
}

export default function DashboardShell({
  activeTab,
  onTabChange,
  leftPanel,
  rightPanel,
}: DashboardShellProps): JSX.Element {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined

    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false)
      }
    }

    globalThis.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousDocumentOverflow
      globalThis.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobileMenuOpen])

  function openMobileMenu(): void {
    setIsMobileMenuOpen(true)
  }

  function closeMobileMenu(): void {
    setIsMobileMenuOpen(false)
  }

  return (
    <div className="h-full w-full min-w-0 bg-phantom-canvas">
      <div className="flex h-full min-h-0 min-w-0 flex-col lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <MobileHeader
          isOpen={isMobileMenuOpen}
          onClose={closeMobileMenu}
          onOpen={openMobileMenu}
        />
        <MobileMenuDrawer
          activeTab={activeTab}
          isOpen={isMobileMenuOpen}
          onClose={closeMobileMenu}
          onTabChange={onTabChange}
        />
        <MinimalSidebar activeTab={activeTab} onTabChange={onTabChange} />

        <div className={[phantomDesign.layout.container, 'grid min-h-0 min-w-0 flex-1 gap-3 overflow-x-hidden overflow-y-auto lg:h-full lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:overflow-hidden'].join(' ')}>
          <div className="phantom-scrollbar-invisible min-h-[calc(100svh-5rem)] min-w-0 overflow-x-hidden overflow-y-auto lg:min-h-0">
            {leftPanel}
          </div>
          <div className="phantom-scrollbar-invisible min-h-[calc(100svh-5rem)] min-w-0 overflow-x-hidden overflow-y-auto lg:min-h-0">
            {rightPanel}
          </div>
        </div>
      </div>
    </div>
  )
}
