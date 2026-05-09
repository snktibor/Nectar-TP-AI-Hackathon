import { useCallback, useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { X, Scale } from 'lucide-react'
import { phantomDesign } from '../design-system/phantomDesign'
import type { CitationTarget } from '../types/viewer'
import { resolveLegalPdfUrl } from '../lib/legalDocs'

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
// Highlight helpers
// ---------------------------------------------------------------------------

// Marker class for cleanup — actual color is applied via inline style
// so we get a precise cursor-selection look without Tailwind purge concerns.
const HIGHLIGHT_MARKER = 'phantom-highlight'
const HIGHLIGHT_BG = 'rgba(251, 146, 60, 0.42)'
const QUOTE_STOPWORDS = new Set([
  'hogy',
  'és',
  'az',
  'egy',
  'mint',
  'vagy',
  'ennek',
  'azzal',
  'jelen',
  'szerint',
  'alapján',
  'with',
  'from',
  'this',
  'that',
  'for',
])

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function extractQuoteKeywords(quote: string): string[] {
  const normalized = quote
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^0-9a-záéíóöőúüű%.,\- ]/gi, ' ')
    .trim()

  if (!normalized) return []

  const tokens = normalized
    .split(' ')
    .map((token) => token.replace(/^[,.-]+|[,.-]+$/g, '').trim())
    .filter(Boolean)
    .filter((token) => {
      const hasDigit = /\d/.test(token)
      if (hasDigit) return true
      if (token.length < 6) return false
      return !QUOTE_STOPWORDS.has(token)
    })

  return [...new Set(tokens)].sort((a, b) => b.length - a.length).slice(0, 8)
}

function markSpan(span: HTMLElement): void {
  span.classList.add(HIGHLIGHT_MARKER)
  span.style.backgroundColor = HIGHLIGHT_BG
  span.style.borderRadius = '2px'
}

function highlightByQuote(spans: HTMLElement[], quote: string): boolean {
  const needle = normalizeText(quote)
  if (needle.length < 3) return false

  type SpanRange = { span: HTMLElement; start: number; end: number }
  const ranges: SpanRange[] = []
  let pageText = ''

  for (const span of spans) {
    const raw = span.textContent ?? ''
    const norm = raw.toLowerCase().replace(/\s+/g, ' ')
    if (norm.length === 0) continue
    const sep = pageText.length > 0 && !pageText.endsWith(' ') ? ' ' : ''
    const start = pageText.length + sep.length
    pageText = pageText + sep + norm
    ranges.push({ span, start, end: pageText.length })
  }

  // Try full quote first, then a 60-char prefix as fallback for long quotes
  // that may be split across text chunks differently on screen.
  const candidates = [needle]
  if (needle.length > 60) candidates.push(needle.slice(0, 60))

  for (const candidate of candidates) {
    const matchStart = pageText.indexOf(candidate)
    if (matchStart === -1) continue
    const matchEnd = matchStart + candidate.length
    let matched = false
    for (const range of ranges) {
      if (range.start < matchEnd && range.end > matchStart) {
        markSpan(range.span)
        matched = true
      }
    }
    if (matched) return true
  }

  return false
}

function highlightByKeywordWindow(spans: HTMLElement[], quote: string): boolean {
  const keywords = extractQuoteKeywords(quote)
  if (keywords.length === 0) return false

  let firstMatchIndex = -1
  for (let i = 0; i < spans.length; i += 1) {
    const spanText = normalizeText(spans[i].textContent ?? '')
    if (!spanText) continue

    if (keywords.some((keyword) => spanText.includes(keyword))) {
      firstMatchIndex = i
      break
    }
  }

  if (firstMatchIndex === -1) return false

  const start = Math.max(0, firstMatchIndex - 2)
  const end = Math.min(spans.length - 1, firstMatchIndex + 8)
  for (let i = start; i <= end; i += 1) {
    markSpan(spans[i])
  }

  return true
}

function highlightByCharOffsets(spans: HTMLElement[], charStart: number, charEnd: number): boolean {
  let offset = 0
  let matched = false
  for (const span of spans) {
    const text = span.textContent ?? ''
    const spanEnd = offset + text.length
    if (offset < charEnd && spanEnd > charStart) {
      markSpan(span)
      matched = true
    }
    offset = spanEnd
  }
  return matched
}

function applyHighlight(
  container: HTMLElement,
  charStart: number | null,
  charEnd: number | null,
  quote: string | null,
): void {
  const textLayer = container.querySelector<HTMLElement>('.react-pdf__Page__textContent')
  if (!textLayer) return

  const spans = Array.from(
    textLayer.querySelectorAll<HTMLElement>('span[role="presentation"], span'),
  )

  // Remove previous highlights
  container.querySelectorAll(`.${HIGHLIGHT_MARKER}`).forEach((el) => {
    const h = el as HTMLElement
    h.classList.remove(HIGHLIGHT_MARKER)
    h.style.removeProperty('background-color')
    h.style.removeProperty('border-radius')
  })

  if (spans.length === 0) return

  // Quote-based match is the primary path; char offsets are doc-global and
  // only coincidentally align with per-page text-layer offsets on page 1.
  let matched = false
  if (quote) {
    matched = highlightByQuote(spans, quote)
  }

  if (!matched && charStart !== null && charEnd !== null) {
    matched = highlightByCharOffsets(spans, charStart, charEnd)
  }

  if (!matched && quote) {
    highlightByKeywordWindow(spans, quote)
  }

  // If neither is available, nothing is highlighted — the page ring alone
  // indicates the target page, which is the correct behaviour.
}

// ---------------------------------------------------------------------------
// LegalTextPanel — for source_kind="legal" without a mapped PDF or for DOCX
// ---------------------------------------------------------------------------

function LegalTextPanel({ citation }: Readonly<{ citation: CitationTarget }>): JSX.Element {
  return (
    <div className="space-y-3 p-4 animate-phantom-fade-in-up">
      <div className={[phantomDesign.components.subtleCard, 'animate-phantom-scale-in'].join(' ')}>
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 shrink-0 text-phantom-accent" />
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-phantom-subtle">
            Jogi hivatkozás
          </p>
        </div>
        <p className="mt-2 text-sm font-medium text-phantom-ink">{citation.filename}</p>
        <p className="mt-0.5 text-xs text-phantom-subtle">Oldal: {citation.page + 1}</p>
        {citation.quote ? (
          <blockquote className="mt-3 border-l-2 border-phantom-accent pl-3 text-sm italic leading-relaxed text-phantom-muted">
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
// PdfViewer — all pages, full-width, auto-scroll + highlight on target
// ---------------------------------------------------------------------------

interface PdfViewerProps {
  readonly pdfUrl: string
  readonly targetPage0: number // 0-based
  readonly citation: CitationTarget
}

function PdfViewer({ pdfUrl, targetPage0, citation }: PdfViewerProps): JSX.Element {
  const [numPages, setNumPages] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set())

  const containerRef = useRef<HTMLDivElement>(null)
  // Map of 0-based page index → wrapper div
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // Effective 0-based target (clamped silently — no banner shown)
  const clampedPage0 = numPages > 0 ? Math.min(targetPage0, numPages - 1) : targetPage0

  // Measure container width for full-width PDF rendering
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.floor(entry.contentRect.width))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Reset on citation change
  useEffect(() => {
    setNumPages(0)
    setLoadError(null)
    setRenderedPages(new Set())
    pageRefs.current.clear()
  }, [pdfUrl])

  // Scroll to target page once it has rendered
  useEffect(() => {
    if (!renderedPages.has(clampedPage0)) return
    const el = pageRefs.current.get(clampedPage0)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [renderedPages, clampedPage0])

  // Apply highlight when target page renders
  useEffect(() => {
    if (!renderedPages.has(clampedPage0)) return
    const el = pageRefs.current.get(clampedPage0)
    if (!el) return
    requestAnimationFrame(() => {
      applyHighlight(el, citation.charStart, citation.charEnd, citation.quote)
    })
  }, [renderedPages, clampedPage0, citation])

  const setPageRef = useCallback((pageIdx: number) => (node: HTMLDivElement | null) => {
    if (node) pageRefs.current.set(pageIdx, node)
    else pageRefs.current.delete(pageIdx)
  }, [])

  const handlePageRendered = useCallback((pageIdx: number) => {
    setRenderedPages((prev) => {
      const next = new Set(prev)
      next.add(pageIdx)
      return next
    })
  }, [])

  const pageWidth = containerWidth > 0 ? containerWidth - 8 : undefined

  return (
    <div ref={containerRef} className="h-full w-full overflow-y-auto overflow-x-hidden">

      {loadError ? (
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <X className="h-8 w-8 text-phantom-accent" />
          <p className="text-sm font-semibold text-phantom-ink">Betöltési hiba</p>
          <p className="max-w-xs text-xs text-phantom-muted">{loadError}</p>
        </div>
      ) : (
        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          onLoadError={(err) => setLoadError(err.message)}
          loading={<LoadingSpinner label="PDF betöltése…" />}
          error={
            <p className="p-4 text-sm text-phantom-muted">Nem sikerült betölteni a fájlt.</p>
          }
          className="flex flex-col items-stretch gap-2 px-1 py-2"
        >
          {numPages > 0 &&
            Array.from({ length: numPages }, (_, i) => (
              <div
                key={i}
                ref={setPageRef(i)}
                data-page-index={i}
                className={[
                  'relative',
                  i === clampedPage0
                    ? 'ring-2 ring-phantom-accent ring-offset-2 rounded-sm'
                    : '',
                ].join(' ')}
              >
                <Page
                  pageNumber={i + 1}
                  width={pageWidth}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                  onRenderSuccess={() => handlePageRendered(i)}
                  loading={
                    <div
                      style={{ width: pageWidth ?? 600, height: 800 }}
                      className="flex items-center justify-center bg-white"
                    >
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-phantom-accent border-t-transparent" />
                    </div>
                  }
                />
                {/* Page number badge */}
                <div className="absolute bottom-2 right-2 rounded-full bg-phantom-ink/60 px-2 py-0.5 text-[10px] text-white">
                  {i + 1} / {numPages}
                </div>
              </div>
            ))}
        </Document>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DocumentViewer({ citation, onClose }: DocumentViewerProps): JSX.Element {
  const isDocx = citation.filename.toLowerCase().endsWith('.docx')
  const isLegal = citation.sourceKind === 'legal'
  const legalPdfUrl = isLegal ? resolveLegalPdfUrl(citation.filename) : null
  const showTextPanel = isDocx || (isLegal && legalPdfUrl === null)

  const pdfUrl = showTextPanel
    ? null
    : isLegal
      ? legalPdfUrl!
      : `${API_BASE}/api/v1/documents/${encodeURIComponent(citation.sessionId)}/file/${encodeURIComponent(citation.filename)}`

  return (
    <section
      className={[
        phantomDesign.components.panel,
        'flex h-full flex-col gap-0 !p-0 overflow-hidden animate-phantom-fade-in',
      ].join(' ')}
    >
      <ViewerHeader citation={citation} onClose={onClose} />

      <div className="min-h-0 flex-1 overflow-hidden bg-phantom-canvas animate-phantom-fade-in-up">
        {showTextPanel ? (
          <div className="h-full overflow-y-auto overflow-x-hidden">
            <LegalTextPanel citation={citation} />
          </div>
        ) : (
          <PdfViewer
            pdfUrl={pdfUrl!}
            targetPage0={citation.page}
            citation={citation}
          />
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function ViewerHeader({
  citation,
  onClose,
}: Readonly<{ citation: CitationTarget; onClose: () => void }>): JSX.Element {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-phantom-line bg-phantom-surface px-4 py-3 animate-phantom-fade-in-down">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-phantom-ink" title={citation.filename}>
          {citation.filename}
        </p>
        <p className="text-xs text-phantom-subtle">
          {citation.sourceKind === 'legal' ? 'Jogi hivatkozás · ' : ''}
          Cél: {citation.page + 1}. oldal
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Bezárás"
        className="group flex h-8 w-8 shrink-0 items-center justify-center rounded-phantom-control text-phantom-muted transition-phantom duration-phantom-base hover:bg-phantom-surface-muted hover:text-phantom-ink active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-accent"
      >
        <X className="h-4 w-4 transition-transform duration-phantom-base group-hover:rotate-90" />
      </button>
    </div>
  )
}

function LoadingSpinner({ label }: Readonly<{ label?: string }>): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 animate-phantom-fade-in">
      <div className="force-spin h-6 w-6 animate-spin rounded-full border-2 border-phantom-accent border-t-transparent" />
      {label && <p className="text-xs text-phantom-subtle animate-phantom-pulse-soft">{label}</p>}
    </div>
  )
}
