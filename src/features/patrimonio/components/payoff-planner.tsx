"use client";

import { useMemo, useState } from "react";
import { monthPeriod, shiftMonth } from "@/features/financas/lib/period-range";
import { formatBRL, parseBRL } from "@/lib/money";
import { buildPayoffPlan, type Debt, type PayoffStrategy } from "../lib/payoff-plan";
import type { NetWorthItemRow } from "../queries";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

const STRATEGY_LABELS: Record<PayoffStrategy, string> = { menor_saldo: "Menor saldo primeiro", maior_juro: "Maior juro primeiro" };

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function payoffLabel(monthsToPayoff: number | null): string {
  if (monthsToPayoff == null) return "não quita com esse valor";
  if (monthsToPayoff === 1) return "mês que vem";
  return monthPeriod(shiftMonth(currentMonth(), monthsToPayoff)).label;
}

function parseLenient(value: string): number | null {
  if (!value.trim()) return null;
  try {
    return parseBRL(value);
  } catch {
    return null;
  }
}

/** Plano de quitação (10.14): ordem sugerida (bola de neve ou avalanche) e data prevista pra cada dívida, calculado no cliente — sem ida ao servidor a cada mudança do orçamento. */
export function PayoffPlanner({ debts: items }: { debts: NetWorthItemRow[] }) {
  const [budgetInput, setBudgetInput] = useState("");
  const [strategy, setStrategy] = useState<PayoffStrategy>("menor_saldo");

  const debts: Debt[] = items
    .filter((item) => item.latestValueCents != null && item.latestValueCents > 0 && item.monthlyRatePercent != null)
    .map((item) => ({ id: item.id, name: item.name, balanceCents: item.latestValueCents!, monthlyRatePercent: item.monthlyRatePercent! }));
  const missingInfo = items.filter((item) => item.latestValueCents == null || item.monthlyRatePercent == null);

  const budgetCents = parseLenient(budgetInput);
  const plan = useMemo(() => {
    if (budgetCents == null || budgetCents <= 0 || debts.length === 0) return null;
    return buildPayoffPlan(debts, budgetCents, strategy);
  }, [debts, budgetCents, strategy]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/[.06] bg-surface p-4 shadow-sm dark:border-white/[.06]">
      <div>
        <h2 className="font-semibold text-black dark:text-zinc-50">Plano de quitação</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Quanto você consegue pagar de dívida por mês, somando todas?</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={budgetInput}
          onChange={(e) => setBudgetInput(e.target.value)}
          placeholder="R$ 0,00"
          className={`${inputClassName} w-32`}
          aria-label="Quanto pode pagar de dívida por mês"
        />
        <div role="radiogroup" aria-label="Ordem sugerida" className="inline-flex rounded-lg border border-black/[.1] p-0.5 dark:border-white/[.12]">
          {(Object.keys(STRATEGY_LABELS) as PayoffStrategy[]).map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={strategy === key}
              onClick={() => setStrategy(key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                strategy === key ? "bg-brand text-brand-fg" : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-300 dark:hover:bg-white/[.06]"
              }`}
            >
              {STRATEGY_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {missingInfo.length > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Falta valor ou taxa de juros de {missingInfo.map((item) => item.name).join(", ")} — defina os dois pra entrar no plano.
        </p>
      )}

      {budgetInput.trim() !== "" && budgetCents == null && <p className="text-sm text-red-600 dark:text-red-400">Valor inválido.</p>}

      {plan && (
        <ol className="flex flex-col gap-1.5">
          {plan.map((entry) => {
            const debt = debts.find((d) => d.id === entry.id)!;
            return (
              <li key={entry.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-muted px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-black dark:text-zinc-100">
                  {entry.order}. {entry.name} <span className="text-zinc-500 dark:text-zinc-400">({formatBRL(debt.balanceCents)})</span>
                </span>
                <span className="shrink-0 text-zinc-600 dark:text-zinc-300">{payoffLabel(entry.monthsToPayoff)}</span>
              </li>
            );
          })}
        </ol>
      )}

      {plan?.some((entry) => entry.monthsToPayoff == null) && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Com esse valor, alguma dívida nunca quita — os juros crescem mais rápido do que você consegue pagar. Tente aumentar o valor mensal.
        </p>
      )}
    </div>
  );
}
