import type { PDFDocumentProxy } from 'pdfjs-dist'

// Maps legal source filenames to publicly served ruleset PDFs.
// Files live under `app/frontend/public/rulesets/` and are served by Vite at
// `/rulesets/<filename>`.

const LEGAL_PDF_MAP: Readonly<Record<string, string>> = {
  'oecd_tpg_2022_en.pdf': '/rulesets/oecd_tpg_2022_en.pdf',
  'hu_ngm_decree_45_2025.pdf': '/rulesets/hu_ngm_decree_45_2025.pdf',
  'hu_act_lxxxi_1996_tao.pdf': '/rulesets/hu_act_lxxxi_1996_tao.pdf',
  'hu_magyar_kozlony_2025_157.pdf': '/rulesets/hu_magyar_kozlony_2025_157.pdf',
  'hu_nav_corporate_tax_info_booklet_41_2026.pdf': '/rulesets/hu_nav_corporate_tax_info_booklet_41_2026.pdf',
  'hu_nav_transfer_pricing_data_service_guide.pdf': '/rulesets/hu_nav_transfer_pricing_data_service_guide.pdf',
  'oecd_transfer_pricing_guidelines_2010_hu.pdf': '/rulesets/oecd_transfer_pricing_guidelines_2010_hu.pdf',
}

export function resolveLegalPdfUrl(filename: string): string | null {
  return LEGAL_PDF_MAP[filename] ?? null
}

// ---------------------------------------------------------------------------
// Section-level page map
// Each entry: [referencePrefix, 0-based page, highlightHint]
// Sorted descending by prefix length so the longest match wins.
// Page numbers are approximate based on the published 2022 edition structure.
// ---------------------------------------------------------------------------

type SectionEntry = readonly [string, number, string]

const LEGAL_SECTION_PAGE_MAP: readonly SectionEntry[] = [
  // -------------------------------------------------------------------------
  // OECD TPG 2022
  // Chapter I: The Arm's Length Principle (pp. 17-68)
  // -------------------------------------------------------------------------
  // Sub-section entries (most specific → longest prefix wins)
  ['OECD_TPG_2022.Ch_I.D.1', 30, 'D.1'],
  ['OECD_TPG_2022.Ch_I.D.2', 34, 'D.2'],
  ['OECD_TPG_2022.Ch_I.D.3', 38, 'D.3'],
  ['OECD_TPG_2022.Ch_I.D', 30, 'D.'],
  ['OECD_TPG_2022.Ch_I.C', 25, 'C.'],
  ['OECD_TPG_2022.Ch_I.B', 19, 'B.'],
  ['OECD_TPG_2022.Ch_I.A', 17, 'A.'],
  // Paragraph-level entries actually used in HIG mock findings
  ['OECD_TPG_2022.para_1.51-1.106', 33, '1.51'],
  ['OECD_TPG_2022.para_1.106', 58, '1.106'],
  ['OECD_TPG_2022.para_1.60', 35, '1.60'],
  ['OECD_TPG_2022.para_1.51', 33, '1.51'],
  ['OECD_TPG_2022.para_1.36', 26, '1.36'],
  ['OECD_TPG_2022.para_1.10', 20, '1.10'],
  ['OECD_TPG_2022.para_1.1', 17, '1.1'],
  // Chapter catch-all: "para_1" prefix — next char in "para_1.X" is "." → non-word → matches
  ['OECD_TPG_2022.para_1', 17, 'Chapter I'],
  ['OECD_TPG_2022.Ch_I', 16, 'Chapter I'],
  // -------------------------------------------------------------------------
  // Chapter II: Transfer Pricing Methods (pp. 69-94)
  // -------------------------------------------------------------------------
  ['OECD_TPG_2022.Ch_II.C', 78, 'C.'],
  ['OECD_TPG_2022.Ch_II.B', 72, 'B.'],
  ['OECD_TPG_2022.Ch_II.A', 69, 'A.'],
  // HIG mock: OECD TPG 2.59 (consistency between methods)
  ['OECD_TPG_2022.para_2.59', 90, '2.59'],
  // Chapter catch-all
  ['OECD_TPG_2022.para_2', 69, 'Chapter II'],
  ['OECD_TPG_2022.Ch_II', 68, 'Chapter II'],
  // -------------------------------------------------------------------------
  // Chapter III: Comparability Analysis (pp. 95-120)
  // -------------------------------------------------------------------------
  ['OECD_TPG_2022.Ch_III.D', 110, 'D.'],
  ['OECD_TPG_2022.Ch_III.C', 105, 'C.'],
  ['OECD_TPG_2022.Ch_III.B', 100, 'B.'],
  ['OECD_TPG_2022.Ch_III.A', 95, 'A.'],
  // HIG mock: para_3.57 (IQR lower quartile), para_3.62 (median / conclusion)
  ['OECD_TPG_2022.para_3.62', 118, '3.62'],
  ['OECD_TPG_2022.para_3.57', 116, '3.57'],
  // Chapter catch-all
  ['OECD_TPG_2022.para_3', 95, 'Chapter III'],
  ['OECD_TPG_2022.Ch_III', 94, 'Chapter III'],
  // -------------------------------------------------------------------------
  // Chapter IV: Administrative Approaches (pp. 121-160)
  // -------------------------------------------------------------------------
  ['OECD_TPG_2022.para_4', 121, 'Chapter IV'],
  ['OECD_TPG_2022.Ch_IV', 120, 'Chapter IV'],
  // -------------------------------------------------------------------------
  // Chapter V: Documentation (pp. 161-181)
  // -------------------------------------------------------------------------
  ['OECD_TPG_2022.para_5', 161, 'Chapter V'],
  ['OECD_TPG_2022.Ch_V', 160, 'Chapter V'],
  // -------------------------------------------------------------------------
  // Chapter VI: Intangibles (pp. 183-248)
  // -------------------------------------------------------------------------
  ['OECD_TPG_2022.Ch_VI.D', 244, 'D.'],
  ['OECD_TPG_2022.Ch_VI.C', 238, 'C.'],
  ['OECD_TPG_2022.Ch_VI.B.2', 231, 'B.2'],
  ['OECD_TPG_2022.Ch_VI.B.1', 220, 'B.1'],
  ['OECD_TPG_2022.Ch_VI.B', 220, 'B.'],
  ['OECD_TPG_2022.Ch_VI.A', 184, 'A.'],
  // HIG mock: para_6.32-6.56 (DEMPE analysis paragraphs)
  ['OECD_TPG_2022.para_6.32-6.56', 199, '6.32'],
  ['OECD_TPG_2022.para_6.32', 199, '6.32'],
  ['BEPS_Actions_8-10', 199, '6.32'],
  // Chapter catch-all
  ['OECD_TPG_2022.para_6', 183, 'Chapter VI'],
  ['OECD_TPG_2022.Ch_VI', 182, 'Chapter VI'],
  // -------------------------------------------------------------------------
  // Chapter VII: Services (pp. 249-280)
  // -------------------------------------------------------------------------
  ['OECD_TPG_2022.Ch_VII.D', 266, 'D.'],
  ['OECD_TPG_2022.Ch_VII.C', 261, 'C.'],
  ['OECD_TPG_2022.Ch_VII.B', 254, 'B.'],
  ['OECD_TPG_2022.Ch_VII.A', 249, 'A.'],
  // HIG mock: para_7.6-7.8 (benefit test), para_7.14-7.15 (specific services)
  ['OECD_TPG_2022.para_7.14-7.15', 261, '7.14'],
  ['OECD_TPG_2022.para_7.6-7.8', 253, '7.6'],
  ['OECD_TPG_2022.para_7.14', 261, '7.14'],
  ['OECD_TPG_2022.para_7.6', 253, '7.6'],
  // Chapter catch-all
  ['OECD_TPG_2022.para_7', 249, 'Chapter VII'],
  ['OECD_TPG_2022.Ch_VII', 248, 'Chapter VII'],
  // -------------------------------------------------------------------------
  // Chapter VIII: Cost Contribution Arrangements (pp. 281-322)
  // -------------------------------------------------------------------------
  ['OECD_TPG_2022.para_8', 281, 'Chapter VIII'],
  ['OECD_TPG_2022.Ch_VIII', 280, 'Chapter VIII'],
  // -------------------------------------------------------------------------
  // Chapter IX: Business Restructurings (pp. 323-382)
  // -------------------------------------------------------------------------
  ['OECD_TPG_2022.para_9', 323, 'Chapter IX'],
  ['OECD_TPG_2022.Ch_IX', 322, 'Chapter IX'],
  // -------------------------------------------------------------------------
  // 32/2017 NGM rendelet
  // -------------------------------------------------------------------------
  ['NGM_32_2017.section_8', 8, '8. §'],
  ['NGM_32_2017.section_7', 6, '7. §'],
  ['NGM_32_2017.section_6', 5, '6. §'],
  ['NGM_32_2017.section_5', 4, '5. §'],
  ['NGM_32_2017.section_4', 3, '4. §'],
  ['NGM_32_2017.section_3', 2, '3. §'],
  ['NGM_32_2017.section_2', 1, '2. §'],
  ['NGM_32_2017.section_1', 0, '1. §'],
  // -------------------------------------------------------------------------
  // 45/2025 NGM rendelet — both section_ and bare-numeric variants
  // -------------------------------------------------------------------------
  ['45_2025_NGM.section_8', 8, '8. §'],
  ['45_2025_NGM.section_7', 6, '7. §'],
  ['45_2025_NGM.section_6', 5, '6. §'],
  ['45_2025_NGM.section_5', 4, '5. §'],
  ['45_2025_NGM.section_4', 3, '4. §'],
  ['45_2025_NGM.section_3', 2, '3. §'],
  ['45_2025_NGM.section_2', 1, '2. §'],
  ['45_2025_NGM.section_1', 0, '1. §'],
  ['45_2025_NGM.8', 8, '8. §'],
  ['45_2025_NGM.7', 6, '7. §'],
  ['45_2025_NGM.6', 5, '6. §'],
  ['45_2025_NGM.5', 4, '5. §'],
  ['45_2025_NGM.4', 3, '4. §'],
  ['45_2025_NGM.3', 2, '3. §'],
  ['45_2025_NGM.2', 1, '2. §'],
  ['45_2025_NGM.1', 0, '1. §'],
  // -------------------------------------------------------------------------
  // HU Act LXXXI/1996 — accept both with and without § sign
  // -------------------------------------------------------------------------
  ['HU_Act_LXXXI_1996.§31_B', 30, '31/B. §'],
  ['HU_Act_LXXXI_1996.31_B', 30, '31/B. §'],
  ['HU_Act_LXXXI_1996.§28', 27, '28. §'],
  ['HU_Act_LXXXI_1996.28', 27, '28. §'],
  ['HU_Act_LXXXI_1996.§18', 17, '18. §'],
  ['HU_Act_LXXXI_1996.18', 17, '18. §'],
  // -------------------------------------------------------------------------
  // Additional catalog-backed official sources
  // -------------------------------------------------------------------------
  ['HU_MAGYAR_KOZLONY_2025_157.ngm_45_header', 3, '45/2025. (XII. 23.) NGM'],
  ['HU_MAGYAR_KOZLONY_2025_157.tp_scope', 4, '45/2025. NGM'],
  ['NAV_TP_DATA_SERVICE_GUIDE_2024.tp_method', 23, '8.6.'],
  ['NAV_TP_DATA_SERVICE_GUIDE_2024.tested_party', 25, '8.7.'],
  ['NAV_TP_DATA_SERVICE_GUIDE_2024.transaction_labels', 8, '8.'],
  ['NAV_TP_DATA_SERVICE_GUIDE_2024.exemptions', 5, '6.'],
  ['NAV_TP_DATA_SERVICE_GUIDE_2024.obligation', 2, '1.'],
  ['NAV_INFO_BOOKLET_41_TAO_2026.adjustment', 17, '7.'],
  ['NAV_INFO_BOOKLET_41_TAO_2026.arm_length', 16, '7.'],
  ['NAV_INFO_BOOKLET_41_TAO_2026.tax_rate', 26, '10.'],
  ['OECD_TPG_2010_HU.CH_V', 9, 'V. fejezet'],
  ['OECD_TPG_2010_HU.CH_II', 6, 'II. fejezet'],
  ['OECD_TPG_2010_HU.CH_I', 5, 'I. fejezet'],
]

// ---------------------------------------------------------------------------
// Prefix-based mapping for legal reference codes to canonical PDF filenames.
// The longest matching prefix wins.
// Includes BOTH conventional orderings (45_2025_NGM and NGM_45_2025) plus
// trailing-suffix variants the LLM occasionally emits (`_rendelet`).
// ---------------------------------------------------------------------------

const LEGAL_REFERENCE_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ['OECD_TPG_2022', 'oecd_tpg_2022_en.pdf'],
  ['BEPS_Actions_8-10', 'oecd_tpg_2022_en.pdf'],
  ['BEPS_Actions_8_10', 'oecd_tpg_2022_en.pdf'],
  ['NGM_32_2017', '32_2017_NGM.pdf'],
  ['32_2017_NGM', '32_2017_NGM.pdf'],
  ['HU_NGM_DECREE_45_2025', 'hu_ngm_decree_45_2025.pdf'],
  ['NGM_45_2025', 'hu_ngm_decree_45_2025.pdf'],
  ['45_2025_NGM_rendelet', 'hu_ngm_decree_45_2025.pdf'],
  ['45_2025_NGM', 'hu_ngm_decree_45_2025.pdf'],
  ['HU_TAO_ACT_1996_LXXXI', 'hu_act_lxxxi_1996_tao.pdf'],
  ['HU_Act_LXXXI_1996', 'hu_act_lxxxi_1996_tao.pdf'],
  ['Tao_tv', 'hu_act_lxxxi_1996_tao.pdf'],
  ['HU_Act_LXXXI', 'hu_act_lxxxi_1996_tao.pdf'],
  ['HU_MAGYAR_KOZLONY_2025_157', 'hu_magyar_kozlony_2025_157.pdf'],
  ['HU_GAZETTE_2025_157', 'hu_magyar_kozlony_2025_157.pdf'],
  ['MK_25_157', 'hu_magyar_kozlony_2025_157.pdf'],
  ['HU_NAV_TP_DATA_SERVICE_GUIDE_2024', 'hu_nav_transfer_pricing_data_service_guide.pdf'],
  ['NAV_TP_DATA_SERVICE_GUIDE_2024', 'hu_nav_transfer_pricing_data_service_guide.pdf'],
  ['PM_tajekoztato_TPadatszolg', 'hu_nav_transfer_pricing_data_service_guide.pdf'],
  ['HU_NAV_INFO_BOOKLET_41_TAO_2026', 'hu_nav_corporate_tax_info_booklet_41_2026.pdf'],
  ['NAV_INFO_BOOKLET_41_TAO_2026', 'hu_nav_corporate_tax_info_booklet_41_2026.pdf'],
  ['OECD_TPG_2010_HU', 'oecd_transfer_pricing_guidelines_2010_hu.pdf'],
  ['OECD_TP_GUIDELINES_HU', 'oecd_transfer_pricing_guidelines_2010_hu.pdf'],
]

function replaceEvery(value: string, search: string, replacement: string): string {
  return value.split(search).join(replacement)
}

function normalizeLegalReference(reference: string): string {
  const normalizedReference = reference
    .trim()
    .replace(/^32_2017_NGM(?:_rendelet)?/, 'NGM_32_2017')
    .replace(/^45_2025_NGM(?:_rendelet)?/, '45_2025_NGM')

  return replaceEvery(
    replaceEvery(normalizedReference, '.Sec_', '.section_'),
    '.Section_',
    '.section_',
  )
}

export interface LegalReferenceTarget {
  readonly filename: string
  readonly label: string
  /** 0-based target page (best-effort from section map, falls back to 0) */
  readonly page: number
  /** Short text hint passed as quote to trigger keyword highlighting in the PDF viewer */
  readonly highlightHint: string | null
}

// Word-boundary–aware "startsWith" so that, e.g., the prefix
// "OECD_TPG_2022.Ch_V" does NOT incorrectly match "OECD_TPG_2022.Ch_VI"
// (the next char "I" is a word char, breaking the boundary).  Underscores
// and punctuation count as boundaries because the agent uses them as
// section separators ("45_2025_NGM.4_1" vs prefix "45_2025_NGM.4").
function _startsWithBoundary(s: string, prefix: string): boolean {
  if (!s.startsWith(prefix)) return false
  if (s.length === prefix.length) return true
  const code = s.codePointAt(prefix.length) ?? 0
  const isWordChar =
    (code >= 0x30 && code <= 0x39) || // 0-9
    (code >= 0x41 && code <= 0x5a) || // A-Z
    (code >= 0x61 && code <= 0x7a) // a-z
  return !isWordChar
}

function resolvePageForReference(reference: string): { page: number; hint: string | null } {
  // Iterate length-DESC so the longest valid prefix wins.  Without sorting
  // here we'd be at the mercy of the array's hand-maintained order.
  const entries = [...LEGAL_SECTION_PAGE_MAP].sort(
    (a, b) => b[0].length - a[0].length,
  )
  for (const [prefix, page, hint] of entries) {
    if (_startsWithBoundary(reference, prefix)) {
      return { page, hint: hint.length > 0 ? hint : null }
    }
  }
  return { page: 0, hint: null }
}

// ---------------------------------------------------------------------------
// Natural-language reference matcher
//
// The LLM occasionally emits human-readable citations like
//   "45/2025. (XII. 23.) NGM rendelet 6. §"
//   "1996. évi LXXXI. törvény 31/B. §"
//   "OECD TPG 2022 Ch.VI.B.1"
//   "32/2017 NGM rendelet 4. § (2)"
// instead of the canonical token form. None of those `startsWith` any
// `LEGAL_REFERENCE_PREFIXES` entry, so without this fallback the badge
// silently degrades to a non-clickable element.
//
// The matcher is conservative: it only fires when a strong document
// signature is present, then attempts to extract the section number to
// resolve the precise page. Returning null falls back to the canonical
// prefix matcher above (which itself falls back to no resolution).
// ---------------------------------------------------------------------------

interface NaturalSignature {
  readonly canonicalFilename: string
  readonly canonicalPrefix: string
  readonly signatures: readonly RegExp[]
  readonly extractSection: (raw: string) => string | null
}

const ROMAN_BY_ARABIC: Readonly<Record<string, string>> = {
  '1': 'I',
  '2': 'II',
  '3': 'III',
  '4': 'IV',
  '5': 'V',
  '6': 'VI',
  '7': 'VII',
  '8': 'VIII',
  '9': 'IX',
}

function normalizeChapterToken(value: string): string {
  const trimmed = value.trim().toUpperCase()
  return ROMAN_BY_ARABIC[trimmed] ?? trimmed
}

function normalizeRangeDash(value: string): string {
  return value.replace(/[–—]/g, '-')
}

function extractOecdSection(raw: string): string | null {
  const normalized = normalizeRangeDash(raw).replace(/\bparagraphs?\b/gi, 'para')
  const para = /\bparas?\.?\s*([0-9.]+)(?:\s*-\s*([0-9.]+))?/i.exec(normalized)
  if (para) return para[2] ? `para_${para[1]}-${para[2]}` : `para_${para[1]}`

  const bareTpgPara = /\bOECD\b.*\bTPG\b\s*([0-9.]+)(?:\s*-\s*([0-9.]+))?/i.exec(normalized)
  if (bareTpgPara) {
    return bareTpgPara[2]
      ? `para_${bareTpgPara[1]}-${bareTpgPara[2]}`
      : `para_${bareTpgPara[1]}`
  }

  const chapter = /Ch(?:apter)?\.?\s*(\d+|[IVX]+)(?:\.([A-Z](?:\.\d+)?))?/i.exec(normalized)
  if (chapter) {
    const chapterToken = normalizeChapterToken(chapter[1])
    return chapter[2] ? `Ch_${chapterToken}.${chapter[2]}` : `Ch_${chapterToken}`
  }

  return null
}

const NATURAL_LANGUAGE_SIGNATURES: readonly NaturalSignature[] = [
  {
    canonicalFilename: 'hu_ngm_decree_45_2025.pdf',
    canonicalPrefix: '45_2025_NGM',
    signatures: [
      /\b45[\s./_-]*2025\b/i,
      /\(XII\.\s*23\.\)\s*NGM/i,
    ],
    extractSection: (raw) => {
      const m = /(\d{1,2})\.?\s*§/.exec(raw)
      return m ? `section_${m[1]}` : null
    },
  },
  {
    canonicalFilename: '32_2017_NGM.pdf',
    canonicalPrefix: 'NGM_32_2017',
    signatures: [/\b32[\s./_-]*2017\b/i],
    extractSection: (raw) => {
      const m = /(\d{1,2})\.?\s*§/.exec(raw)
      return m ? `section_${m[1]}` : null
    },
  },
  {
    canonicalFilename: 'hu_act_lxxxi_1996_tao.pdf',
    canonicalPrefix: 'HU_Act_LXXXI_1996',
    signatures: [
      /1996\.?\s*évi\s*LXXXI/i,
      /\bLXXXI\b.*\btörvény\b/i,
      /\bTao\s*tv/i,
    ],
    extractSection: (raw) => {
      const m = /(\d{1,3}(?:\/[A-Z])?)\s*\.?\s*§/.exec(raw)
      // Normalise slash so "31/B" reaches the canonical "§31_B" entry.
      return m ? `§${m[1].replace('/', '_')}` : null
    },
  },
  {
    canonicalFilename: 'oecd_tpg_2022_en.pdf',
    canonicalPrefix: 'OECD_TPG_2022',
    signatures: [/\bOECD\b.*\bTPG\b/i, /\bOECD\b.*\bTransfer\s*Pric/i],
    extractSection: extractOecdSection,
  },
  {
    canonicalFilename: 'oecd_tpg_2022_en.pdf',
    canonicalPrefix: 'BEPS_Actions_8-10',
    signatures: [/\bBEPS\b.*\bActions?\b.*\b8\b.*\b10\b/i],
    extractSection: () => null,
  },
]

function resolveFromNaturalLanguage(reference: string): LegalReferenceTarget | null {
  for (const sig of NATURAL_LANGUAGE_SIGNATURES) {
    if (!sig.signatures.some((rx) => rx.test(reference))) {
      continue
    }
    const section = sig.extractSection(reference)
    const canonicalToken = section ? `${sig.canonicalPrefix}.${section}` : sig.canonicalPrefix
    const { page, hint } = resolvePageForReference(canonicalToken)
    return {
      filename: sig.canonicalFilename,
      label: reference,
      page,
      highlightHint: hint,
    }
  }
  return null
}

export function resolveLegalReference(reference: string): LegalReferenceTarget | null {
  const trimmed = reference.trim()
  if (!trimmed) return null

  // Normalize prefix variants the LLM may emit (e.g. "32_2017_NGM" → "NGM_32_2017")
  const normalized = normalizeLegalReference(trimmed)

  // Path 1: canonical token form (e.g. "OECD_TPG_2022.Ch_VI.B.1").
  for (const [prefix, filename] of LEGAL_REFERENCE_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      const { page, hint } = resolvePageForReference(normalized)
      return { filename, label: trimmed, page, highlightHint: hint }
    }
  }

  // Path 2: natural-language fallback (e.g. "45/2025. (XII. 23.) NGM rendelet 6. §").
  return resolveFromNaturalLanguage(trimmed)
}

// ---------------------------------------------------------------------------
// Outline-based navigation helpers
// ---------------------------------------------------------------------------

/**
 * Converts a legal reference label to a short search token used when matching
 * against PDF outline (bookmark) titles.
 *   "OECD_TPG_2022.Ch_I.D.1"   → "D.1."
 *   "OECD_TPG_2022.para_1.60"  → "1.60"
 *   "OECD_TPG_2022.Ch_VI"      → "Chapter VI"
 *   "NGM_32_2017.section_4(2)" → "4. §"
 */
export function extractSectionSearchHint(label: string): string {
  const dot = label.indexOf('.')
  if (dot === -1) return label
  const fragment = label.slice(dot + 1)

  const chapterWithSub = /^Ch_([IVX]+)\.(.+)$/.exec(fragment)
  if (chapterWithSub) return chapterWithSub[2].replace(/_/g, '.') + '.'

  const chapter = /^Ch_([IVX]+)$/.exec(fragment)
  if (chapter) return `Chapter ${chapter[1]}`

  const para = /^para_(\d+\.\d+)/.exec(fragment)
  if (para) return para[1]

  const section = /^(?:section_)?(\d+)/.exec(fragment)
  if (section) return `${section[1]}. §`

  const huSection = /^§?(\d+)(?:_([A-Z]))?/.exec(fragment)
  if (huSection) return huSection[2] ? `${huSection[1]}/${huSection[2]}. §` : `${huSection[1]}. §`

  return fragment.replace(/_/g, ' ')
}

type OutlineNode = {
  readonly title: string
  readonly dest: unknown
  readonly items: readonly OutlineNode[]
}

/**
 * Extracts the PDF bookmark tree into a flat `title → 0-based page index` map
 * by calling pdfjs `getOutline()` and resolving each destination to a page index.
 * Returns an empty map when the PDF has no outline or resolution fails.
 */
export async function buildOutlinePageMap(
  pdf: PDFDocumentProxy,
): Promise<Map<string, number>> {
  const map = new Map<string, number>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfAny = pdf as any
  let outline: OutlineNode[] | null = null
  try {
    outline = (await pdfAny.getOutline()) as OutlineNode[] | null
  } catch {
    return map
  }
  if (!outline) return map

  async function visit(node: OutlineNode): Promise<void> {
    const title = node.title?.trim()
    try {
      let dest = node.dest
      if (typeof dest === 'string') dest = await pdfAny.getDestination(dest)
      if (Array.isArray(dest) && dest.length > 0) {
        const ref = dest[0] as { num: number; gen: number }
        if (typeof ref?.num === 'number') {
          const pageIndex = (await pdfAny.getPageIndex(ref)) as number
          if (title) map.set(title, pageIndex)
        }
      }
    } catch {
      // Skip entries with unresolvable destinations
    }
    if (Array.isArray(node.items)) {
      await Promise.all(node.items.map(visit))
    }
  }

  await Promise.all(outline.map(visit))
  return map
}

/**
 * Matches a citation label against the outline page map using 4-tier fallback:
 * 1. Exact title match (case-insensitive)
 * 2. Title starts with the search hint + word boundary
 * 3. Title contains the hint surrounded by non-alphanumeric chars
 * 4. Roman numeral chapter alternate forms
 *
 * Returns the 0-based page index, or null if no match found.
 */
export function matchLabelToOutlinePage(
  label: string,
  map: Map<string, number>,
): number | null {
  if (map.size === 0) return null
  const hint = extractSectionSearchHint(label).toLowerCase().trim()
  if (!hint) return null

  return (
    findExactOutlinePage(hint, map) ??
    findPrefixOutlinePage(hint, map) ??
    findContainedOutlinePage(hint, map) ??
    findRomanChapterOutlinePage(hint, map)
  )
}

function findExactOutlinePage(hint: string, map: Map<string, number>): number | null {
  for (const [title, page] of map) {
    if (title.toLowerCase().trim() === hint) return page
  }
  return null
}

function findPrefixOutlinePage(hint: string, map: Map<string, number>): number | null {
  for (const [title, page] of map) {
    const t = title.toLowerCase().trim()
    if (t.startsWith(hint)) {
      const next = t[hint.length]
      if (next === undefined || next === ' ' || next === '.' || next === ':') return page
    }
  }
  return null
}

function findContainedOutlinePage(hint: string, map: Map<string, number>): number | null {
  const escaped = hint.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`)
  const re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i')
  for (const [title, page] of map) {
    if (re.test(title)) return page
  }
  return null
}

function findRomanChapterOutlinePage(hint: string, map: Map<string, number>): number | null {
  const ch = /^chapter\s+([ivx]+)$/i.exec(hint)
  if (!ch) return null

  const num = ch[1].toUpperCase()
  for (const [title, page] of map) {
    const t = title.trim()
    if (t === num || t.startsWith(`${num}.`) || t.startsWith(`${num} `)) return page
  }
  return null
}
