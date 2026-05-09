export interface DocumentTypeDisplay {
  label: string
  badgeClassName: string
}

export const DOCUMENT_TYPE_DISPLAY: Record<string, DocumentTypeDisplay> = {
  master_file: {
    label: 'Fő Fájl',
    badgeClassName: 'bg-phantom-accent-soft text-phantom-accent ring-phantom-accent/20',
  },
  local_file: {
    label: 'Helyi Fájl',
    badgeClassName: 'bg-phantom-success-soft text-phantom-success-text ring-phantom-success-border',
  },
  benchmark_study: {
    label: 'Benchmark tanulmány',
    badgeClassName: 'bg-phantom-severity-medium-soft text-phantom-severity-medium-text ring-phantom-severity-medium-border',
  },
  contract: {
    label: 'Szerződés',
    badgeClassName: 'bg-phantom-severity-high-soft text-phantom-severity-high-text ring-phantom-severity-high-border',
  },
  invoice: {
    label: 'Számla',
    badgeClassName: 'bg-phantom-surface-muted text-phantom-muted ring-phantom-line',
  },
  financial_statement: {
    label: 'Pénzügyi dokumentum',
    badgeClassName: 'bg-phantom-surface-muted text-phantom-muted ring-phantom-line',
  },
  regulatory_document: {
    label: 'Szabályozási dokumentum',
    badgeClassName: 'bg-phantom-danger-soft text-phantom-danger-text ring-phantom-danger-border',
  },
  other: {
    label: 'Egyéb dokumentum',
    badgeClassName: 'bg-phantom-surface-muted text-phantom-muted ring-phantom-line',
  },
}

const ACCEPTED_EXTENSIONS = new Set(['pdf', 'docx'])
const MAX_DISPLAY_CONFIDENCE_PERCENT = 99

export const MIN_ACCEPTED_CLASSIFICATION_CONFIDENCE = 0.8

const GENERATED_REPORT_FILENAME_PATTERNS = [
  /tp[\W_]*report/i,
  /report[\W_]*tp/i,
  /megfelel.{0,16}jelent/is,
  /tp[\W_]*megfelel/i,
  /redlinephantom/i,
  /nectar[\W_]*tp[\W_]*report/i,
]

export function getDocumentTypeDisplay(detectedType: string): DocumentTypeDisplay {
  return DOCUMENT_TYPE_DISPLAY[detectedType] ?? DOCUMENT_TYPE_DISPLAY.other
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isSupportedDocument(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ACCEPTED_EXTENSIONS.has(extension) && file.size > 0
}

function normalizeFilenameForMatch(filename: string): string {
  return filename
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function isGeneratedReportFilename(filename: string): boolean {
  const normalized = normalizeFilenameForMatch(filename)
  return GENERATED_REPORT_FILENAME_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function isClassificationConfidenceAccepted(confidence: number): boolean {
  return confidence >= MIN_ACCEPTED_CLASSIFICATION_CONFIDENCE
}

export function formatConfidencePercent(confidence: number): number {
  const rounded = Math.round(confidence * 100)
  return Math.min(Math.max(rounded, 0), MAX_DISPLAY_CONFIDENCE_PERCENT)
}

export function formatAcceptedConfidencePercent(confidence: number): number {
  return isClassificationConfidenceAccepted(confidence) ? 100 : formatConfidencePercent(confidence)
}