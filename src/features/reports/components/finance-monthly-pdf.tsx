import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatBRL } from "@/lib/money";
import type { FinanceMonthlyData } from "../generators/finance-monthly";

const DIRECTION_LABEL: Record<string, string> = { payable: "a pagar", receivable: "a receber" };

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#18181b" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 11, color: "#71717a", marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
  cardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  card: { width: "23%", borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 4, padding: 8 },
  cardLabel: { fontSize: 8, color: "#71717a", marginBottom: 2 },
  cardValue: { fontSize: 12, fontWeight: 700 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: "#f4f4f5" },
  rowLabel: { flexGrow: 1, paddingRight: 8 },
  rowValue: { flexShrink: 0 },
  barTrack: { height: 4, backgroundColor: "#f4f4f5", borderRadius: 2, marginTop: 3 },
  positive: { color: "#059669" },
  negative: { color: "#dc2626" },
});

function barColor(status: string | null): string {
  if (status === "over") return "#ef4444";
  if (status === "warning") return "#f59e0b";
  return "#10b981";
}

/** PDF do relatório "Financeiro mensal" (6.2) — mesmo `FinanceMonthlyData` da tela (`finance-monthly-report.tsx`); gerado com `renderToBuffer` no job `generate_report` (6.4). */
export function FinanceMonthlyPdf({ data }: { data: FinanceMonthlyData }) {
  const resultDeltaCents = data.previousMonthResultCents == null ? null : data.cards.resultCents - data.previousMonthResultCents;

  return (
    <Document title={`Financeiro — ${data.label}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Financeiro mensal</Text>
        <Text style={styles.subtitle}>{data.label}</Text>

        <View style={styles.cardsGrid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Saldo inicial</Text>
            <Text style={styles.cardValue}>{formatBRL(data.initialBalanceCents)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Saldo final</Text>
            <Text style={styles.cardValue}>{formatBRL(data.cards.totalBalanceCents)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Entradas</Text>
            <Text style={[styles.cardValue, styles.positive]}>{formatBRL(data.cards.incomeCents)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Saídas</Text>
            <Text style={[styles.cardValue, styles.negative]}>{formatBRL(data.cards.expenseCents)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Resultado</Text>
            <Text style={[styles.cardValue, data.cards.resultCents >= 0 ? styles.positive : styles.negative]}>{formatBRL(data.cards.resultCents)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Vs. mês anterior</Text>
            <Text style={[styles.cardValue, resultDeltaCents != null && resultDeltaCents < 0 ? styles.negative : styles.positive]}>
              {resultDeltaCents == null ? "—" : `${resultDeltaCents >= 0 ? "+" : ""}${formatBRL(resultDeltaCents)}`}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Média 3 meses</Text>
            <Text style={styles.cardValue}>{formatBRL(data.avgResultLast3MonthsCents)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Saldo de divisões</Text>
            <Text style={[styles.cardValue, data.splitBalanceCents >= 0 ? styles.positive : styles.negative]}>{formatBRL(data.splitBalanceCents)}</Text>
          </View>
        </View>

        {data.categoryBudget.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gastos por categoria × orçamento</Text>
            {data.categoryBudget.map((row) => (
              <View key={row.categoryId} style={{ marginBottom: 6 }}>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>{row.categoryName}</Text>
                  <Text style={styles.rowValue}>
                    {formatBRL(row.spentCents)}
                    {row.budgetCents != null ? ` de ${formatBRL(row.budgetCents)}` : ""}
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={{ height: 4, borderRadius: 2, width: `${row.percent != null ? Math.min(row.percent, 100) : 0}%`, backgroundColor: barColor(row.status) }} />
                </View>
              </View>
            ))}
          </View>
        )}

        {data.topExpenses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Maiores lançamentos</Text>
            {data.topExpenses.map((t) => (
              <View key={t.id} style={styles.row}>
                <Text style={styles.rowLabel}>{t.description}</Text>
                <Text style={[styles.rowValue, styles.negative]}>{formatBRL(t.amountCents)}</Text>
              </View>
            ))}
          </View>
        )}

        {data.cardStatements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Faturas do mês</Text>
            {data.cardStatements.map((s, i) => (
              <View key={`${s.accountName}-${i}`} style={styles.row}>
                <Text style={styles.rowLabel}>
                  {s.accountName} (vence {s.dueOn})
                </Text>
                <Text style={styles.rowValue}>{formatBRL(s.totalCents)}</Text>
              </View>
            ))}
          </View>
        )}

        {(data.billsPaid.length > 0 || data.billsOpen.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contas</Text>
            {data.billsPaid.map((b, i) => (
              <View key={`paid-${i}`} style={styles.row}>
                <Text style={styles.rowLabel}>{b.description}</Text>
                <Text style={[styles.rowValue, b.direction === "receivable" ? styles.positive : styles.negative]}>{formatBRL(b.amountCents)}</Text>
              </View>
            ))}
            {data.billsOpen.map((b, i) => (
              <View key={`open-${i}`} style={styles.row}>
                <Text style={styles.rowLabel}>
                  {b.description} ({DIRECTION_LABEL[b.direction] ?? b.direction}, vence {b.dueOn})
                </Text>
                <Text style={styles.rowValue}>{formatBRL(b.amountCents)}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
