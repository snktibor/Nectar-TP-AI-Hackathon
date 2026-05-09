import { MapPin } from 'lucide-react'
import {
  AGENT_LABELS,
  getSeverityBorderClass,
  getSeverityTone,
  severityLabel,
  type BackendBenchmarkRisk,
  type BackendConsistencyError,
  type BackendEvidenceChunk,
  type BackendFindingAttribution,
  type BackendMissingElement,
} from '../lib/backendAudit'
import type { CitationTarget } from '../types/viewer'
import { resolveLegalReference } from '../lib/legalDocs'
import { phantomDesign } from '../design-system/phantomDesign'
import EvidenceChip from './EvidenceChip'
import { StatusPill } from './ui/DashboardPrimitives'

function collectLegalReferences(attribution: BackendFindingAttribution): string[] {
  const raw = [attribution.rule_id, ...(attribution.legal_references ?? [])]
  const filtered = raw.filter((item): item is string => Boolean(item?.trim()))
  return [...new Set(filtered)]
}

function chunkToCitation(
  chunk: BackendEvidenceChunk,
  sessionId: string,
  fallbackQuote: string | null = null,
): CitationTarget {
  return {
    sessionId,
    filename: chunk.filename,
    page: chunk.page,
    charStart: chunk.char_start ?? null,
    charEnd: chunk.char_end ?? null,
    sourceKind: chunk.source_kind ?? 'document',
    quote: chunk.quote ?? fallbackQuote,
  }
}

function LegalReferenceBadge({
  reference,
  sessionId,
  onCitationClick,
}: Readonly<{
  reference: string
  sessionId: string
  onCitationClick?: (target: CitationTarget) => void
}>): JSX.Element {
  const target = resolveLegalReference(reference)
  const baseClass = phantomDesign.components.tag
  if (!target || !onCitationClick) {
    return <code className={baseClass}>{reference}</code>
  }

  const citation: CitationTarget = {
    sessionId,
    filename: target.filename,
    page: target.page,
    charStart: null,
    charEnd: null,
    sourceKind: 'legal',
    quote: target.highlightHint,
    label: reference,
  }

  return (
    <button
      type="button"
      onClick={() => onCitationClick(citation)}
      className={[
        baseClass,
        'cursor-pointer text-phantom-accent hover:bg-phantom-accent-soft hover:text-phantom-accent hover:ring-phantom-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus',
      ].join(' ')}
      title={`Megnyitás: ${reference}`}
    >
      {reference}
    </button>
  )
}

// Pick the most useful chunk for the "Show me where" CTA: prefer an uploaded
// document chunk over a legal one, since the user wants to see THEIR file.
function pickPrimaryChunk(
  chunks: readonly BackendEvidenceChunk[],
): BackendEvidenceChunk | null {
  if (chunks.length === 0) return null
  return (
    chunks.find((c) => (c.source_kind ?? 'document') === 'document') ?? chunks[0]
  )
}

type FindingVariant =
  | { kind: 'consistency'; finding: BackendConsistencyError }
  | { kind: 'benchmark'; finding: BackendBenchmarkRisk }
  | { kind: 'missing'; finding: BackendMissingElement }

interface FindingCardProps {
  readonly variant: FindingVariant
  readonly showAgentBadge?: boolean
  readonly sessionId?: string
  readonly onCitationClick?: (target: CitationTarget) => void
}

function AttributionRow({
  attribution,
  isCrossDoc,
  sessionId,
  onCitationClick,
}: Readonly<{
  attribution: BackendFindingAttribution
  isCrossDoc: boolean
  sessionId: string
  onCitationClick?: (target: CitationTarget) => void
}>): JSX.Element {
  const hasChunks = attribution.evidence_chunks.length > 0
  const confidencePct = Math.round(attribution.confidence * 100)
  const legalReferences = collectLegalReferences(attribution)
  const hasLegalRefs = legalReferences.length > 0

  return (
    <div className="mt-2 space-y-2 border-t border-phantom-line pt-2">
      {/* Evidence chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-phantom-subtle">Hivatkozások:</span>
        {hasChunks ? (
          attribution.evidence_chunks.map((chunk, i) => {
            const target: CitationTarget = {
              sessionId,
              filename: chunk.filename,
              page: chunk.page,
              charStart: chunk.char_start ?? null,
              charEnd: chunk.char_end ?? null,
              sourceKind: chunk.source_kind ?? 'document',
              quote: chunk.quote ?? null,
            }
            return (
              <EvidenceChip
                key={`${chunk.filename}-${chunk.page}-${chunk.chunk_index}-${i}`}
                chunk={chunk}
                isCrossDoc={isCrossDoc}
                onClick={onCitationClick ? () => onCitationClick(target) : undefined}
              />
            )
          })
        ) : (
          <StatusPill tone="danger">⚠ Hiányzó bizonyíték (BE hiba)</StatusPill>
        )}
      </div>

      {/* Confidence bar + human review badge */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-1 w-full overflow-hidden rounded-full bg-phantom-surface ring-1 ring-phantom-line sm:flex-1 sm:w-auto">
          <div
            className="h-full rounded-full bg-phantom-accent"
            style={{ width: `${confidencePct}%` }}
          />
        </div>
        <span className="shrink-0 whitespace-nowrap text-[11px] text-phantom-subtle">
          Megbízhatóság: {confidencePct}%
        </span>
        {attribution.requires_human_review === true && (
          <div className="min-w-0">
            <StatusPill tone="warning">Emberi felülvizsgálat szükséges</StatusPill>
          </div>
        )}
      </div>

      {/* Reasoning (collapsible) */}
      {attribution.reasoning && (
        <details className="text-xs">
          <summary className="cursor-pointer select-none text-phantom-subtle hover:text-phantom-ink">
            Ügynök indoklás
          </summary>
          <p className="mt-1 break-words italic leading-relaxed text-phantom-muted">{attribution.reasoning}</p>
        </details>
      )}

      {/* Uncertainty notes */}
      {attribution.uncertainty_notes && (
        <p className="break-words border-l-2 border-amber-300 pl-2 text-[11px] text-phantom-subtle">
          {attribution.uncertainty_notes}
        </p>
      )}

      {/* Legal references */}
      {hasLegalRefs && (
        <details className="text-xs">
          <summary className="cursor-pointer select-none text-phantom-subtle hover:text-phantom-ink">
            Jogszabályi hivatkozások
          </summary>
          <div className="mt-1 flex flex-wrap gap-1">
            {legalReferences.map((ref) => (
              <LegalReferenceBadge
                key={ref}
                reference={ref}
                sessionId={sessionId}
                onCitationClick={onCitationClick}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function findingAttribution(
  variant: FindingVariant,
): BackendFindingAttribution | null | undefined {
  return variant.finding.attribution
}

function findingSeverity(variant: FindingVariant) {
  return variant.finding.severity
}

function findingLocationsCount(variant: FindingVariant): number {
  if (variant.kind === 'missing') return 0
  return variant.finding.locations.length
}

export default function FindingCard({
  variant,
  showAgentBadge = false,
  sessionId = '',
  onCitationClick,
}: FindingCardProps): JSX.Element {
  const severity = findingSeverity(variant)
  const attribution = findingAttribution(variant)
  const borderClass = getSeverityBorderClass(severity)
  const isCrossDoc = attribution?.agent_id === 'cross_doc_consistency_agent'
  const isMultiDoc = isCrossDoc && findingLocationsCount(variant) >= 2
  const evidenceChunks = attribution?.evidence_chunks ?? []
  const primaryChunk = pickPrimaryChunk(evidenceChunks)
  const fallbackQuote = (() => {
    if (variant.kind === 'consistency') {
      return variant.finding.evidence ?? variant.finding.description
    }
    if (variant.kind === 'benchmark') {
      return variant.finding.rationale
    }
    return variant.finding.description
  })()

  return (
    <article
      className={[
        'min-w-0 overflow-hidden rounded-phantom-card border border-phantom-line bg-phantom-surface-muted p-3',
        'border-l-4',
        borderClass,
      ].join(' ')}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span
          className={[
            'inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-[11px] font-semibold uppercase',
            getSeverityTone(severity),
          ].join(' ')}
        >
          {severityLabel(severity)}
        </span>

        {showAgentBadge && attribution?.agent_id && (
          <StatusPill tone="neutral">{AGENT_LABELS[attribution.agent_id]}</StatusPill>
        )}

        {isMultiDoc && (
          <StatusPill tone="accent">Több dokumentum közt</StatusPill>
        )}
      </div>

      {variant.kind === 'consistency' && (
        <>
          <p className="mt-2 break-words text-sm leading-6 text-phantom-ink">{variant.finding.description}</p>
          {variant.finding.evidence && (
            <p className="mt-1 break-words text-xs italic text-phantom-muted">{variant.finding.evidence}</p>
          )}
          {variant.finding.locations.length > 0 && (
            <p className="mt-1 break-words text-xs text-phantom-subtle">
              {variant.finding.locations
                .map((loc) =>
                  loc.line_numbers && loc.line_numbers.length > 0
                    ? `${loc.filename} (${loc.line_numbers.join(', ')})`
                    : loc.filename,
                )
                .join(' • ')}
            </p>
          )}
        </>
      )}

      {variant.kind === 'benchmark' && (
        <>
          <p className="mt-2 break-words text-sm font-medium text-phantom-ink">{variant.finding.metric}</p>
          <p className="mt-1 break-words text-xs text-phantom-muted">
            Érték: {variant.finding.observed_value} | Tartomány:{' '}
            {variant.finding.benchmark_range[0]} – {variant.finding.benchmark_range[1]}
          </p>
          <p className="mt-1 break-words text-xs text-phantom-ink">{variant.finding.rationale}</p>
        </>
      )}

      {variant.kind === 'missing' && (
        <>
          <p className="mt-2 break-words text-sm leading-6 text-phantom-ink">{variant.finding.description}</p>
          <p className="break-words text-xs text-phantom-muted">
            Várható: {variant.finding.expected_in} · Kötelező: {variant.finding.required_by}
          </p>
        </>
      )}

      {primaryChunk && onCitationClick && (
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCitationClick(chunkToCitation(primaryChunk, sessionId, fallbackQuote))}
            className="inline-flex items-center gap-1.5 rounded-phantom-control bg-phantom-accent px-3 py-1.5 text-xs font-semibold text-white shadow-phantom-button transition-phantom duration-phantom-base hover:-translate-y-px hover:bg-phantom-accent-hover hover:shadow-phantom-lift active:translate-y-0 active:bg-phantom-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phantom-surface"
            title={`${primaryChunk.filename} · oldal ${primaryChunk.page + 1}`}
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>Mutasd meg hol van</span>
          </button>
        </div>
      )}

      {attribution && (
        <AttributionRow
          attribution={attribution}
          isCrossDoc={isCrossDoc}
          sessionId={sessionId}
          onCitationClick={onCitationClick}
        />
      )}
    </article>
  )
}
