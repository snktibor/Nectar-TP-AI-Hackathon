import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type {
  BackendAuditReport,
  BackendConsistencyError,
  BackendRiskSeverity,
} from '../../lib/backendAudit'

// ---------------------------------------------------------------------------
// Optional auxiliary data structures (not yet in AuditReport).
// Keep these here so callers can pass them through without backend changes.
// ---------------------------------------------------------------------------

export interface EntityNode {
  readonly id: string
  readonly name: string
  readonly jurisdiction?: string
  readonly tax_id?: string
}

export interface EntityEdge {
  readonly from: string
  readonly to: string
  readonly relation: string
}

export interface EntityGraph {
  readonly nodes: ReadonlyArray<EntityNode>
  readonly edges: ReadonlyArray<EntityEdge>
}

export interface TaxVerificationResult {
  readonly entity_name: string
  readonly tax_id: string
  readonly jurisdiction: string
  readonly source: 'VIES' | 'NAV' | 'OTHER'
  readonly status: 'VALID' | 'INVALID' | 'UNKNOWN'
  readonly checked_at?: string
}

export interface ReportTemplateProps {
  readonly report: BackendAuditReport
  readonly entityGraph?: EntityGraph
  readonly taxVerificationResults?: ReadonlyArray<TaxVerificationResult>
}

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------

const ACCENT = '#FF7B47'
const ACCENT_SOFT = '#FFE9DF'
const INK = '#111812'
const INK_MUTED = '#5C655B'
const LINE = '#D9D8CF'
const SURFACE_MUTED = '#F4F3EE'

const SEVERITY_COLOR: Record<BackendRiskSeverity, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#FBC02D',
  low: '#388E3C',
}

const SEVERITY_LABEL: Record<BackendRiskSeverity, string> = {
  critical: 'Kritikus',
  high: 'Magas',
  medium: 'Közepes',
  low: 'Alacsony',
}

const SEVERITY_ORDER: BackendRiskSeverity[] = ['critical', 'high', 'medium', 'low']

// Register Roboto with full Latin Extended coverage so Hungarian glyphs
// (ő, ű, á, é, í, ó, ú) render correctly. The default PDF base fonts (Helvetica,
// Times) only cover WinAnsi and silently drop these characters.
// Bundled locally under app/frontend/public/fonts/. Required because the
// default PDF base fonts (Helvetica/Times) only cover WinAnsi and silently
// drop Hungarian glyphs (ő, ű). External CDNs (gstatic, jsdelivr) either
// rotate hashes or block hotlinking, so the font is shipped with the app.
Font.register({
  family: 'Roboto',
  fonts: [
    { src: '/fonts/Roboto-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/Roboto-Bold.ttf', fontWeight: 'bold' },
    { src: '/fonts/Roboto-Italic.ttf', fontWeight: 'normal', fontStyle: 'italic' },
  ],
})

Font.registerHyphenationCallback((word) => [word])

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: 'Roboto',
    fontSize: 10,
    color: INK,
    lineHeight: 1.5,
  },
  // --- Cover ---
  cover: {
    paddingTop: 120,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: 'Roboto',
    color: INK,
  },
  coverAccentBar: {
    width: 64,
    height: 6,
    backgroundColor: ACCENT,
    marginBottom: 32,
  },
  coverEyebrow: {
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    fontSize: 10,
    letterSpacing: 2,
    color: ACCENT,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  coverTitle: {
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    fontSize: 36,
    lineHeight: 1.15,
    marginBottom: 16,
    color: INK,
  },
  coverSubtitle: {
    fontFamily: 'Roboto',
    fontStyle: 'italic',
    fontSize: 14,
    color: INK_MUTED,
    marginBottom: 64,
  },
  coverMetaRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 16,
    marginTop: 16,
  },
  coverMetaCol: { flex: 1 },
  coverMetaLabel: {
    fontSize: 8,
    letterSpacing: 1,
    color: INK_MUTED,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  coverMetaValue: {
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    fontSize: 11,
    color: INK,
  },
  coverFooter: {
    position: 'absolute',
    bottom: 48,
    left: 56,
    right: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: INK_MUTED,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 12,
  },
  // --- Section ---
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionNumber: {
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    fontSize: 18,
    color: ACCENT,
    marginRight: 10,
  },
  sectionTitle: {
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    fontSize: 18,
    color: INK,
  },
  sectionRule: {
    height: 1,
    backgroundColor: LINE,
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 10,
    color: INK,
    marginBottom: 8,
  },
  // --- Executive callout ---
  callout: {
    borderLeftWidth: 4,
    borderLeftColor: ACCENT,
    backgroundColor: ACCENT_SOFT,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  calloutLabel: {
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    fontSize: 8,
    letterSpacing: 1,
    color: ACCENT,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  calloutBody: {
    fontFamily: 'Roboto',
    fontSize: 11,
    lineHeight: 1.6,
    color: INK,
  },
  // --- Risk dashboard table ---
  table: {
    borderWidth: 1,
    borderColor: LINE,
    marginBottom: 16,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: SURFACE_MUTED,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  tableRowLast: { flexDirection: 'row' },
  th: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    fontSize: 9,
    color: INK_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  td: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 10,
    color: INK,
  },
  tdRight: { textAlign: 'right' },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  severityCell: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10 },
  // --- Findings ---
  findingCard: {
    borderWidth: 1,
    borderColor: LINE,
    borderLeftWidth: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  findingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  findingId: {
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    fontSize: 9,
    color: INK_MUTED,
    letterSpacing: 0.5,
  },
  severityPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 8,
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  findingDescription: {
    fontFamily: 'Roboto',
    fontSize: 11,
    color: INK,
    marginBottom: 10,
    lineHeight: 1.5,
  },
  referenceBlock: {
    backgroundColor: SURFACE_MUTED,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  referenceLabel: {
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    fontSize: 8,
    color: INK_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  referenceItem: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: INK,
  },
  // --- Entities ---
  entityRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  entityName: { flex: 2, fontFamily: 'Roboto', fontWeight: 'bold', fontSize: 10, color: INK },
  entityMeta: { flex: 2, fontSize: 9, color: INK_MUTED },
  entityStatus: {
    flex: 1,
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    fontSize: 9,
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  // --- Footer ---
  pageFooter: {
    position: 'absolute',
    left: 56,
    right: 56,
    bottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 8,
    fontSize: 8,
    color: INK_MUTED,
  },
  empty: {
    fontFamily: 'Roboto',
    fontStyle: 'italic',
    fontSize: 10,
    color: INK_MUTED,
    paddingVertical: 6,
  },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | undefined): string {
  if (!iso) return new Date().toISOString().slice(0, 10)
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toISOString().slice(0, 10)
}

function countBySeverity(
  errors: ReadonlyArray<{ severity: BackendRiskSeverity }>,
): Record<BackendRiskSeverity, number> {
  const counts: Record<BackendRiskSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const e of errors) counts[e.severity] += 1
  return counts
}

function formatLineNumbers(lines: number[] | null | undefined): string {
  if (!lines || lines.length === 0) return '—'
  if (lines.length === 1) return `${lines[0]}. sor`
  return `${lines[0]}–${lines[lines.length - 1]}. sor`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ index, title }: { index: string; title: string }) {
  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionNumber}>{index}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionRule} />
    </View>
  )
}

function PageFooter() {
  return (
    <View style={styles.pageFooter} fixed>
      <Text>REDLINE PHANTOM · Transzferár megfelelőségi audit</Text>
      <Text
        render={({ pageNumber, totalPages }) => `${pageNumber}. oldal / ${totalPages}`}
      />
    </View>
  )
}

function FindingItem({
  finding,
  index,
}: {
  finding: BackendConsistencyError
  index: number
}) {
  const color = SEVERITY_COLOR[finding.severity]
  return (
    <View style={[styles.findingCard, { borderLeftColor: color }]} wrap={false}>
      <View style={styles.findingHeader}>
        <Text style={styles.findingId}>Megállapítás #{index + 1}</Text>
        <Text style={[styles.severityPill, { backgroundColor: color }]}>
          {SEVERITY_LABEL[finding.severity].toUpperCase()}
        </Text>
      </View>
      <Text style={styles.findingDescription}>{finding.description}</Text>
      <View style={styles.referenceBlock}>
        <Text style={styles.referenceLabel}>Hivatkozás</Text>
        {finding.locations.length === 0 ? (
          <Text style={styles.empty}>Nincs forráshivatkozás megadva.</Text>
        ) : (
          finding.locations.map((loc, idx) => (
            <Text key={`${loc.filename}-${idx}`} style={styles.referenceItem}>
              {loc.filename} · {formatLineNumbers(loc.line_numbers ?? null)}
            </Text>
          ))
        )}
        {finding.evidence ? (
          <Text style={[styles.referenceItem, { marginTop: 4 }]}>
            “{finding.evidence}”
          </Text>
        ) : null}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Main template
// ---------------------------------------------------------------------------

export default function ReportTemplate({
  report,
  entityGraph,
  taxVerificationResults,
}: ReportTemplateProps): JSX.Element {
  const counts = countBySeverity(report.consistency_errors)
  const generatedAt = formatDate(report.generated_at)

  // Pre-sort consistency errors by severity (Critical → Low) for the report.
  const severityRank: Record<BackendRiskSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }
  const sortedFindings = [...report.consistency_errors].sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity],
  )

  const entities = entityGraph?.nodes ?? []
  const verificationByName = new Map(
    (taxVerificationResults ?? []).map((v) => [v.entity_name.toLowerCase(), v]),
  )

  return (
    <Document
      title="Transzferár Megfelelőségi Jelentés"
      author="REDLINE PHANTOM"
      subject="Transzferár megfelelőségi audit"
    >
      {/* ---------- Cover ---------- */}
      <Page size="A4" style={styles.cover}>
        <View style={styles.coverAccentBar} />
        <Text style={styles.coverEyebrow}>Bizalmas · Adótanácsadás</Text>
        <Text style={styles.coverTitle}>
          Transzferár{'\n'}Megfelelőségi Jelentés
        </Text>
        <Text style={styles.coverSubtitle}>
          Kereszt-dokumentum konzisztencia, teljesség és benchmark ellenőrzés —
          a 32/2017 NGM rendelet és a NAV audit elvárásai szerint.
        </Text>

        <View style={styles.coverMetaRow}>
          <View style={styles.coverMetaCol}>
            <Text style={styles.coverMetaLabel}>Generálva</Text>
            <Text style={styles.coverMetaValue}>{generatedAt}</Text>
          </View>
          <View style={styles.coverMetaCol}>
            <Text style={styles.coverMetaLabel}>Megállapítások</Text>
            <Text style={styles.coverMetaValue}>
              {report.consistency_errors.length +
                report.benchmark_risks.length +
                report.missing_elements.length}
            </Text>
          </View>
          <View style={styles.coverMetaCol}>
            <Text style={styles.coverMetaLabel}>Teljes kockázat</Text>
            <Text
              style={[
                styles.coverMetaValue,
                { color: SEVERITY_COLOR[report.overall_risk] ?? INK },
              ]}
            >
              {SEVERITY_LABEL[report.overall_risk]}
            </Text>
          </View>
        </View>

        <View style={styles.coverFooter}>
          <Text>REDLINE PHANTOM · Multi-ügynökös TP Auditor</Text>
          <Text>Készítette: Kerek Barackok · PwC Magyarország AI Hackathon 2026</Text>
        </View>
      </Page>

      {/* ---------- Body ---------- */}
      <Page size="A4" style={styles.page}>
        {/* 1. Executive Summary */}
        <SectionHeader index="01" title="Vezetői összefoglaló" />
        <View style={styles.callout}>
          <Text style={styles.calloutLabel}>AI audit szintézis</Text>
          <Text style={styles.calloutBody}>
            {report.summary?.trim() || 'Nem készült összefoglaló ehhez az audithoz.'}
          </Text>
        </View>

        {/* 2. Risk Dashboard */}
        <SectionHeader index="02" title="Kockázati áttekintés" />
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.th}>Súlyosság</Text>
            <Text style={[styles.th, styles.tdRight]}>Konzisztencia</Text>
            <Text style={[styles.th, styles.tdRight]}>Benchmark</Text>
            <Text style={[styles.th, styles.tdRight]}>Hiányzó</Text>
            <Text style={[styles.th, styles.tdRight]}>Összesen</Text>
          </View>
          {SEVERITY_ORDER.map(
            (sev, idx, arr) => {
              const c = counts[sev]
              const b = report.benchmark_risks.filter((r) => r.severity === sev).length
              const m = report.missing_elements.filter((r) => r.severity === sev).length
              const isLast = idx === arr.length - 1
              return (
                <View key={sev} style={isLast ? styles.tableRowLast : styles.tableRow}>
                  <View style={styles.severityCell}>
                    <View
                      style={[styles.severityDot, { backgroundColor: SEVERITY_COLOR[sev] }]}
                    />
                    <Text>{SEVERITY_LABEL[sev]}</Text>
                  </View>
                  <Text style={[styles.td, styles.tdRight]}>{c}</Text>
                  <Text style={[styles.td, styles.tdRight]}>{b}</Text>
                  <Text style={[styles.td, styles.tdRight]}>{m}</Text>
                  <Text
                    style={[
                      styles.td,
                      styles.tdRight,
                      { fontFamily: 'Roboto', fontWeight: 'bold' },
                    ]}
                  >
                    {c + b + m}
                  </Text>
                </View>
              )
            },
          )}
        </View>

        {/* 3. Detailed Findings */}
        <SectionHeader index="03" title="Részletes megállapítások" />
        {sortedFindings.length === 0 ? (
          <Text style={styles.empty}>
            Nem található kereszt-dokumentum konzisztencia hiba.
          </Text>
        ) : (
          sortedFindings.map((f, idx) => (
            <FindingItem key={f.error_id} finding={f} index={idx} />
          ))
        )}

        {/* 4. Entity Network */}
        <SectionHeader index="04" title="Entitás hálózat" />
        {entities.length === 0 ? (
          <Text style={styles.empty}>
            Nincs entitás gráf csatolva ehhez a jelentéshez.
          </Text>
        ) : (
          <View style={[styles.table, { borderLeftWidth: 0, borderRightWidth: 0 }]}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, { flex: 2 }]}>Entitás</Text>
              <Text style={[styles.th, { flex: 2 }]}>Joghatóság · Adószám</Text>
              <Text style={[styles.th, styles.tdRight]}>Ellenőrzés</Text>
            </View>
            {entities.map((node) => {
              const verification = verificationByName.get(node.name.toLowerCase())
              const status = verification?.status ?? 'UNKNOWN'
              const statusLabel =
                status === 'VALID'
                  ? 'ÉRVÉNYES'
                  : status === 'INVALID'
                  ? 'ÉRVÉNYTELEN'
                  : 'ISMERETLEN'
              const statusColor =
                status === 'VALID'
                  ? SEVERITY_COLOR.low
                  : status === 'INVALID'
                  ? SEVERITY_COLOR.critical
                  : INK_MUTED
              return (
                <View key={node.id} style={styles.entityRow}>
                  <Text style={styles.entityName}>{node.name}</Text>
                  <Text style={styles.entityMeta}>
                    {(node.jurisdiction ?? '—') + ' · ' + (node.tax_id ?? '—')}
                  </Text>
                  <Text style={[styles.entityStatus, { color: statusColor }]}>
                    {statusLabel}
                    {verification ? ` · ${verification.source}` : ''}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        <PageFooter />
      </Page>
    </Document>
  )
}
