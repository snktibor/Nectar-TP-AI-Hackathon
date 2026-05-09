// Maps legal source filenames (as they appear in audit fixture / backend
// findings with source_kind="legal") to publicly served ruleset PDFs.
// Files live under `app/frontend/public/rulesets/` and are served by Vite at
// `/rulesets/<filename>`.

const LEGAL_PDF_MAP: Readonly<Record<string, string>> = {
  'OECD_TPG_2022.pdf': '/rulesets/OECD_TPG_2022.pdf',
  '32_2017_NGM.pdf': '/rulesets/32_2017_NGM.pdf',
  'HU_Act_LXXXI_1996.pdf': '/rulesets/HU_Act_LXXXI_1996.pdf',
}

export function resolveLegalPdfUrl(filename: string): string | null {
  return LEGAL_PDF_MAP[filename] ?? null
}

// Prefix-based mapping for legal reference codes (e.g. "NGM_32_2017.section_5(2)",
// "OECD_TPG_2022.Ch_VI.B.1", "HU_Act_LXXXI_1996.§31_B") to the canonical legal
// source filename. The longest prefix wins.
const LEGAL_REFERENCE_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ['OECD_TPG_2022', 'OECD_TPG_2022.pdf'],
  ['NGM_32_2017', '32_2017_NGM.pdf'],
  ['HU_Act_LXXXI_1996', 'HU_Act_LXXXI_1996.pdf'],
]

export interface LegalReferenceTarget {
  readonly filename: string
  readonly label: string
}

export function resolveLegalReference(reference: string): LegalReferenceTarget | null {
  for (const [prefix, filename] of LEGAL_REFERENCE_PREFIXES) {
    if (reference.startsWith(prefix)) {
      return { filename, label: reference }
    }
  }
  return null
}
