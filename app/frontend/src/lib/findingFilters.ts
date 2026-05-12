import {
  compareSeverityDesc,
  type BackendAuditReport,
  type BackendDocTypeScope,
  type BackendErrorLocation,
  type BackendEvidenceChunk,
  type BackendFindingAttribution,
  type BackendMissingElement,
} from './backendAudit'
import type { IngestedDocument } from '../types/api'
import type { AnyFinding } from '../types/findings'

function normalizeFilename(filename: string): string {
  const normalizedPath = filename.trim().replace(/\\/g, '/')
  return (normalizedPath.split('/').pop() ?? normalizedPath).toLowerCase()
}

function buildKnownFilenameMap(documents: readonly IngestedDocument[]): Map<string, string> {
  return new Map(documents.map((document) => [normalizeFilename(document.filename), document.filename]))
}

function evidenceChunkMatchesFilename(
  chunk: BackendEvidenceChunk,
  filename: string,
): boolean {
  if ((chunk.source_kind ?? 'document') !== 'document') return false
  return normalizeFilename(chunk.filename) === filename
}

function attributionHasFilename(
  attribution: BackendFindingAttribution | null | undefined,
  filename: string,
): boolean {
  return attribution?.evidence_chunks.some((chunk) => evidenceChunkMatchesFilename(chunk, filename)) ?? false
}

function attributionMatchesScope(
  attribution: BackendFindingAttribution | null | undefined,
  scope: BackendDocTypeScope | null,
): boolean {
  if (scope === null || !attribution) return false
  return attribution.doc_type_scope === scope
}

interface FindingWithLocations {
  readonly locations: readonly BackendErrorLocation[]
  readonly attribution?: BackendFindingAttribution | null
}

function findingWithLocationsMatchesDocument(
  finding: FindingWithLocations,
  filename: string,
  scope: BackendDocTypeScope | null,
): boolean {
  return (
    finding.locations.some((location) => normalizeFilename(location.filename) === filename) ||
    attributionHasFilename(finding.attribution, filename) ||
    attributionMatchesScope(finding.attribution, scope)
  )
}

function missingMatchesDocument(
  finding: BackendMissingElement,
  filename: string,
  scope: BackendDocTypeScope | null,
): boolean {
  return (
    normalizeFilename(finding.expected_in) === filename ||
    attributionHasFilename(finding.attribution, filename) ||
    attributionMatchesScope(finding.attribution, scope)
  )
}

export function filterReportByDocument(
  report: BackendAuditReport,
  filename: string,
  scope: BackendDocTypeScope | null,
): AnyFinding[] {
  const normalizedFilename = normalizeFilename(filename)
  const consistency = report.consistency_errors
    .filter((finding) => findingWithLocationsMatchesDocument(finding, normalizedFilename, scope))
    .map((finding): AnyFinding => ({ kind: 'consistency', finding }))

  const benchmark = report.benchmark_risks
    .filter((finding) => findingWithLocationsMatchesDocument(finding, normalizedFilename, scope))
    .map((finding): AnyFinding => ({ kind: 'benchmark', finding }))

  const missing = report.missing_elements
    .filter((finding) => missingMatchesDocument(finding, normalizedFilename, scope))
    .map((finding): AnyFinding => ({ kind: 'missing', finding }))

  return [...consistency, ...benchmark, ...missing].sort((a, b) =>
    compareSeverityDesc(a.finding.severity, b.finding.severity),
  )
}

function addKnownFilename(
  filenames: Set<string>,
  knownFilenames: ReadonlyMap<string, string>,
  filename: string,
): void {
  const canonicalFilename = knownFilenames.get(normalizeFilename(filename))
  if (canonicalFilename) {
    filenames.add(canonicalFilename)
  }
}

function addAttributionFilenames(
  filenames: Set<string>,
  knownFilenames: ReadonlyMap<string, string>,
  attribution: BackendFindingAttribution | null | undefined,
): void {
  for (const chunk of attribution?.evidence_chunks ?? []) {
    if ((chunk.source_kind ?? 'document') === 'document') {
      addKnownFilename(filenames, knownFilenames, chunk.filename)
    }
  }
}

function addScopeFallbackFilenames(
  filenames: Set<string>,
  filenamesByScope: ReadonlyMap<BackendDocTypeScope, readonly string[]>,
  attribution: BackendFindingAttribution | null | undefined,
): void {
  if (!attribution || filenames.size > 0) return
  for (const filename of filenamesByScope.get(attribution.doc_type_scope) ?? []) {
    filenames.add(filename)
  }
}

export function buildFindingsByFilename(
  report: BackendAuditReport | null,
  documents: readonly IngestedDocument[],
): Record<string, number> {
  const counts: Record<string, number> = {}
  if (!report) return counts

  const knownFilenames = buildKnownFilenameMap(documents)
  const filenamesByScope = new Map<BackendDocTypeScope, string[]>()
  for (const document of documents) {
    if (document.status !== 'success') continue
    const scope = document.detected_type as BackendDocTypeScope
    const filenames = filenamesByScope.get(scope) ?? []
    filenames.push(document.filename)
    filenamesByScope.set(scope, filenames)
  }

  const bump = (filenames: ReadonlySet<string>): void => {
    for (const filename of filenames) {
      counts[filename] = (counts[filename] ?? 0) + 1
    }
  }

  for (const finding of report.consistency_errors) {
    const filenames = new Set<string>()
    finding.locations.forEach((location) => addKnownFilename(filenames, knownFilenames, location.filename))
    addAttributionFilenames(filenames, knownFilenames, finding.attribution)
    addScopeFallbackFilenames(filenames, filenamesByScope, finding.attribution)
    bump(filenames)
  }

  for (const finding of report.benchmark_risks) {
    const filenames = new Set<string>()
    finding.locations.forEach((location) => addKnownFilename(filenames, knownFilenames, location.filename))
    addAttributionFilenames(filenames, knownFilenames, finding.attribution)
    addScopeFallbackFilenames(filenames, filenamesByScope, finding.attribution)
    bump(filenames)
  }

  for (const finding of report.missing_elements) {
    const filenames = new Set<string>()
    addKnownFilename(filenames, knownFilenames, finding.expected_in)
    addAttributionFilenames(filenames, knownFilenames, finding.attribution)
    addScopeFallbackFilenames(filenames, filenamesByScope, finding.attribution)
    bump(filenames)
  }

  return counts
}