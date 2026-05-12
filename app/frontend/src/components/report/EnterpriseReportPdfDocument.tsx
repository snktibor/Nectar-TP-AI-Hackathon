import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { severityLabel, type BackendEnterpriseReportPayload } from '../../lib/backendAudit'
import {
  formatDateHu,
  formatHuf,
  normalizeEnterpriseFindings,
  type EnterprisePrintableFinding,
} from '../../lib/enterpriseReport'

interface EnterpriseReportPdfDocumentProps {
  readonly payload: BackendEnterpriseReportPayload
}

interface TableRowProps {
  readonly cells: readonly string[]
  readonly weights?: readonly number[]
  readonly isHeader?: boolean
}

Font.register({
  family: 'Roboto',
  fonts: [
    { src: '/fonts/Roboto-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/Roboto-Bold.ttf', fontWeight: 700 },
    { src: '/fonts/Roboto-Italic.ttf', fontStyle: 'italic', fontWeight: 400 },
  ],
})

const styles = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingRight: 38,
    paddingBottom: 44,
    paddingLeft: 38,
    fontFamily: 'Roboto',
    color: '#111827',
    backgroundColor: '#ffffff',
    fontSize: 10,
    lineHeight: 1.45,
  },
  coverPage: {
    paddingTop: 58,
    paddingRight: 46,
    paddingBottom: 54,
    paddingLeft: 46,
  },
  accentLine: {
    width: 78,
    height: 7,
    borderRadius: 99,
    backgroundColor: '#ff7b47',
    marginBottom: 22,
  },
  eyebrow: {
    color: '#d35427',
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  coverTitle: {
    color: '#0f172a',
    fontSize: 42,
    lineHeight: 1.04,
    fontWeight: 700,
    marginBottom: 18,
  },
  coverSubtitle: {
    color: '#374151',
    fontSize: 12,
    lineHeight: 1.6,
    marginBottom: 24,
    maxWidth: 430,
  },
  coverFooter: {
    position: 'absolute',
    left: 46,
    right: 46,
    bottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: '#4b5563',
    fontSize: 8,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 21,
    lineHeight: 1.18,
    fontWeight: 700,
    marginBottom: 8,
  },
  subTitle: {
    color: '#0f172a',
    fontSize: 13,
    lineHeight: 1.25,
    fontWeight: 700,
    marginTop: 10,
    marginBottom: 6,
  },
  rule: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 13,
  },
  paragraph: {
    color: '#1f2937',
    fontSize: 10,
    lineHeight: 1.62,
    marginBottom: 8,
  },
  mutedText: {
    color: '#4b5563',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    marginBottom: 16,
  },
  kpiCard: {
    width: '24%',
    minHeight: 62,
    borderWidth: 1,
    borderColor: '#e4e8ee',
    borderRadius: 8,
    backgroundColor: '#fafbfc',
    padding: 9,
    marginRight: '1%',
    marginBottom: 7,
  },
  kpiLabel: {
    color: '#6b7280',
    fontSize: 7.8,
    fontWeight: 700,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  kpiValue: {
    color: '#111827',
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.18,
  },
  kpiCritical: {
    color: '#b91c1c',
  },
  kpiHigh: {
    color: '#b45309',
  },
  kpiMoney: {
    color: '#0f766e',
  },
  table: {
    borderWidth: 1,
    borderColor: '#e4e8ee',
    marginTop: 6,
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e8ee',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableHeader: {
    backgroundColor: '#f5f7fa',
  },
  tableCell: {
    borderRightWidth: 1,
    borderRightColor: '#e4e8ee',
    paddingTop: 6,
    paddingRight: 6,
    paddingBottom: 6,
    paddingLeft: 6,
    fontSize: 8.2,
    lineHeight: 1.35,
  },
  tableCellLast: {
    borderRightWidth: 0,
  },
  tableHeaderCell: {
    color: '#374151',
    fontWeight: 700,
    textTransform: 'uppercase',
    fontSize: 7.4,
  },
  noteBox: {
    borderLeftWidth: 4,
    borderLeftColor: '#ff7b47',
    borderRadius: 7,
    backgroundColor: '#fff7f3',
    padding: 9,
    marginTop: 8,
    marginBottom: 10,
  },
  findingCard: {
    borderWidth: 1,
    borderColor: '#e3e8ef',
    borderLeftWidth: 5,
    borderLeftColor: '#ff7b47',
    borderRadius: 8,
    padding: 11,
  },
  findingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 7,
  },
  findingTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.3,
    maxWidth: 360,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 7,
  },
  typePill: {
    borderWidth: 1,
    borderColor: '#d7dee8',
    borderRadius: 99,
    backgroundColor: '#f8fafc',
    color: '#374151',
    fontSize: 8,
    fontWeight: 700,
    paddingTop: 3,
    paddingRight: 7,
    paddingBottom: 3,
    paddingLeft: 7,
    marginRight: 5,
    marginBottom: 4,
  },
  severityPill: {
    borderRadius: 99,
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 700,
    paddingTop: 4,
    paddingRight: 8,
    paddingBottom: 4,
    paddingLeft: 8,
    textTransform: 'uppercase',
  },
  severityCritical: {
    backgroundColor: '#b91c1c',
  },
  severityHigh: {
    backgroundColor: '#d97706',
  },
  severityMedium: {
    backgroundColor: '#b45309',
  },
  severityLow: {
    backgroundColor: '#15803d',
  },
  label: {
    color: '#4b5563',
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 3,
  },
  listItem: {
    color: '#1f2937',
    fontSize: 8.8,
    lineHeight: 1.45,
    marginBottom: 2,
  },
  snippet: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 7,
    backgroundColor: '#f8fafc',
    padding: 8,
    color: '#1f2937',
    fontSize: 8.8,
    lineHeight: 1.45,
  },
  footer: {
    position: 'absolute',
    left: 38,
    right: 38,
    bottom: 22,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    paddingTop: 5,
    color: '#4b5563',
    fontSize: 7.2,
  },
})

function severityPillStyle(severity: EnterprisePrintableFinding['severity']) {
  if (severity === 'critical') return [styles.severityPill, styles.severityCritical]
  if (severity === 'high') return [styles.severityPill, styles.severityHigh]
  if (severity === 'medium') return [styles.severityPill, styles.severityMedium]
  return [styles.severityPill, styles.severityLow]
}

function PageFooter(): JSX.Element {
  return (
    <Text
      fixed
      style={styles.footer}
      render={({ pageNumber, totalPages }) =>
        `Bizalmas - adózási és transzferár érzékeny információkat tartalmaz. | NECTAR TP | ${pageNumber}/${totalPages}`
      }
    />
  )
}

function TableRow({ cells, weights, isHeader = false }: TableRowProps): JSX.Element {
  return (
    <View style={isHeader ? [styles.tableRow, styles.tableHeader] : styles.tableRow}>
      {cells.map((cell, index) => (
        <Text
          key={`${cell}-${index}`}
          style={
            isHeader
              ? [
                  styles.tableCell,
                  styles.tableHeaderCell,
                  index === cells.length - 1 ? styles.tableCellLast : {},
                  { flex: weights?.[index] ?? 1 },
                ]
              : [
                  styles.tableCell,
                  index === cells.length - 1 ? styles.tableCellLast : {},
                  { flex: weights?.[index] ?? 1 },
                ]
          }
        >
          {cell}
        </Text>
      ))}
    </View>
  )
}

function SectionHeading({ title }: { readonly title: string }): JSX.Element {
  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.rule} />
    </>
  )
}

function BulletList({ items }: { readonly items: readonly string[] }): JSX.Element {
  return (
    <View>
      {items.map((item) => (
        <Text key={item} style={styles.listItem}>• {item}</Text>
      ))}
    </View>
  )
}

function remediationsForPhase(
  payload: BackendEnterpriseReportPayload,
  phase: 'immediate_30' | 'short_90' | 'mid_180',
) {
  if (phase === 'immediate_30') return payload.remediation_plan.immediate_30
  if (phase === 'short_90') return payload.remediation_plan.short_90
  return payload.remediation_plan.mid_180
}

function remediationPhaseLabel(phase: 'immediate_30' | 'short_90' | 'mid_180'): string {
  if (phase === 'immediate_30') return 'Azonnali (0-30 nap)'
  if (phase === 'short_90') return 'Rövid távú (31-90 nap)'
  return 'Középtávú (91-180 nap)'
}

export default function EnterpriseReportPdfDocument({ payload }: EnterpriseReportPdfDocumentProps): JSX.Element {
  const report = payload.source_report
  const findings = normalizeEnterpriseFindings(report, payload.remediation_plan.all_actions)
  const referencedDocuments = new Set<string>()
  findings.forEach((finding) => finding.sources.forEach((source) => referencedDocuments.add(source)))
  const documentList = referencedDocuments.size > 0
    ? [...referencedDocuments]
    : [
        'hig_master_file_2024.pdf',
        'hig_local_file_2024_faulty.pdf',
        'hig_benchmark_study_2024.pdf',
        'hig_contracts_2024.pdf',
        'hig_invoices_2024.pdf',
      ]

  const findingStartPage = 8
  const remediationPage = findingStartPage + findings.length
  const legalPage = remediationPage + 1
  const disclaimerPage = legalPage + 2

  return (
    <Document
      title={`Nectar TP Enterprise Report ${payload.session_id.slice(0, 8)}`}
      author="NECTAR TP - Kerek Barackok"
      subject="Transfer pricing compliance report"
      keywords="transfer pricing, NAV, audit, tax, NECTAR TP"
    >
      <Page size="A4" style={[styles.page, styles.coverPage]}>
        <View style={styles.accentLine} />
        <Text style={styles.eyebrow}>PwC Magyarország - Adótanácsadás | Bizalmas</Text>
        <Text style={styles.coverTitle}>Transzferár{`\n`}Megfelelőségi{`\n`}Jelentés</Text>
        <Text style={styles.coverSubtitle}>
          Kereszt-dokumentum konzisztencia, teljesség és benchmark-ellenőrzés a magyar
          transzferár dokumentációs szabályok és a NAV auditgyakorlat figyelembevételével.
        </Text>

        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Generálva</Text>
            <Text style={styles.kpiValue}>{formatDateHu(payload.generated_at)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Megállapítások</Text>
            <Text style={styles.kpiValue}>{payload.findings_total}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Vizsgált források</Text>
            <Text style={styles.kpiValue}>{documentList.length}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>NAV kockázat</Text>
            <Text style={payload.overall_risk === 'critical' ? [styles.kpiValue, styles.kpiCritical] : styles.kpiValue}>
              {severityLabel(payload.overall_risk).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.noteBox}>
          <Text style={styles.paragraph}>
            Session {payload.session_id.slice(0, 8)} · Audit task {payload.audit_task_id.slice(0, 8)} ·
            Big4-szintű vezetői riport mock/PoC audit adatokból.
          </Text>
        </View>

        <View style={styles.coverFooter}>
          <Text>NECTAR TP v2.0 · Multi-ügynökös TP Auditor</Text>
          <Text>Kerek Barackok · PwC Hungary AI Hackathon 2026</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <SectionHeading title="00 · Tartalomjegyzék" />
        <View style={styles.table}>
          <TableRow isHeader cells={['Fejezet', 'Oldal']} weights={[4, 1]} />
          <TableRow cells={['01 · Vezetői összefoglaló', '3']} weights={[4, 1]} />
          <TableRow cells={['02 · Audit hatókör és módszertan', '4']} weights={[4, 1]} />
          <TableRow cells={['02 · Ügynök futások és telemetry', '5']} weights={[4, 1]} />
          <TableRow cells={['03 · Kockázati áttekintés és hőtérkép', '6']} weights={[4, 1]} />
          <TableRow cells={['04 · Pénzügyi kitettség és NAV-becslés', '7']} weights={[4, 1]} />
          <TableRow cells={[`05 · Részletes megállapítások (#1-#${findings.length})`, String(findingStartPage)]} weights={[4, 1]} />
          <TableRow cells={['06 · Remediációs ütemterv', String(remediationPage)]} weights={[4, 1]} />
          <TableRow cells={['07 · Jogi hivatkozások jegyzéke', String(legalPage)]} weights={[4, 1]} />
          <TableRow cells={['08 · Módszertani disclaimer', String(disclaimerPage)]} weights={[4, 1]} />
        </View>
        <Text style={styles.paragraph}>
          A teljes dokumentum dinamikusan épül az audit findingekből. A jelen mock futás {findings.length}{' '}
          részletes finding-oldalt és teljes remediációs tervet tartalmaz.
        </Text>
        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page}>
        <SectionHeading title="01 · Vezetői összefoglaló" />
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Kritikus</Text>
            <Text style={[styles.kpiValue, styles.kpiCritical]}>{payload.severity_breakdown.critical}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Magas</Text>
            <Text style={[styles.kpiValue, styles.kpiHigh]}>{payload.severity_breakdown.high}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Közepes</Text>
            <Text style={styles.kpiValue}>{payload.severity_breakdown.medium}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Max. NAV kitettség</Text>
            <Text style={[styles.kpiValue, styles.kpiMoney]}>{formatHuf(payload.financial_estimate.max_total_huf)}</Text>
          </View>
        </View>
        <Text style={styles.paragraph}>{report.summary}</Text>
        <View style={styles.table}>
          <TableRow isHeader cells={['Tétel', 'Darab']} weights={[4, 1]} />
          <TableRow cells={['Összes konzisztencia finding', String(report.consistency_errors.length)]} weights={[4, 1]} />
          <TableRow cells={['Összes benchmark kockázat', String(report.benchmark_risks.length)]} weights={[4, 1]} />
          <TableRow cells={['Összes teljességi hiány', String(report.missing_elements.length)]} weights={[4, 1]} />
        </View>
        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page}>
        <SectionHeading title="02 · Audit hatókör és módszertan" />
        <Text style={styles.paragraph}>
          A vizsgálat hatóköre a 2024-es transzferár dokumentációs csomag: Master File, Local File,
          benchmark tanulmány, vállalatközi szerződések és számlák. A rendszer célzottan kereszt-
          dokumentumos inkonzisztenciára, dokumentációs hiányosságokra és benchmark eltérésre optimalizált.
        </Text>
        <Text style={styles.paragraph}>
          A pipeline szabályalapú ingest és klasszifikáció után ügynökökkel elemzi a dokumentumokat.
          Minden megállapítás attribúcióval, forráshivatkozással és severity szinttel kerül a riportba.
        </Text>
        <View style={styles.table}>
          <TableRow isHeader cells={['Vizsgált dokumentum / forrás', 'Evidence graph']} weights={[4, 2]} />
          {documentList.slice(0, 12).map((documentName) => (
            <TableRow key={documentName} cells={[documentName, 'Audit evidence graph']} weights={[4, 2]} />
          ))}
        </View>
        <View style={styles.noteBox}>
          <Text style={styles.paragraph}>
            A módszertan a 32/2017 NGM, Tao. tv. 18. §, Art. 215. § és OECD TPG irányelvek szerinti
            compliance fókuszt követi. A findingek evidence-hoz kötött, reprodukálható megállapítások.
          </Text>
        </View>
        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page}>
        <SectionHeading title="02 · Ügynök futások és telemetry" />
        <View style={styles.table}>
          <TableRow isHeader cells={['Ügynök', 'Scope', 'Státusz', 'Tool call', 'Token']} weights={[2.3, 1.6, 1, 1, 1.2]} />
          {report.agent_runs.map((run) => (
            <TableRow
              key={run.agent_id}
              cells={[
                run.agent_id,
                run.doc_type_scope,
                run.status,
                String(run.tool_calls),
                String(run.input_tokens + run.output_tokens + run.cache_read_tokens + run.cache_creation_tokens),
              ]}
              weights={[2.3, 1.6, 1, 1, 1.2]}
            />
          ))}
        </View>
        <Text style={styles.paragraph}>
          A rendszer részleges futási hiba esetén is auditálható: minden ügynök külön telemetry sort kap,
          így a döntéshozó látja, mely részeredmények támasztják alá a végső kockázati képet.
        </Text>
        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page}>
        <SectionHeading title="03 · Kockázati áttekintés és hőtérkép" />
        <Text style={styles.subTitle}>Súlyosság × Típus mátrix</Text>
        <View style={styles.table}>
          <TableRow isHeader cells={['Súlyosság', 'Konzisztencia', 'Benchmark', 'Teljesség', 'Összes']} weights={[1.4, 1.3, 1.3, 1.3, 1]} />
          {payload.severity_type_matrix.map((row) => (
            <TableRow
              key={row.severity}
              cells={[severityLabel(row.severity), String(row.consistency), String(row.benchmark), String(row.completeness), String(row.total)]}
              weights={[1.4, 1.3, 1.3, 1.3, 1]}
            />
          ))}
        </View>
        <Text style={styles.subTitle}>Súlyosság × Ügylettípus mátrix</Text>
        <View style={styles.table}>
          <TableRow isHeader cells={['Ügylettípus', 'Krit.', 'Magas', 'Köz.', 'Al.', 'Össz.', 'Domináns probléma']} weights={[1.7, 0.6, 0.7, 0.6, 0.6, 0.7, 2.6]} />
          {payload.severity_transaction_matrix.map((row) => (
            <TableRow
              key={row.transaction_type}
              cells={[
                row.transaction_type,
                String(row.critical),
                String(row.high),
                String(row.medium),
                String(row.low),
                String(row.total),
                row.dominant_issue,
              ]}
              weights={[1.7, 0.6, 0.7, 0.6, 0.6, 0.7, 2.6]}
            />
          ))}
        </View>
        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page}>
        <SectionHeading title="04 · Pénzügyi kitettség és NAV-becslés" />
        <Text style={styles.paragraph}>
          Az értékek indikativ proxy számítások: céljuk a kockázati sorrend és vezetői döntés támogatása,
          nem a könyvelési pontosságú adóhiány megállapítása.
        </Text>
        <View style={styles.table}>
          <TableRow isHeader cells={['Tétel', 'Jogalap', 'Összeg', 'Megjegyzés']} weights={[2.4, 1.5, 1.2, 2.4]} />
          {payload.financial_estimate.line_items.map((item) => (
            <TableRow
              key={item.item}
              cells={[item.item, item.legal_basis ?? '-', formatHuf(item.amount_huf), item.notes ?? '-']}
              weights={[2.4, 1.5, 1.2, 2.4]}
            />
          ))}
        </View>
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Alapeset</Text>
            <Text style={[styles.kpiValue, styles.kpiMoney]}>{formatHuf(payload.financial_estimate.base_total_huf)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Worst-case</Text>
            <Text style={[styles.kpiValue, styles.kpiCritical]}>{formatHuf(payload.financial_estimate.max_total_huf)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Adóhiány</Text>
            <Text style={styles.kpiValue}>{formatHuf(payload.financial_estimate.estimated_tax_shortfall_huf)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Mulasztási bírság</Text>
            <Text style={styles.kpiValue}>{formatHuf(payload.financial_estimate.documentation_fine_huf)}</Text>
          </View>
        </View>
        <PageFooter />
      </Page>

      {findings.map((finding) => (
        <Page key={finding.findingId} size="A4" style={styles.page}>
          <SectionHeading title="05 · Részletes megállapítások" />
          <View style={styles.findingCard}>
            <View style={styles.findingHeader}>
              <Text style={styles.findingTitle}>Megállapítás {finding.findingRef}</Text>
              <Text style={severityPillStyle(finding.severity)}>{severityLabel(finding.severity)}</Text>
            </View>
            <View style={styles.pillRow}>
              <Text style={styles.typePill}>{finding.findingType}</Text>
              <Text style={styles.typePill}>{finding.title}</Text>
            </View>
            <Text style={styles.paragraph}>{finding.description}</Text>
            <Text style={styles.label}>Forráshivatkozások</Text>
            <BulletList items={finding.sources.length > 0 ? finding.sources : ['Nincs explicit forráslistázás.']} />
            <Text style={styles.label}>Forrás snippet</Text>
            <Text style={styles.snippet}>{finding.snippet}</Text>
            <Text style={styles.label}>Jogi alap</Text>
            <BulletList items={finding.legalBasis} />
            <Text style={styles.label}>Javasolt lépés</Text>
            <Text style={styles.paragraph}>{finding.recommendation}</Text>
          </View>
          <PageFooter />
        </Page>
      ))}

      <Page size="A4" style={styles.page}>
        <SectionHeading title="06 · Remediációs ütemterv" />
        {(['immediate_30', 'short_90', 'mid_180'] as const).map((phase) => {
          const label = remediationPhaseLabel(phase)
          return (
            <View key={phase}>
              <Text style={styles.subTitle}>{label}</Text>
              <View style={styles.table}>
                <TableRow isHeader cells={['Finding', 'Felelős', 'Javasolt lépés', 'Határidő']} weights={[0.8, 1.4, 4, 1]} />
                {remediationsForPhase(payload, phase).map((action) => (
                  <TableRow
                    key={`${action.finding_id}-${phase}`}
                    cells={[action.finding_ref, action.owner, action.recommendation, `${action.due_in_days} nap`]}
                    weights={[0.8, 1.4, 4, 1]}
                  />
                ))}
              </View>
            </View>
          )
        })}
        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page}>
        <SectionHeading title="07 · Jogi hivatkozások jegyzéke" />
        <Text style={styles.subTitle}>Magyar jogszabályok</Text>
        <View style={styles.table}>
          <TableRow isHeader cells={['Jogforrás', 'Tárgy', 'Relevancia']} weights={[2.1, 2.2, 2.3]} />
          <TableRow cells={['32/2017 (X.18.) NGM rendelet', 'TP nyilvántartási kötelezettség', 'Átfogó']} weights={[2.1, 2.2, 2.3]} />
          <TableRow cells={['32/2017 NGM 4. § (1) e)', 'FAR elemzés kötelező tartalma', 'Funkcionális ellentmondások']} weights={[2.1, 2.2, 2.3]} />
          <TableRow cells={['32/2017 NGM 4. § (1) f)', 'Ügyleti tényadatok egyezősége', 'Kereszt-dokumentum konzisztencia']} weights={[2.1, 2.2, 2.3]} />
          <TableRow cells={['32/2017 NGM 6. §', 'IQR / median igazítás', 'Benchmark tartományellenőrzés']} weights={[2.1, 2.2, 2.3]} />
          <TableRow cells={['Tao. tv. 18. §', 'Szokásos piaci ár', 'Adóalap-korrekció kockázat']} weights={[2.1, 2.2, 2.3]} />
          <TableRow cells={['Art. 215. §', 'Adóbírság', 'Worst-case NAV forgatókönyv']} weights={[2.1, 2.2, 2.3]} />
          <TableRow cells={['Art. 230. §', 'Mulasztási bírság', 'Dokumentációs hiányok']} weights={[2.1, 2.2, 2.3]} />
        </View>
        <Text style={styles.paragraph}>
          A jogi megfelelőség validálása során célszerű a pontos hatályos szövegeket visszaellenőrizni,
          különös tekintettel az évközi módosításokra és a társaság tényállására.
        </Text>
        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page}>
        <SectionHeading title="07 · OECD Transfer Pricing Guidelines" />
        <View style={styles.table}>
          <TableRow isHeader cells={['OECD TPG szakasz', 'Tartalom', 'Tipikus finding kapcsolat']} weights={[1.6, 2.5, 2.5]} />
          <TableRow cells={['1.42-1.50', 'Szerződéses feltételek vs tényleges magatartás', 'Management fee és szerződéses eltérés']} weights={[1.6, 2.5, 2.5]} />
          <TableRow cells={['1.51-1.106', 'Funkcionális elemzés (FAR)', 'Profil-ellentmondás']} weights={[1.6, 2.5, 2.5]} />
          <TableRow cells={['2.1-2.18', 'Módszerválasztás alapelvei', 'Cost-plus vs TNMM konfliktus']} weights={[1.6, 2.5, 2.5]} />
          <TableRow cells={['3.55-3.66', 'Interkvartilis tartomány', 'Benchmark tartományon kívüliség']} weights={[1.6, 2.5, 2.5]} />
          <TableRow cells={['6.34-6.58', 'DEMPE keretrendszer', 'IP licencdíj alátámasztás']} weights={[1.6, 2.5, 2.5]} />
          <TableRow cells={['7.6-7.18', 'Benefit test / shareholder activity', 'Menedzsmentszolgáltatás levonhatóság']} weights={[1.6, 2.5, 2.5]} />
        </View>
        <Text style={styles.paragraph}>
          A normatív háttér célja, hogy minden findinghez auditálható jogi és módszertani kontextus társuljon.
        </Text>
        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page}>
        <SectionHeading title="08 · Módszertani disclaimer" />
        <Text style={styles.paragraph}>
          Ez a jelentés automatizált, AI-vezérelt audit kimenet. Nem minősül önálló adótanácsadói
          szakvéleménynek, és nem helyettesíti a felelős adótanácsadó vagy jogi szakértő ellenőrzését.
        </Text>
        <Text style={styles.paragraph}>
          A pénzügyi kitettség számítások modellezett proxy értékek. A tényleges NAV-megállapításokat
          befolyásolja a teljes tényállás, a társaság együttműködése és az ellenőrzés során feltárt bizonyítékok köre.
        </Text>
        <Text style={styles.subTitle}>Ajánlott következő lépések</Text>
        <BulletList
          items={[
            'A findingek validálása felelős adótanácsadói review-val.',
            'A remediációs terv vezetői jóváhagyása és owner-kijelölés.',
            'A benchmark és FAR alapú kritikus tételek 30 napon belüli újraszámolása.',
            'Az önellenőrzési és APA lehetőségek üzleti mérlegelése.',
          ]}
        />
        <View style={styles.noteBox}>
          <Text style={styles.paragraph}>
            Bizalmas - adózási és transzferár érzékeny információkat tartalmaz. A dokumentum kizárólag
            belső döntéstámogatási célra használható.
          </Text>
        </View>
        <PageFooter />
      </Page>
    </Document>
  )
}