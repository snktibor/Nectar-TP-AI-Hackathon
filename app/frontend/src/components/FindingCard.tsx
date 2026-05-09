import { MapPin, Scale } from 'lucide-react'
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

function chunkToCitation(chunk: BackendEvidenceChunk, sessionId: string): CitationTarget {
  return {
    sessionId,
    filename: chunk.filename,
    page: chunk.page,
    charStart: chunk.char_start ?? null,
    charEnd: chunk.char_end ?? null,
    sourceKind: chunk.source_kind ?? 'document',
    quote: chunk.quote ?? null,
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
    page: 0,
    charStart: null,
    charEnd: null,
    sourceKind: 'legal',
    quote: null,
  }

  return (
    <button
      type="button"
      onClick={() => onCitationClick(citation)}
      className={[
        baseClass,
        'cursor-pointer text-phantom-accent hover:bg-phantom-accent-soft hover:text-phantom-accent hover:ring-phantom-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus',
      ].join(' ')}
      title={`${target.filename} megnyitása`}
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
  const hasLegalRefs = (attribution.legal_references?.length ?? 0) > 0

  return (
    <div className="mt-2 border-t-2 border-dashed border-phantom-ink/40 pt-2 space-y-2">
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
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full border-2 border-phantom-ink bg-phantom-surface">
          <div
            className="h-full bg-phantom-accent"
            style={{ width: `${confidencePct}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] text-phantom-subtle">
          Megbízhatóság: {confidencePct}%
        </span>
        {attribution.requires_human_review === true && (
          <StatusPill tone="warning">Emberi felülvizsgálat szükséges</StatusPill>
        )}
      </div>

      {/* Reasoning (collapsible) */}
      {attribution.reasoning && (
        <details className="text-xs">
          <summary className="cursor-pointer select-none text-phantom-subtle hover:text-phantom-ink">
            Ügynök indoklás
          </summary>
          <p className="mt-1 italic text-phantom-muted leading-relaxed">{attribution.reasoning}</p>
        </details>
      )}

      {/* Uncertainty notes */}
      {attribution.uncertainty_notes && (
        <p className="text-[11px] text-phantom-subtle border-l-2 border-amber-300 pl-2">
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
            {attribution.rule_id && (
              <LegalReferenceBadge
                reference={attribution.rule_id}
                sessionId={sessionId}
                onCitationClick={onCitationClick}
              />
            )}
            {attribution.legal_references?.map((ref) => (
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
  const documentChunks = evidenceChunks.filter(
    (c) => (c.source_kind ?? 'document') === 'document',
  )
  const legalChunks = evidenceChunks.filter((c) => c.source_kind === 'legal')

  return (
    <article
      className={[
        'rounded-phantom-card border-2 border-phantom-ink bg-phantom-surface p-3 shadow-phantom-sticker',
        'border-l-[6px]',
        'transition-transform duration-phantom-base hover:-translate-y-0.5 hover:shadow-[8px_10px_0_#0A0A0A]',
        borderClass,
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={[
            'inline-flex rounded-full border-2 border-phantom-ink px-2 py-0.5 font-display text-[11px] font-extrabold uppercase tracking-[0.12em] shadow-phantom-sticker',
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
          <p className="mt-2 text-sm text-phantom-ink">{variant.finding.description}</p>
          {variant.finding.evidence && (
            <p className="mt-1 text-xs italic text-phantom-muted">{variant.finding.evidence}</p>
          )}
          {variant.finding.locations.length > 0 && (
            <p className="mt-1 text-xs text-phantom-subtle">
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
          <p className="mt-2 text-sm font-medium text-phantom-ink">{variant.finding.metric}</p>
          <p className="mt-1 text-xs text-phantom-muted">
            Érték: {variant.finding.observed_value} | Tartomány:{' '}
            {variant.finding.benchmark_range[0]} – {variant.finding.benchmark_range[1]}
          </p>
          <p className="mt-1 text-xs text-phantom-ink">{variant.finding.rationale}</p>
        </>
      )}

      {variant.kind === 'missing' && (
        <>
          <p className="mt-2 text-sm text-phantom-ink">{variant.finding.description}</p>
          <p className="mt-1 text-xs text-phantom-muted">
            Várható: {variant.finding.expected_in} · Kötelező: {variant.finding.required_by}
          </p>
        </>
      )}

      {primaryChunk && onCitationClick && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCitationClick(chunkToCitation(primaryChunk, sessionId))}
            className="inline-flex items-center gap-1.5 rounded-phantom-control border-2 border-phantom-ink bg-phantom-accent px-3 py-1.5 font-display text-xs font-extrabold text-phantom-ink shadow-phantom-button transition-transform duration-phantom-base hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#0A0A0A] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_#0A0A0A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phantom-surface"
            title={`${primaryChunk.filename} · oldal ${primaryChunk.page + 1}`}
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>Mutasd meg hol van</span>
            <span className="max-w-[16ch] truncate font-normal opacity-90">
              · {primaryChunk.filename}
            </span>
          </button>
          {documentChunks
            .filter((c) => c !== primaryChunk)
            .map((chunk, i) => (
              <button
                key={`doc-${chunk.filename}-${chunk.page}-${chunk.chunk_index}-${i}`}
                type="button"
                onClick={() => onCitationClick(chunkToCitation(chunk, sessionId))}
                className="inline-flex items-center gap-1.5 rounded-phantom-control border-2 border-phantom-ink bg-phantom-surface px-3 py-1.5 font-display text-xs font-extrabold text-phantom-ink shadow-phantom-sticker transition-transform duration-phantom-base hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus"
                title={`${chunk.filename} · oldal ${chunk.page + 1}`}
              >
                <MapPin className="h-3.5 w-3.5" />
                <span className="max-w-[18ch] truncate">{chunk.filename}</span>
              </button>
            ))}
          {legalChunks.map((chunk, i) => (
            <button
              key={`legal-${chunk.filename}-${chunk.page}-${chunk.chunk_index}-${i}`}
              type="button"
              onClick={() => onCitationClick(chunkToCitation(chunk, sessionId))}
              className="inline-flex items-center gap-1.5 rounded-phantom-control border-2 border-phantom-ink bg-phantom-cyan px-3 py-1.5 font-display text-xs font-extrabold text-phantom-ink shadow-phantom-sticker transition-transform duration-phantom-base hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phantom-focus"
              title={`${chunk.filename} · oldal ${chunk.page + 1}`}
            >
              <Scale className="h-3.5 w-3.5" />
              <span className="max-w-[20ch] truncate">{chunk.filename}</span>
            </button>
          ))}
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
