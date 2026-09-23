import { formatBRL } from "@/lib/money";
import type { FinanceMonthlyData } from "../generators/finance-monthly";

const DIRECTION_LABEL: Record<string, string> = { payable: "a pagar", receivable: "a receber" };

function barColor(status: string | null): string {
  if (status === "over") return "bg-red-500";
  if (status === "warning") return "bg-amber-500";
  return "bg-emerald-500";
}

function Card({ label, value, tone = "default" }: { label: string; value: string; tone?: "emerald" | "red" | "default" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : tone === "red" ? "text-red-600 dark:text-red-400" : "text-black dark:text-zinc-50";
  return (
    <div className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

/** Tela do relatório "Financeiro mensal" (6.2) — mesmo `FinanceMonthlyData` do PDF (`finance-monthly-pdf.tsx`). */
export function FinanceMonthlyReport({ data }: { data: FinanceMonthlyData }) {
  const resultTone = data.cards.resultCents >= 0 ? "emerald" : "red";
  const resultDeltaCents = data.previousMonthResultCents == null ? null : data.cards.resultCents - data.previousMonthResultCents;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Financeiro mensal</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{data.label}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Card label="Saldo inicial" value={formatBRL(data.initialBalanceCents)} />
        <Card label="Saldo final" value={formatBRL(data.cards.totalBalanceCents)} />
        <Card label="Entradas" value={formatBRL(data.cards.incomeCents)} tone="emerald" />
        <Card label="Saídas" value={formatBRL(data.cards.expenseCents)} tone="red" />
        <Card label="Resultado" value={formatBRL(data.cards.resultCents)} tone={resultTone} />
        <Card
          label="Vs. mês anterior"
          value={resultDeltaCents == null ? "—" : `${resultDeltaCents >= 0 ? "+" : ""}${formatBRL(resultDeltaCents)}`}
          tone={resultDeltaCents == null ? "default" : resultDeltaCents >= 0 ? "emerald" : "red"}
        />
        <Card label="Média 3 meses" value={formatBRL(data.avgResultLast3MonthsCents)} />
        <Card label="Saldo de divisões" value={formatBRL(data.splitBalanceCents)} tone={data.splitBalanceCents >= 0 ? "emerald" : "red"} />
      </div>

      {data.categoryBudget.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Gastos por categoria × orçamento</h2>
          <div className="flex flex-col gap-2">
            {data.categoryBudget.map((row) => {
              const barPercent = row.percent != null ? Math.min(row.percent, 100) : 0;
              return (
                <div key={row.categoryId} className="flex flex-col gap-1.5 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-black dark:text-zinc-50">{row.categoryName}</span>
                    <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
                      {formatBRL(row.spentCents)}
                      {row.budgetCents != null && <span className="text-zinc-400 dark:text-zinc-500"> de {formatBRL(row.budgetCents)}</span>}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-black/[.06] dark:bg-white/[.08]">
                    <div className={`h-full rounded-full ${barColor(row.status)}`} style={{ width: `${barPercent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {data.topExpenses.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Maiores lançamentos</h2>
          <ul className="flex flex-col gap-1">
            {data.topExpenses.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-zinc-600 dark:text-zinc-300">{t.description}</span>
                <span className="shrink-0 text-red-600 dark:text-red-400">{formatBRL(t.amountCents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.cardStatements.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Faturas do mês</h2>
          <ul className="flex flex-col gap-1">
            {data.cardStatements.map((s, i) => (
              <li key={`${s.accountName}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-zinc-600 dark:text-zinc-300">
                  {s.accountName} <span className="text-xs text-zinc-400 dark:text-zinc-500">(vence {s.dueOn})</span>
                </span>
                <span className="shrink-0 text-black dark:text-zinc-50">{formatBRL(s.totalCents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(data.billsPaid.length > 0 || data.billsOpen.length > 0) && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Contas</h2>
          {data.billsPaid.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Pagas/recebidas no período</p>
              <ul className="flex flex-col gap-1">
                {data.billsPaid.map((b, i) => (
                  <li key={`paid-${i}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-zinc-600 dark:text-zinc-300">{b.description}</span>
                    <span className={`shrink-0 ${b.direction === "receivable" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatBRL(b.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.billsOpen.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Em aberto</p>
              <ul className="flex flex-col gap-1">
                {data.billsOpen.map((b, i) => (
                  <li key={`open-${i}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-zinc-600 dark:text-zinc-300">
                      {b.description} <span className="text-xs text-zinc-400 dark:text-zinc-500">({DIRECTION_LABEL[b.direction] ?? b.direction}, vence {b.dueOn})</span>
                    </span>
                    <span className="shrink-0 text-black dark:text-zinc-50">{formatBRL(b.amountCents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
