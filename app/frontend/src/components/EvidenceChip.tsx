import type { BackendEvidenceChunk } from '../lib/backendAudit'
import { formatEvidencePage } from '../lib/citations'

interface EvidenceChipProps {
  readonly chunk: BackendEvidenceChunk
  readonly isCrossDoc?: boolean
  readonly onClick?: () => void
}

function displayFilename(filename: string): string {
  const normalizedPath = filename.trim().replace(/\\/g, '/')
  return normalizedPath.split('/').pop() ?? normalizedPath
}

export default function EvidenceChip({ chunk, isCrossDoc = false, onClick }: EvidenceChipProps): JSX.Element {
  const pageLabel = formatEvidencePage(chunk.page)
  const filename = displayFilename(chunk.filename)
  const label = `${filename} · ${pageLabel} · #${chunk.chunk_index}`
  const tooltip = chunk.quote ?? label

  const colorClasses = isCrossDoc
    ? 'bg-phantom-accent-soft text-phantom-accent ring-phantom-accent/30'
    : 'bg-phantom-surface-muted text-phantom-muted ring-phantom-line'

  const interactiveClasses = onClick
    ? 'cursor-pointer transition-phantom duration-phantom-base hover:bg-phantom-accent-soft/65 hover:ring-phantom-accent hover:text-phantom-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-accent'
    : 'transition-phantom duration-phantom-base'

  const inner = (
    <>
      <span className="break-all">{filename}</span>
      <span className="shrink-0 opacity-60">·</span>
      <span className="shrink-0">{pageLabel}</span>
      <span className="shrink-0 opacity-60">·</span>
      <span className="shrink-0">#{chunk.chunk_index}</span>
    </>
  )

  const baseClasses = [
    'inline-flex max-w-full flex-wrap items-center gap-1 rounded-phantom-control px-2 py-0.5 text-left',
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
