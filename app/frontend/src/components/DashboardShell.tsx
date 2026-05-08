import type { ReactNode } from 'react'

interface DashboardShellProps {
  readonly leftPanel: ReactNode
  readonly rightPanel: ReactNode
  readonly loadedDocuments: number
}

function SidebarProfileCard(): JSX.Element {
  return (
    <section className="rounded-phantom-card border border-phantom-line bg-phantom-surface p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <img
          src="/profile-placeholder.svg"
          alt="Profilkep"
          className="h-11 w-11 rounded-full object-cover ring-1 ring-phantom-line"
          loading="lazy"
        />
        <div className="min-w-0">
          <p className="text-xs text-phantom-subtle">Profil</p>
          <p className="truncate text-sm font-semibold text-phantom-ink">Hajdú Patrik</p>
        </div>
      </div>
    </section>
  )
}

function MinimalSidebar({ loadedDocuments }: { readonly loadedDocuments: number }): JSX.Element {
  return (
    <aside className="flex flex-col justify-between border-b border-phantom-line/70 bg-phantom-surface-muted/80 p-3 sm:p-4 lg:min-h-screen lg:border-b-0 lg:border-r lg:p-5">
      <div className="rounded-phantom-control border border-phantom-line bg-phantom-surface px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-phantom-ink">
          REDLINE PHANTOM
        </p>
        {loadedDocuments > 0 ? (
          <p className="mt-1 text-xs text-phantom-muted">
            {loadedDocuments} dokumentum betöltve
          </p>
        ) : null}
      </div>

      <SidebarProfileCard />
    </aside>
  )
}

export default function DashboardShell({
  leftPanel,
  rightPanel,
  loadedDocuments,
}: DashboardShellProps): JSX.Element {
  return (
    <div className="h-full w-full bg-phantom-surface">
      <div className="grid h-full min-h-0 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <MinimalSidebar loadedDocuments={loadedDocuments} />

        <div className="grid h-full min-h-0 gap-3 p-2 sm:p-3 lg:grid-cols-2 lg:p-4">
          <div className="min-h-0 min-w-0 overflow-auto">{leftPanel}</div>
          <div className="min-h-0 min-w-0 overflow-auto">{rightPanel}</div>
        </div>
      </div>
    </div>
  )
}
