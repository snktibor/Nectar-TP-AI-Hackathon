export interface DocumentTypeDisplay {
  label: string
  badgeClassName: string
}

export const DOCUMENT_TYPE_DISPLAY: Record<string, DocumentTypeDisplay> = {
  master_file: {
    label: 'Fő Fájl',
    badgeClassName: 'bg-blue-50 text-blue-700 ring-phantom-line',
  },
  local_file: {
    label: 'Helyi Fájl',
    badgeClassName: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  },
  benchmark_study: {
    label: 'Benchmark tanulmány',
    badgeClassName: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  },
  contract: {
    label: 'Szerződés',
    badgeClassName: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  },
  invoice: {
    label: 'Számla',
    badgeClassName: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  },
  financial_statement: {
    label: 'Pénzügyi dokumentum',
    badgeClassName: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  },
  regulatory_document: {
    label: 'Szabályozási dokumentum',
    badgeClassName: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  },
  other: {
    label: 'Egyéb dokumentum',
    badgeClassName: 'bg-gray-50 text-gray-700 ring-gray-600/20',
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