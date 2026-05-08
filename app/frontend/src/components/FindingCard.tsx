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
import EvidenceChip from './EvidenceChip'
import { StatusPill } from './ui/DashboardPrimitives'

type FindingVariant =
  | { kind: 'consistency'; finding: BackendConsistencyError }
  | { kind: 'benchmark'; finding: BackendBenchmarkRisk }
  | { kind: 'missing'; finding: BackendMissingElement }

interface FindingCardProps {
  readonly variant: FindingVariant
  readonly showAgentBadge?: boolean
}

function AttributionRow({
  attribution,
  isCrossDoc,
}: Readonly<{ attribution: BackendFindingAttribution; isCrossDoc: boolean }>): JSX.Element {
  const hasChunks = attribution.evidence_chunks.length > 0

  return (
    <div className="mt-2 border-t border-phantom-line pt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-phantom-subtle">Hivatkozások:</span>
        {hasChunks ? (
          attribution.evidence_chunks.map((chunk, i) => (
            <EvidenceChip
              key={`${chunk.filename}-${chunk.page}-${chunk.chunk_index}-${i}`}
              chunk={chunk}
              isCrossDoc={isCrossDoc}
            />
          ))
        ) : (
          <StatusPill tone="danger">⚠ Hiányzó bizonyíték (BE hiba)</StatusPill>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-phantom-surface ring-1 ring-phantom-line">
          <div
            className="h-full rounded-full bg-phantom-accent"
            style={{ width: `${Math.round(attribution.confidence * 100)}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] text-phantom-subtle">
          Megbízhatóság: {Math.round(attribution.confidence * 100)}%
        </span>
      </div>
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

export default function FindingCard({ variant, showAgentBadge = false }: FindingCardProps): JSX.Element {
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
        <AttributionRow attribution={attribution} isCrossDoc={isCrossDoc} />
      )}
    </article>
  )
}
