// Maps legal source filenames to publicly served ruleset PDFs.
// Files live under `app/frontend/public/rulesets/` and are served by Vite at
// `/rulesets/<filename>`.

const LEGAL_PDF_MAP: Readonly<Record<string, string>> = {
  'OECD_TPG_2022.pdf': '/rulesets/OECD_TPG_2022.pdf',
  '32_2017_NGM.pdf': '/rulesets/32_2017_NGM.pdf',
  '45_2025_NGM.pdf': '/rulesets/45_2025_NGM.pdf',
  'HU_Act_LXXXI_1996.pdf': '/rulesets/HU_Act_LXXXI_1996.pdf',
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
  // OECD TPG 2022 — Chapter I: The Arm's Length Principle (pp. 17-67)
  ['OECD_TPG_2022.Ch_I.D.1', 30, 'D.1'],
  ['OECD_TPG_2022.Ch_I.D.2', 33, 'D.2'],
  ['OECD_TPG_2022.Ch_I.D.3', 36, 'D.3'],
  ['OECD_TPG_2022.Ch_I.D', 30, 'D.'],
  ['OECD_TPG_2022.Ch_I.C', 25, 'C.'],
  ['OECD_TPG_2022.Ch_I.B', 19, 'B.'],
  ['OECD_TPG_2022.Ch_I.A', 17, 'A.'],
  ['OECD_TPG_2022.para_1.106', 42, '1.106'],
  ['OECD_TPG_2022.para_1.51-1.106', 27, '1.51'],
  ['OECD_TPG_2022.para_1.60', 29, '1.60'],
  ['OECD_TPG_2022.para_1.51', 27, '1.51'],
  ['OECD_TPG_2022.para_1.36', 23, '1.36'],
  ['OECD_TPG_2022.para_1.1', 16, '1.1'],
  ['OECD_TPG_2022.Ch_I', 16, 'Chapter I'],
  // OECD TPG 2022 — Chapter II: Transfer Pricing Methods (pp. 69-93)
  ['OECD_TPG_2022.Ch_II.C', 78, 'C.'],
  ['OECD_TPG_2022.Ch_II.B', 72, 'B.'],
  ['OECD_TPG_2022.Ch_II.A', 69, 'A.'],
  ['OECD_TPG_2022.Ch_II', 68, 'Chapter II'],
  // OECD TPG 2022 — Chapter III: Comparability Analysis (pp. 95-119)
  ['OECD_TPG_2022.Ch_III.D', 110, 'D.'],
  ['OECD_TPG_2022.Ch_III.C', 105, 'C.'],
  ['OECD_TPG_2022.Ch_III.B', 100, 'B.'],
  ['OECD_TPG_2022.Ch_III.A', 95, 'A.'],
  ['OECD_TPG_2022.Ch_III', 94, 'Chapter III'],
  // OECD TPG 2022 — Chapter IV: Administrative Approaches (pp. 121-159)
  ['OECD_TPG_2022.Ch_IV', 120, 'Chapter IV'],
  // OECD TPG 2022 — Chapter V: Documentation (pp. 161-181)
  ['OECD_TPG_2022.Ch_V', 160, 'Chapter V'],
  // OECD TPG 2022 — Chapter VI: Intangibles (pp. 183-247)
  ['OECD_TPG_2022.Ch_VI.D', 250, 'D.'],
  ['OECD_TPG_2022.Ch_VI.C', 245, 'C.'],
  ['OECD_TPG_2022.Ch_VI.B.2', 248, 'B.2'],
  ['OECD_TPG_2022.Ch_VI.B.1', 242, 'B.1'],
  ['OECD_TPG_2022.Ch_VI.B', 241, 'B.'],
  ['OECD_TPG_2022.Ch_VI.A', 237, 'A.'],
  ['OECD_TPG_2022.Ch_VI', 236, 'Chapter VI'],
  // OECD TPG 2022 — Chapter VII: Services (pp. 249-281)
  ['OECD_TPG_2022.Ch_VII.D', 264, 'D.'],
  ['OECD_TPG_2022.Ch_VII.C', 259, 'C.'],
  ['OECD_TPG_2022.Ch_VII.B', 252, 'B.'],
  ['OECD_TPG_2022.Ch_VII.A', 250, 'A.'],
  ['OECD_TPG_2022.Ch_VII', 248, 'Chapter VII'],
  // OECD TPG 2022 — Chapter VIII: Cost Contribution Arrangements (pp. 283-321)
  ['OECD_TPG_2022.Ch_VIII', 282, 'Chapter VIII'],
  // OECD TPG 2022 — Chapter IX: Business Restructurings (pp. 323-382)
  ['OECD_TPG_2022.Ch_IX', 324, 'Chapter IX'],
  // OECD TPG 2022 — catch-all for any unmatched para_X.Y
  ['OECD_TPG_2022.para_', 16, ''],
  // 32/2017 NGM rendelet (small document ~10 pages)
  ['NGM_32_2017.section_8', 8, '8. §'],
  ['NGM_32_2017.section_7', 6, '7. §'],
  ['NGM_32_2017.section_6', 5, '6. §'],
  ['NGM_32_2017.section_5', 4, '5. §'],
  ['NGM_32_2017.section_4', 3, '4. §'],
  ['NGM_32_2017.section_3', 2, '3. §'],
  ['NGM_32_2017.section_2', 1, '2. §'],
  ['NGM_32_2017.section_1', 0, '1. §'],
  // 45/2025 NGM rendelet — sections, with both naming variants emitted by the LLM
  ['45_2025_NGM.section_8', 8, '8. §'],
  ['45_2025_NGM.section_7', 6, '7. §'],
  ['45_2025_NGM.section_6', 5, '6. §'],
  ['45_2025_NGM.section_5', 4, '5. §'],
  ['45_2025_NGM.section_4', 3, '4. §'],
  ['45_2025_NGM.section_3', 2, '3. §'],
  ['45_2025_NGM.section_2', 1, '2. §'],
  ['45_2025_NGM.section_1', 0, '1. §'],
  // 45/2025 — bare-numeric variant the agent sometimes emits ("45_2025_NGM.4_1", "45_2025_NGM.4_1_b")
  ['45_2025_NGM.8', 8, '8. §'],
  ['45_2025_NGM.7', 6, '7. §'],
  ['45_2025_NGM.6', 5, '6. §'],
  ['45_2025_NGM.5', 4, '5. §'],
  ['45_2025_NGM.4', 3, '4. §'],
  ['45_2025_NGM.3', 2, '3. §'],
  ['45_2025_NGM.2', 1, '2. §'],
  ['45_2025_NGM.1', 0, '1. §'],
  // HU Act LXXXI/1996 — accept both with and without § sign
  ['HU_Act_LXXXI_1996.§31_B', 30, '31/B. §'],
  ['HU_Act_LXXXI_1996.31_B', 30, '31/B. §'],
  ['HU_Act_LXXXI_1996.§28', 27, '28. §'],
  ['HU_Act_LXXXI_1996.28', 27, '28. §'],
  ['HU_Act_LXXXI_1996.§18', 17, '18. §'],
  ['HU_Act_LXXXI_1996.18', 17, '18. §'],
]

// ---------------------------------------------------------------------------
// Prefix-based mapping for legal reference codes to canonical PDF filenames.
// The longest matching prefix wins.
// Includes BOTH conventional orderings (45_2025_NGM and NGM_45_2025) plus
// trailing-suffix variants the LLM occasionally emits (`_rendelet`).
// ---------------------------------------------------------------------------

const LEGAL_REFERENCE_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ['OECD_TPG_2022', 'OECD_TPG_2022.pdf'],
  ['NGM_32_2017', '32_2017_NGM.pdf'],
  ['32_2017_NGM', '32_2017_NGM.pdf'],
  ['NGM_45_2025', '45_2025_NGM.pdf'],
  ['45_2025_NGM_rendelet', '45_2025_NGM.pdf'],
  ['45_2025_NGM', '45_2025_NGM.pdf'],
  ['HU_Act_LXXXI_1996', 'HU_Act_LXXXI_1996.pdf'],
  ['Tao_tv', 'HU_Act_LXXXI_1996.pdf'],
  ['HU_Act_LXXXI', 'HU_Act_LXXXI_1996.pdf'],
]

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
  const code = s.charCodeAt(prefix.length)
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

const NATURAL_LANGUAGE_SIGNATURES: readonly NaturalSignature[] = [
  {
    canonicalFilename: '45_2025_NGM.pdf',
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
    canonicalFilename: 'HU_Act_LXXXI_1996.pdf',
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
    canonicalFilename: 'OECD_TPG_2022.pdf',
    canonicalPrefix: 'OECD_TPG_2022',
    signatures: [/\bOECD\b.*\bTPG\b/i, /\bOECD\b.*\bTransfer\s*Pric/i],
    extractSection: (raw) => {
      const ch = /Ch(?:apter)?\.?\s*([IVX]+)(?:\.([A-Z](?:\.\d+)?))?/i.exec(raw)
      if (ch) {
        return ch[2] ? `Ch_${ch[1]}.${ch[2]}` : `Ch_${ch[1]}`
      }
      const para = /\bpara(?:graph)?\.?\s*(\d+(?:\.\d+)?)/i.exec(raw)
      if (para) return `para_${para[1]}`
      return null
    },
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

  // Path 1: canonical token form (e.g. "OECD_TPG_2022.Ch_VI.B.1").
  for (const [prefix, filename] of LEGAL_REFERENCE_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      const { page, hint } = resolvePageForReference(trimmed)
      return { filename, label: trimmed, page, highlightHint: hint }
    }
  }

  // Path 2: natural-language fallback (e.g. "45/2025. (XII. 23.) NGM rendelet 6. §").
  return resolveFromNaturalLanguage(trimmed)
}
