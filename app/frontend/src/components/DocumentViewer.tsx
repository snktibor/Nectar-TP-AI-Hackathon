import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { X, Scale } from 'lucide-react'
import { phantomDesign } from '../design-system/phantomDesign'
import type { CitationTarget } from '../types/viewer'
import { EmptyPanel } from './ui/DashboardPrimitives'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

interface DocumentViewerProps {
  readonly citation: CitationTarget
  readonly onClose: () => void
}

// ---------------------------------------------------------------------------
// LegalTextPanel — shown for source_kind="legal" or .docx files
// ---------------------------------------------------------------------------

function LegalTextPanel({ citation }: Readonly<{ citation: CitationTarget }>): JSX.Element {
  return (
    <div className="space-y-3 p-4">
      <div className={phantomDesign.components.subtleCard}>
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 shrink-0 text-phantom-accent" />
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-phantom-subtle">
            Jogi hivatkozás
          </p>
        </div>
        <p className="mt-2 text-sm font-medium text-phantom-ink">{citation.filename}</p>
        <p className="mt-0.5 text-xs text-phantom-subtle">Oldal: {citation.page}</p>
        {citation.quote ? (
          <blockquote className="mt-3 border-l-2 border-phantom-accent pl-3 text-sm italic text-phantom-muted leading-relaxed">
            {citation.quote}
          </blockquote>
        ) : (
          <p className="mt-2 text-xs text-phantom-subtle">Nincs elérhető idézet.</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Highlight helpers for text layer
// ---------------------------------------------------------------------------

function applyHighlight(
  pageContainer: HTMLElement,
  charStart: number | null,
  charEnd: number | null,
  quote: string | null,
): void {
  const textLayer = pageContainer.querySelector('.react-pdf__Page__textContent')
  if (!textLayer) return

  const spans = Array.from(textLayer.querySelectorAll<HTMLElement>('span[role="presentation"], span'))
  if (spans.length === 0) return

  // Remove previous highlights
  pageContainer.querySelectorAll('.phantom-highlight').forEach((el) => {
    el.classList.remove('phantom-highlight', 'bg-yellow-200', 'rounded')
  })

  if (charStart !== null && charEnd !== null) {
    // Char-offset based highlight
    let offset = 0
    for (const span of spans) {
      const text = span.textContent ?? ''
      const spanEnd = offset + text.length
      if (offset < charEnd && spanEnd > charStart) {
        span.classList.add('phantom-highlight', 'bg-yellow-200', 'rounded')
      }
      offset = spanEnd
    }
    return
  }

  // Fallback: fuzzy quote match
  if (!quote) return
  const normalised = quote.toLowerCase().trim()
  for (const span of spans) {
    const text = (span.textContent ?? '').toLowerCase()
    if (text.length > 0 && normalised.includes(text)) {
      span.classList.add('phantom-highlight', 'bg-yellow-200', 'rounded')
    }
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DocumentViewer({ citation, onClose }: DocumentViewerProps): JSX.Element {
  const [numPages, setNumPages] = useState<number>(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pageRendered, setPageRendered] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)

  const isDocx = citation.filename.toLowerCase().endsWith('.docx')
  const isLegal = citation.sourceKind === 'legal'
  const showTextPanel = isLegal || isDocx

  const pdfUrl = showTextPanel
    ? null
    : `${API_BASE}/api/v1/documents/${encodeURIComponent(citation.sessionId)}/file/${encodeURIComponent(citation.filename)}`

  // 1-based page for react-pdf
  const pageNumber = citation.page + 1

  useEffect(() => {
    setLoadError(null)
    setPageRendered(false)
  }, [citation])

  useEffect(() => {
    if (!pageRendered || !pageRef.current) return
    requestAnimationFrame(() => {
      if (pageRef.current) {
        applyHighlight(pageRef.current, citation.charStart, citation.charEnd, citation.quote)
      }
    })
  }, [pageRendered, citation])

  if (showTextPanel) {
    return (
      <section
        className={[
          phantomDesign.components.panel,
          'flex h-full flex-col gap-0 !p-0 overflow-hidden',
        ].join(' ')}
      >
        <ViewerHeader citation={citation} onClose={onClose} />
        <div className="min-h-0 flex-1 overflow-auto">
          <LegalTextPanel citation={citation} />
        </div>
      </section>
    )
  }

  return (
    <section
      className={[
        phantomDesign.components.panel,
        'flex h-full flex-col gap-0 !p-0 overflow-hidden',
      ].join(' ')}
    >
      <ViewerHeader citation={citation} onClose={onClose} />

      <div className="min-h-0 flex-1 overflow-auto">
        {loadError ? (
          <div className="p-4">
            <EmptyPanel
              icon={X}
              title="Betöltési hiba"
              description={loadError}
            />
          </div>
        ) : (
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={(err) => setLoadError(err.message)}
            loading={<LoadingSpinner />}
            error={<div className="p-4 text-sm text-phantom-muted">Nem sikerült betölteni a fájlt.</div>}
          >
            {numPages > 0 && pageNumber <= numPages && (
              <div ref={pageRef}>
                <Page
                  pageNumber={pageNumber}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                  width={undefined}
                  onRenderSuccess={() => setPageRendered(true)}
                />
              </div>
            )}
            {numPages > 0 && pageNumber > numPages && (
              <p className="p-4 text-xs text-phantom-muted">
                A {pageNumber}. oldal nem található (összesen: {numPages}).
              </p>
            )}
          </Document>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ViewerHeader({
  citation,
  onClose,
}: Readonly<{ citation: CitationTarget; onClose: () => void }>): JSX.Element {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-phantom-line px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-phantom-ink">{citation.filename}</p>
        <p className="text-xs text-phantom-subtle">Oldal {citation.page + 1}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Bezárás"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-phantom-control text-phantom-muted transition-phantom hover:bg-phantom-surface-muted hover:text-phantom-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-accent"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function LoadingSpinner(): JSX.Element {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-phantom-accent border-t-transparent" />
    </div>
  )
}
