import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { X, Scale } from 'lucide-react'
import { phantomDesign } from '../design-system/phantomDesign'
import type { CitationTarget } from '../types/viewer'
import { resolveLegalPdfUrl } from '../lib/legalDocs'
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

const HIGHLIGHT_CLASSES = [
  'phantom-highlight',
  'bg-yellow-200',
  'rounded',
  'outline-dashed',
  'outline-2',
  'outline-phantom-accent',
  'outline-offset-1',
] as const

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function highlightByQuote(spans: HTMLElement[], quote: string): boolean {
  const needle = normalizeForMatch(quote)
  if (needle.length < 3) return false

  // Build cumulative page text (normalized) and remember where each span lands.
  type SpanRange = { span: HTMLElement; start: number; end: number }
  const ranges: SpanRange[] = []
  let pageText = ''
  for (const span of spans) {
    const raw = span.textContent ?? ''
    const normalized = raw.toLowerCase().replace(/\s+/g, ' ')
    if (normalized.length === 0) continue
    const withSep = pageText.length > 0 && !pageText.endsWith(' ') ? ' ' + normalized : normalized
    const start = pageText.length
    pageText = pageText + withSep
    ranges.push({ span, start, end: pageText.length })
  }

  // Try the full needle, then a 60-char prefix as a fallback so partially split
  // quotes still light up something useful.
  const candidates = [needle]
  if (needle.length > 60) candidates.push(needle.slice(0, 60))

  for (const candidate of candidates) {
    const matchStart = pageText.indexOf(candidate)
    if (matchStart === -1) continue
    const matchEnd = matchStart + candidate.length
    let matched = false
    for (const range of ranges) {
      if (range.start < matchEnd && range.end > matchStart) {
        range.span.classList.add(...HIGHLIGHT_CLASSES)
        matched = true
      }
    }
    if (matched) return true
  }

  return false
}

function highlightByCharOffsets(
  spans: HTMLElement[],
  charStart: number,
  charEnd: number,
): boolean {
  let offset = 0
  let matched = false
  for (const span of spans) {
    const text = span.textContent ?? ''
    const spanEnd = offset + text.length
    if (offset < charEnd && spanEnd > charStart) {
      span.classList.add(...HIGHLIGHT_CLASSES)
      matched = true
    }
    offset = spanEnd
  }
  return matched
}

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

  pageContainer.querySelectorAll('.phantom-highlight').forEach((el) => {
    el.classList.remove(...HIGHLIGHT_CLASSES)
  })

  // Quote-based match is the primary path: the backend's char_start/char_end
  // are document-global, while the textLayer is per-page — so per-page char
  // offsets would only line up by accident on page 1. We try the quote first,
  // and only fall back to per-page char ranges when no quote is available.
  if (quote && highlightByQuote(spans, quote)) return

  if (charStart !== null && charEnd !== null) {
    highlightByCharOffsets(spans, charStart, charEnd)
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
  const legalPdfUrl = isLegal ? resolveLegalPdfUrl(citation.filename) : null
  // Show the text-only fallback panel when:
  //  - the citation is a .docx (no PDF render path yet), OR
  //  - the citation is legal but we don't have a mapped ruleset PDF for it.
  const showTextPanel = isDocx || (isLegal && legalPdfUrl === null)

  const pdfUrl = showTextPanel
    ? null
    : isLegal
      ? legalPdfUrl
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
    <div className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-phantom-ink bg-phantom-paper px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="tag-sticker hidden sm:inline-flex">
          DOKUMENTUM
        </span>
        <div className="min-w-0">
          <p className="font-display truncate text-sm font-extrabold text-phantom-ink">
            {citation.filename}
          </p>
          <p className="text-xs text-phantom-muted">Oldal {citation.page + 1}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Bezárás"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-phantom-control border-2 border-phantom-ink bg-phantom-surface text-phantom-ink shadow-phantom-sticker transition-transform duration-phantom-base hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus"
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
