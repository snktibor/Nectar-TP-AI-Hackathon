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
    ? 'bg-phantom-accent-soft text-phantom-accent ring-phantom-accent/30'
    : 'bg-phantom-surface-muted text-phantom-muted ring-phantom-line'

  const interactiveClasses = onClick
    ? 'cursor-pointer hover:ring-phantom-accent hover:text-phantom-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-accent'
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
    'inline-flex max-w-[22ch] items-center gap-1 rounded-phantom-control px-2 py-0.5',
    'text-[11px] font-medium ring-1 ring-inset',
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
