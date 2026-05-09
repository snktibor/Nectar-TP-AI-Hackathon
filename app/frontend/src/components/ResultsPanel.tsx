import type { CitationTarget } from '../types/viewer'
import DocumentViewer from './DocumentViewer'

interface ResultsPanelProps {
  readonly selectedDocId: string
  readonly sessionId: string
  readonly activeCitation: CitationTarget | null
  readonly onClose: () => void
}

export default function ResultsPanel({
  selectedDocId,
  sessionId,
  activeCitation,
  onClose,
}: ResultsPanelProps): JSX.Element {
  const previewCitation: CitationTarget =
    activeCitation !== null &&
    (activeCitation.sourceKind === 'legal' || activeCitation.filename === selectedDocId)
      ? activeCitation
      : {
          sessionId,
          filename: selectedDocId,
          page: 0,
          charStart: null,
          charEnd: null,
          sourceKind: 'document',
          quote: null,
        }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <DocumentViewer citation={previewCitation} onClose={onClose} />
      </div>
    </section>
  )
}
