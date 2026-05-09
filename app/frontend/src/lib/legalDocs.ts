// Maps legal source filenames to publicly served ruleset PDFs.
// Files live under `app/frontend/public/rulesets/` and are served by Vite at
// `/rulesets/<filename>`.

const LEGAL_PDF_MAP: Readonly<Record<string, string>> = {
  'OECD_TPG_2022.pdf': '/rulesets/OECD_TPG_2022.pdf',
  '32_2017_NGM.pdf': '/rulesets/32_2017_NGM.pdf',
  'HU_Act_LXXXI_1996.pdf': '/rulesets/HU_Act_LXXXI_1996.pdf',
  // 45_2025_NGM.pdf is not yet available — citations will fall back to LegalTextPanel
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
  ['OECD_TPG_2022.para_1.51-1.106', 47, '1.51'],
  ['OECD_TPG_2022.para_1.106', 58, '1.106'],
  ['OECD_TPG_2022.para_1.60', 49, '1.60'],
  ['OECD_TPG_2022.para_1.51', 47, '1.51'],
  ['OECD_TPG_2022.para_1.36', 23, '1.36'],
  ['OECD_TPG_2022.para_1.1', 16, '1.1'],
  ['OECD_TPG_2022.Ch_I.D.1', 40, 'D.1'],
  ['OECD_TPG_2022.Ch_I.D.2', 47, 'D.1.2'],
  ['OECD_TPG_2022.Ch_I.D.3', 54, 'D.1.3'],
  ['OECD_TPG_2022.Ch_I.D', 40, 'D.'],
  ['OECD_TPG_2022.Ch_I.C', 25, 'C.'],
  ['OECD_TPG_2022.Ch_I.B', 19, 'B.'],
  ['OECD_TPG_2022.Ch_I.A', 17, 'A.'],
  ['OECD_TPG_2022.Ch_I', 16, 'Chapter I'],
  // OECD TPG 2022 — Chapter II: Transfer Pricing Methods (pp. 69-93)
  ['OECD_TPG_2022.Ch_II.C', 78, 'C.'],
  ['OECD_TPG_2022.Ch_II.B', 72, 'B.'],
  ['OECD_TPG_2022.Ch_II.A', 69, 'A.'],
  ['OECD_TPG_2022.Ch_II', 68, 'Chapter II'],
  // OECD TPG 2022 — Chapter III: Comparability Analysis (pp. 95-119)
  ['OECD_TPG_2022.para_3.62', 167, '3.62'],
  ['OECD_TPG_2022.para_3.57', 166, '3.57'],
  ['OECD_TPG_2022.Ch_III', 94, 'Chapter III'],
  // OECD TPG 2022 — Chapter IV: Administrative Approaches (pp. 121-159)
  ['OECD_TPG_2022.Ch_IV', 120, 'Chapter IV'],
  // OECD TPG 2022 — Chapter V: Documentation (pp. 161-181)
  ['OECD_TPG_2022.Ch_V', 160, 'Chapter V'],
  // OECD TPG 2022 — Chapter VI: Intangibles (pp. 183-247)
  ['OECD_TPG_2022.Ch_VI.B.2', 248, 'B.2'],
  ['OECD_TPG_2022.Ch_VI.B.1', 242, 'B.1'],
  ['OECD_TPG_2022.Ch_VI.B', 241, 'B.'],
  ['OECD_TPG_2022.Ch_VI.A', 237, 'A.'],
  ['OECD_TPG_2022.Ch_VI', 236, 'Chapter VI'],
  // OECD TPG 2022 — Chapter VII: Services (pp. 249-281)
  ['OECD_TPG_2022.Ch_VII', 276, 'Chapter VII'],
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
  // 45/2025 NGM rendelet — no PDF available yet, LegalTextPanel fallback
  ['45_2025_NGM.section_8', 8, '8. §'],
  ['45_2025_NGM.section_7', 6, '7. §'],
  ['45_2025_NGM.section_6', 5, '6. §'],
  ['45_2025_NGM.section_4', 3, '4. §'],
  ['45_2025_NGM.section_3', 2, '3. §'],
  ['45_2025_NGM.section_2', 1, '2. §'],
  // HU Act LXXXI/1996
  ['HU_Act_LXXXI_1996.§31_B', 30, '31/B. §'],
  ['HU_Act_LXXXI_1996.§28', 27, '28. §'],
  ['HU_Act_LXXXI_1996.§18', 17, '18. §'],
]

// ---------------------------------------------------------------------------
// Prefix-based mapping for legal reference codes to canonical PDF filenames.
// The longest matching prefix wins.
// ---------------------------------------------------------------------------

const LEGAL_REFERENCE_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ['OECD_TPG_2022', 'OECD_TPG_2022.pdf'],
  ['NGM_32_2017', '32_2017_NGM.pdf'],
  ['32_2017_NGM', '32_2017_NGM.pdf'],
  ['45_2025_NGM', '45_2025_NGM.pdf'],
  ['HU_Act_LXXXI_1996', 'HU_Act_LXXXI_1996.pdf'],
]

const FALLBACK_LEGAL_FILENAME = 'Jogszabalyi hivatkozas'

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

function resolvePageForReference(reference: string): { page: number; hint: string | null } {
  // Longest prefix match in the section map (entries already sorted by length desc above)
  for (const [prefix, page, hint] of LEGAL_SECTION_PAGE_MAP) {
    if (reference.startsWith(prefix)) {
      return { page, hint: hint.length > 0 ? hint : null }
    }
  }
  return { page: 0, hint: null }
}

export function resolveLegalReference(reference: string): LegalReferenceTarget | null {
  const normalizedReference = normalizeLegalReference(reference)
  if (!normalizedReference) return null

  for (const [prefix, filename] of LEGAL_REFERENCE_PREFIXES) {
    if (normalizedReference.startsWith(prefix)) {
      const { page, hint } = resolvePageForReference(normalizedReference)
      return { filename, label: reference, page, highlightHint: hint }
    }
  }

  return {
    filename: FALLBACK_LEGAL_FILENAME,
    label: reference,
    page: 0,
    highlightHint: reference,
  }
}
