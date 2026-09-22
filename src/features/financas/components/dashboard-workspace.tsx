"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { SidebarSpace } from "@/features/spaces/queries";
import { formatBRL } from "@/lib/money";
import { searchDashboardData, updateTransactionCategory } from "../actions";
import { monthPeriod, shiftMonth } from "../lib/period-range";
import type { CategoryRow, DashboardData, UpcomingOrigin } from "../queries";
import { CashflowChart } from "./cashflow-chart";
import { CashProjectionChart } from "./cash-projection-chart";
import { CategoryBreakdownChart } from "./category-breakdown-chart";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

const ORIGIN_LABELS: Record<UpcomingOrigin, string> = { avulsa: "avulsa", fatura: "fatura", recorrencia: "recorrência" };

function categoryOptions(categories: CategoryRow[], kind: "income" | "expense") {
  const top = categories.filter((c) => c.kind === kind && !c.parentId);
  return top.map((parent) => ({ parent, children: categories.filter((c) => c.kind === kind && c.parentId === parent.id) }));
}

function CardTile({ label, value, tone = "default" }: { label: string; value: string; tone?: "emerald" | "red" | "default" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : tone === "red" ? "text-red-600 dark:text-red-400" : "text-black dark:text-zinc-50";
  return (
    <div className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

/** `/financas` (4.12): cards, fluxo de caixa, gastos por categoria, próximos 30 dias e atalhos (maiores gastos, sem categoria). */
export function DashboardWorkspace({
  spaces,
  categories,
  initialMonth,
  initialData,
}: {
  spaces: SidebarSpace[];
  categories: CategoryRow[];
  initialMonth: string;
  initialData: DashboardData;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [spaceId, setSpaceId] = useState("");
  const [data, setData] = useState(initialData);
  const [, startTransition] = useTransition();

  function reload(nextMonth: string, nextSpaceId: string) {
    startTransition(async () => {
      const result = await searchDashboardData({ month: nextMonth, spaceId: nextSpaceId || undefined });
      setData(result);
    });
  }

  function handleShiftMonth(delta: number) {
    const next = shiftMonth(month, delta);
    setMonth(next);
    reload(next, spaceId);
  }

  function handleChangeSpace(next: string) {
    setSpaceId(next);
    reload(month, next);
  }

  function handleResetMonth() {
    setMonth(initialMonth);
    reload(initialMonth, spaceId);
  }

  function handleCategorize(transactionId: string, categoryId: string) {
    if (!categoryId) return;
    startTransition(async () => {
      const result = await updateTransactionCategory(transactionId, categoryId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setData((prev) => ({ ...prev, uncategorized: prev.uncategorized.filter((t) => t.id !== transactionId) }));
    });
  }

  const period = monthPeriod(month);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Painel financeiro</h1>
        {spaces.length > 0 && (
          <select value={spaceId} onChange={(e) => handleChangeSpace(e.target.value)} className={inputClassName}>
            <option value="">Todos os espaços</option>
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button type="button" onClick={() => handleShiftMonth(-1)} aria-label="Mês anterior" className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="min-w-40 text-center text-sm font-medium text-black dark:text-zinc-50">{period.label}</span>
        <button type="button" onClick={() => handleShiftMonth(1)} aria-label="Próximo mês" className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200">
          <ChevronRight className="h-5 w-5" />
        </button>
        {month !== initialMonth && (
          <button type="button" onClick={handleResetMonth} className="text-xs text-zinc-400 hover:underline dark:text-zinc-500">
            Mês atual
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <CardTile label="Saldo total" value={formatBRL(data.cards.totalBalanceCents)} />
        <CardTile label="Entradas do mês" value={formatBRL(data.cards.incomeCents)} tone="emerald" />
        <CardTile label="Saídas do mês" value={formatBRL(data.cards.expenseCents)} tone="red" />
        <CardTile label="Resultado" value={formatBRL(data.cards.resultCents)} tone={data.cards.resultCents >= 0 ? "emerald" : "red"} />
        <CardTile label="Faturas abertas" value={formatBRL(data.cards.openCardDebtCents)} tone={data.cards.openCardDebtCents > 0 ? "red" : "default"} />
        <CardTile label="A receber em aberto" value={formatBRL(data.cards.receivableOpenCents)} />
        <CardTile label="Saldo de divisões" value={formatBRL(data.cards.splitBalanceCents)} tone={data.cards.splitBalanceCents >= 0 ? "emerald" : "red"} />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">Fluxo de caixa (12 meses)</h2>
        <CashflowChart data={data.cashflow} />
      </section>

      {data.categoryBreakdown.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Gastos por categoria</h2>
          <CategoryBreakdownChart data={data.categoryBreakdown} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">Próximos 30 dias</h2>
        <CashProjectionChart data={data.projection} />
        {data.upcoming.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nada previsto pros próximos 30 dias.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {data.upcoming.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-zinc-600 dark:text-zinc-300">
                  {item.description} <span className="text-xs text-zinc-400 dark:text-zinc-500">({ORIGIN_LABELS[item.origin]})</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">{item.dueOn}</span>
                  <span className={item.direction === "receivable" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    {formatBRL(item.amountCents)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.topExpenses.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Maiores gastos do mês</h2>
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

      {data.uncategorized.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Sem categoria ({data.uncategorized.length})</h2>
          <ul className="flex flex-col gap-2">
            {data.uncategorized.map((t) => {
              const groups = categoryOptions(categories, t.amountCents < 0 ? "expense" : "income");
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-zinc-600 dark:text-zinc-300">
                    {t.description} · {formatBRL(t.amountCents)}
                  </span>
                  <select defaultValue="" onChange={(e) => handleCategorize(t.id, e.target.value)} className={inputClassName}>
                    <option value="" disabled>
                      Categorizar...
                    </option>
                    {groups.map((group) => (
                      <optgroup key={group.parent.id} label={group.parent.name}>
                        <option value={group.parent.id}>{group.parent.name}</option>
                        {group.children.map((child) => (
                          <option key={child.id} value={child.id}>
                            {child.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
