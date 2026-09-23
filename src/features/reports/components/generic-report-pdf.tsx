import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReportBlock } from "../lib/blocks";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#18181b" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 11, color: "#71717a", marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
  emptyText: { fontSize: 10, color: "#71717a" },
  cardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  card: { width: "23%", borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 4, padding: 8 },
  cardLabel: { fontSize: 8, color: "#71717a", marginBottom: 2 },
  cardValue: { fontSize: 12, fontWeight: 700 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: "#f4f4f5" },
  rowLabel: { flexGrow: 1, paddingRight: 8 },
  rowValue: { flexShrink: 0 },
  barTrack: { height: 4, backgroundColor: "#f4f4f5", borderRadius: 2, marginTop: 3 },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#d4d4d8", paddingBottom: 3, marginBottom: 2 },
  tableHeaderCell: { flex: 1, fontSize: 8, fontWeight: 700, color: "#71717a" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f4f4f5", paddingVertical: 2 },
  tableCell: { flex: 1, fontSize: 9 },
  positive: { color: "#059669" },
  negative: { color: "#dc2626" },
});

function toneStyle(tone: string | undefined) {
  if (tone === "emerald") return styles.positive;
  if (tone === "red") return styles.negative;
  return undefined;
}

function barColor(status: string | null | undefined): string {
  if (status === "over") return "#ef4444";
  if (status === "warning") return "#f59e0b";
  return "#10b981";
}

function BlockView({ block }: { block: ReportBlock }) {
  if (block.kind === "cards") {
    return (
      <View style={styles.cardsGrid}>
        {block.items.map((item, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.cardLabel}>{item.label}</Text>
            <Text style={[styles.cardValue, toneStyle(item.tone)]}>{item.value}</Text>
          </View>
        ))}
      </View>
    );
  }

  if (block.kind === "list") {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{block.title}</Text>
        {block.rows.length === 0 ? (
          <Text style={styles.emptyText}>{block.emptyText ?? "Nada por aqui."}</Text>
        ) : (
          block.rows.map((row, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>
                {row.label}
                {row.sublabel ? ` (${row.sublabel})` : ""}
              </Text>
              {row.value != null && <Text style={[styles.rowValue, toneStyle(row.tone)]}>{row.value}</Text>}
            </View>
          ))
        )}
      </View>
    );
  }

  if (block.kind === "bars") {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{block.title}</Text>
        {block.rows.length === 0 ? (
          <Text style={styles.emptyText}>{block.emptyText ?? "Nada por aqui."}</Text>
        ) : (
          block.rows.map((row, i) => (
            <View key={i} style={{ marginBottom: 6 }}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.valueLabel}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={{ height: 4, borderRadius: 2, width: `${Math.min(Math.max(row.percent, 0), 100)}%`, backgroundColor: barColor(row.status) }} />
              </View>
            </View>
          ))
        )}
      </View>
    );
  }

  if (block.kind === "table") {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{block.title}</Text>
        {block.rows.length === 0 ? (
          <Text style={styles.emptyText}>{block.emptyText ?? "Nada por aqui."}</Text>
        ) : (
          <View>
            <View style={styles.tableHeaderRow}>
              {block.columns.map((col) => (
                <Text key={col.key} style={styles.tableHeaderCell}>
                  {col.label}
                </Text>
              ))}
            </View>
            {block.rows.map((row, i) => (
              <View key={i} style={styles.tableRow}>
                {block.columns.map((col) => (
                  <Text key={col.key} style={styles.tableCell}>
                    {row[col.key] ?? ""}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      {block.title && <Text style={styles.sectionTitle}>{block.title}</Text>}
      <Text>{block.body}</Text>
    </View>
  );
}

/** PDF genérico pra todo relatório sem componente dedicado (6.2b) — mesmo `ReportBlock[]` da tela (`generic-report-view.tsx`). */
export function GenericReportPdf({ title, subtitle, blocks }: { title: string; subtitle: string; blocks: ReportBlock[] }) {
  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {blocks.map((block, i) => (
          <BlockView key={i} block={block} />
        ))}
      </Page>
    </Document>
  );
}
