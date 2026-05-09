export interface CitationTarget {
  readonly sessionId: string
  readonly filename: string
  readonly page: number
  readonly charStart: number | null
  readonly charEnd: number | null
  readonly sourceKind: 'document' | 'legal'
  readonly quote: string | null
  /** Human-readable reference label shown in the viewer header (e.g. "OECD_TPG_2022.Ch_I.D.1") */
  readonly label?: string
}
