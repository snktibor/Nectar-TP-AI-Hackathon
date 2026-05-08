import { phantomDesign } from '../design-system/phantomDesign'

interface HeaderProps {
  readonly sessionId: string
}

export default function Header({ sessionId }: HeaderProps): JSX.Element {
  return (
    <header className="sticky top-0 z-10 border-b border-phantom-line bg-phantom-surface/90 shadow-phantom-soft backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-5 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-lg font-black text-phantom-ink xs:text-xl">REDLINE</span>
            <span className="truncate text-lg font-black text-phantom-accent xs:text-xl">PHANTOM</span>
          </div>
          <div className="hidden h-5 w-px bg-phantom-line sm:block" />
          <span className="hidden truncate text-sm text-phantom-muted sm:block">
            Transfer Pricing Audit AI
          </span>
        </div>
        <div className="flex min-w-0 shrink items-center gap-2">
          <span className="hidden text-xs text-phantom-subtle xs:inline">Session</span>
          <span
            className={`${phantomDesign.components.tag} block max-w-[7.5rem] truncate sm:max-w-[13rem]`}
            title={sessionId}
          >
            {sessionId}
          </span>
        </div>
      </div>
    </header>
  )
}
