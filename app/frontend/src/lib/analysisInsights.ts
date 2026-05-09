import { severityLabel, type BackendAuditReport, type BackendRiskSeverity } from './backendAudit'

interface FindingSnapshot {
  readonly severity: BackendRiskSeverity
  readonly text: string
}

export interface AnalysisExecutiveStats {
  readonly estimatedNavExposureFt: number
  readonly totalFindings: number
  readonly benchmarkOvershootPercent: number | null
  readonly criticalCount: number
  readonly highCount: number
  readonly mediumCount: number
  readonly lowCount: number
  readonly successfulAgentRuns: number
  readonly totalAgentRuns: number
  readonly successfulDocumentCount: number
  readonly consistencyCount: number
  readonly benchmarkCount: number
  readonly missingCount: number
}

export interface AnalysisReadableSummary {
  readonly headline: string
  readonly composition: string
  readonly breakdown: string
  readonly overallRiskLabel: string
  readonly criticalHighlights: string[]
  readonly highHighlights: string[]
  readonly mediumHighlights: string[]
}

const FORINT_AMOUNT_REGEX = /(\d{1,3}(?:[.\s]\d{3})+|\d+)\s*Ft/gi
const DISCREPANCY_HINT_REGEX = /eltérés|diszkrepancia|túlszámlázás|adóalap-eltérés|korrekció/i
const SPACE_REGEX = /\s+/g

function normalizeText(value: string): string {
  return value.replace(SPACE_REGEX, ' ').trim()
}

function parseForintAmount(raw: string): number {
  return Number.parseInt(raw.replace(/[.\s]/g, ''), 10)
}

function extractForintAmounts(text: string): number[] {
  return [...text.matchAll(FORINT_AMOUNT_REGEX)]
    .map((match) => parseForintAmount(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0)
}

function estimateDiscrepancyFromConsistency(report: BackendAuditReport): number {
  let bestEstimate: number | null = null

  for (const finding of report.consistency_errors) {
    const text = normalizeText(`${finding.description} ${finding.evidence ?? ''}`)
    if (!DISCREPANCY_HINT_REGEX.test(text)) continue

    const amounts = extractForintAmounts(text).filter(
      (amount) => amount >= 1_000_000 && amount <= 500_000_000,
    )

    if (amounts.length === 1) {
      bestEstimate = bestEstimate === null ? amounts[0] : Math.min(bestEstimate, amounts[0])
      continue
    }

    if (amounts.length < 2) continue

    const sorted = [...new Set(amounts)].sort((a, b) => a - b)
    for (let index = 1; index < sorted.length; index += 1) {
      const diff = sorted[index] - sorted[index - 1]
      if (diff <= 0) continue
      bestEstimate = bestEstimate === null ? diff : Math.min(bestEstimate, diff)
    }
  }

  return bestEstimate ?? 0
}

function calculateBenchmarkOvershootPercent(report: BackendAuditReport): number | null {
  let maxOvershootPercent = 0

  for (const risk of report.benchmark_risks) {
    const upperBound = risk.benchmark_range[1]
    if (upperBound <= 0 || risk.observed_value <= upperBound) continue

    const overshootPercent = ((risk.observed_value - upperBound) / upperBound) * 100
    maxOvershootPercent = Math.max(maxOvershootPercent, overshootPercent)
  }

  return maxOvershootPercent > 0 ? maxOvershootPercent : null
}

function countBySeverity(report: BackendAuditReport): Record<BackendRiskSeverity, number> {
  const counts: Record<BackendRiskSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }

  for (const finding of report.consistency_errors) {
    counts[finding.severity] += 1
  }
  for (const finding of report.benchmark_risks) {
    counts[finding.severity] += 1
  }
  for (const finding of report.missing_elements) {
    counts[finding.severity] += 1
  }

  return counts
}

function calculateEstimatedNavExposureFt(
  severityCounts: Record<BackendRiskSeverity, number>,
  criticalBenchmarkCount: number,
  discrepancyFt: number,
): number {
  return (
    severityCounts.critical * 24_000_000 +
    severityCounts.high * 7_000_000 +
    severityCounts.medium * 3_000_000 +
    severityCounts.low * 1_000_000 +
    criticalBenchmarkCount * 3_000_000 +
    discrepancyFt
  )
}

function collectFindingSnapshots(report: BackendAuditReport): FindingSnapshot[] {
  const consistencyFindings: FindingSnapshot[] = report.consistency_errors.map((finding) => ({
    severity: finding.severity,
    text: finding.description,
  }))

  const benchmarkFindings: FindingSnapshot[] = report.benchmark_risks.map((finding) => ({
    severity: finding.severity,
    text: finding.rationale,
  }))

  const missingFindings: FindingSnapshot[] = report.missing_elements.map((finding) => ({
    severity: finding.severity,
    text: finding.description,
  }))

  return [...consistencyFindings, ...benchmarkFindings, ...missingFindings]
}

function truncateFindingText(value: string, maxLength = 180): string {
  const normalized = normalizeText(value)
  if (normalized.length <= maxLength) return normalized

  const sliced = normalized.slice(0, maxLength)
  const lastSpace = sliced.lastIndexOf(' ')
  if (lastSpace <= 20) return `${sliced}...`
  return `${sliced.slice(0, lastSpace)}...`
}

export function buildExecutiveStats(
  report: BackendAuditReport,
  successfulDocumentCount: number,
): AnalysisExecutiveStats {
  const severityCounts = countBySeverity(report)
  const discrepancyEstimateFt = estimateDiscrepancyFromConsistency(report)
  const criticalBenchmarkCount = report.benchmark_risks.filter(
    (risk) => risk.severity === 'critical',
  ).length

  const estimatedNavExposureFt = calculateEstimatedNavExposureFt(
    severityCounts,
    criticalBenchmarkCount,
    discrepancyEstimateFt,
  )

  return {
    estimatedNavExposureFt,
    totalFindings:
      report.consistency_errors.length +
      report.benchmark_risks.length +
      report.missing_elements.length,
    benchmarkOvershootPercent: calculateBenchmarkOvershootPercent(report),
    criticalCount: severityCounts.critical,
    highCount: severityCounts.high,
    mediumCount: severityCounts.medium,
    lowCount: severityCounts.low,
    successfulAgentRuns: report.agent_runs.filter((run) => run.status === 'ok').length,
    totalAgentRuns: report.agent_runs.length,
    successfulDocumentCount,
    consistencyCount: report.consistency_errors.length,
    benchmarkCount: report.benchmark_risks.length,
    missingCount: report.missing_elements.length,
  }
}

export function formatCompactForint(value: number): string {
  if (value >= 10_000_000) {
    return `${Math.round(value / 1_000_000).toLocaleString('hu-HU')} M Ft`
  }
  return `${Math.round(value).toLocaleString('hu-HU')} Ft`
}

export function buildReadableSummary(
  report: BackendAuditReport,
  successfulDocumentCount: number,
): AnalysisReadableSummary {
  const stats = buildExecutiveStats(report, successfulDocumentCount)
  const findingSnapshots = collectFindingSnapshots(report)

  const bySeverity = (severity: BackendRiskSeverity, maxItems: number): string[] => {
    return findingSnapshots
      .filter((finding) => finding.severity === severity)
      .slice(0, maxItems)
      .map((finding) => truncateFindingText(finding.text))
  }

  const headline = `${stats.successfulAgentRuns}/${stats.totalAgentRuns} ágens sikeresen lefutott · ${stats.successfulDocumentCount} dokumentum átvizsgálva`
  const composition = `${stats.totalFindings} megállapítás: ${stats.criticalCount} kritikus, ${stats.highCount} magas, ${stats.mediumCount} közepes${stats.lowCount > 0 ? `, ${stats.lowCount} alacsony` : ''}.`
  const breakdown = `${stats.consistencyCount} konzisztencia, ${stats.benchmarkCount} benchmark és ${stats.missingCount} teljességi finding. Becsült NAV-kitettség: ${formatCompactForint(stats.estimatedNavExposureFt)}.`

  return {
    headline,
    composition,
    breakdown,
    overallRiskLabel: severityLabel(report.overall_risk).toUpperCase(),
    criticalHighlights: bySeverity('critical', 3),
    highHighlights: bySeverity('high', 3),
    mediumHighlights: bySeverity('medium', 2),
  }
}
