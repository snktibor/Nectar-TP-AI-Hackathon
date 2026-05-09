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
<<<<<<< HEAD
    <section className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md">
=======
    <section className="flex h-full min-h-0 flex-col gap-3 animate-phantom-fade-in">
      <button
        type="button"
        onClick={onClose}
        className="group inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition-phantom duration-phantom-base hover:-translate-y-px hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 hover:shadow-phantom-soft active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-phantom-base group-hover:-translate-x-1" />
        Vissza a globális nézethez
      </button>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md animate-phantom-scale-in">
>>>>>>> 3a8508588991892f7a5b814a4f47fe8bb0700865
        <DocumentViewer citation={previewCitation} onClose={onClose} />
      </div>
    </section>
  )
}
