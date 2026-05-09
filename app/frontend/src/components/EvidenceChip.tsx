import type { BackendEvidenceChunk } from '../lib/backendAudit'

interface EvidenceChipProps {
  readonly chunk: BackendEvidenceChunk
  readonly isCrossDoc?: boolean
  readonly onClick?: () => void
}

export default function EvidenceChip({ chunk, isCrossDoc = false, onClick }: EvidenceChipProps): JSX.Element {
  const label = `${chunk.filename} · p${chunk.page} · #${chunk.chunk_index}`
  const tooltip = chunk.quote ?? label

  const colorClasses = isCrossDoc
    ? 'bg-phantom-cyan text-phantom-ink'
    : 'bg-phantom-paper text-phantom-ink'

  const interactiveClasses = onClick
    ? 'cursor-pointer hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus'
    : ''

  const inner = (
    <>
      <span className="max-w-[14ch] truncate">{chunk.filename}</span>
      <span className="shrink-0 opacity-60">·</span>
      <span className="shrink-0">p{chunk.page}</span>
      <span className="shrink-0 opacity-60">·</span>
      <span className="shrink-0">#{chunk.chunk_index}</span>
    </>
  )

  const baseClasses = [
    'inline-flex max-w-[22ch] items-center gap-1 rounded-full border-2 border-phantom-ink px-2 py-0.5',
    'font-display text-[11px] font-extrabold tracking-[0.06em] shadow-phantom-sticker transition-transform duration-phantom-base',
    colorClasses,
    interactiveClasses,
  ].join(' ')

  if (onClick) {
    return (
      <button type="button" title={tooltip} onClick={onClick} className={baseClasses}>
        {inner}
      </button>
    )
  }

  return (
    <span title={tooltip} className={baseClasses}>
      {inner}
    </span>
  )
}
