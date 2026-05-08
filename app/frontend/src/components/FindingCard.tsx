import {
  AGENT_LABELS,
  getSeverityBorderClass,
  getSeverityTone,
  severityLabel,
  type BackendBenchmarkRisk,
  type BackendConsistencyError,
  type BackendFindingAttribution,
  type BackendMissingElement,
} from '../lib/backendAudit'
import type { CitationTarget } from '../types/viewer'
import { phantomDesign } from '../design-system/phantomDesign'
import EvidenceChip from './EvidenceChip'
import { StatusPill } from './ui/DashboardPrimitives'

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
    <div className="mt-2 border-t border-phantom-line pt-2 space-y-2">
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
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-phantom-surface ring-1 ring-phantom-line">
          <div
            className="h-full rounded-full bg-phantom-accent"
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
              <code className={phantomDesign.components.tag}>{attribution.rule_id}</code>
            )}
            {attribution.legal_references?.map((ref) => (
              <code key={ref} className={phantomDesign.components.tag}>{ref}</code>
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

  return (
    <article
      className={[
        'rounded-phantom-card border border-phantom-line bg-phantom-surface-muted p-3',
        'border-l-4',
        borderClass,
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={[
            'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase',
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
