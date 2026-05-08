export default function Header(): JSX.Element {
  return (
    <header className="sticky top-0 z-10 border-b border-phantom-line bg-phantom-surface/90 shadow-phantom-soft backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-3 py-3 sm:px-5 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-lg font-black text-phantom-ink xs:text-xl">REDLINE</span>
            <span className="truncate text-lg font-black text-phantom-accent xs:text-xl">PHANTOM</span>
          </div>
        </div>
      </div>
    </header>
  )
}
