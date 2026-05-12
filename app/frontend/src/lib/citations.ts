import type { BackendEvidenceChunk } from './backendAudit'
import type { CitationTarget } from '../types/viewer'

export function evidencePageToPdfPageIndex(page: number): number {
  return Math.max(0, page - 1)
}

export function formatEvidencePage(page: number): string {
  return `p${Math.max(1, page)}`
}

export function evidenceChunkToCitationTarget(
  chunk: BackendEvidenceChunk,
  sessionId: string,
  fallbackQuote: string | null = null,
): CitationTarget {
  return {
    sessionId,
    filename: chunk.filename,
    page: evidencePageToPdfPageIndex(chunk.page),
    charStart: chunk.char_start ?? null,
    charEnd: chunk.char_end ?? null,
    sourceKind: chunk.source_kind ?? 'document',
    quote: chunk.quote ?? fallbackQuote,
  }
}