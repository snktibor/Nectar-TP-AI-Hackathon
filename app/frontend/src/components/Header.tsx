interface HeaderProps {
  sessionId: string
}

export default function Header({ sessionId }: HeaderProps): JSX.Element {
  return (
    <header className="sticky top-0 z-10 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-xl font-black tracking-tight text-gray-900">REDLINE</span>
            <span className="text-xl font-black tracking-tight text-orange-500">PHANTOM</span>
          </div>
          <div className="hidden h-5 w-px bg-gray-200 sm:block" />
          <span className="hidden text-sm text-gray-500 sm:block">Transfer Pricing Audit AI</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Session</span>
          <span className="max-w-[120px] truncate font-mono text-xs text-gray-400 sm:max-w-[200px]">
            {sessionId}
          </span>
        </div>
      </div>
    </header>
  )
}
