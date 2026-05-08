export interface CitationTarget {
  readonly sessionId: string
  readonly filename: string
  readonly page: number
  readonly charStart: number | null
  readonly charEnd: number | null
  readonly sourceKind: 'document' | 'legal'
  readonly quote: string | null
}
