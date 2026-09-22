"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { SidebarSpace } from "@/features/spaces/queries";
import { formatBRL } from "@/lib/money";
import { searchCategoryBudgets, setCategoryBudget, type CategoryBudgetRow } from "../actions";
import { monthPeriod, shiftMonth } from "../lib/period-range";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

/** 0–80% verde, 80–100% amarelo, >100% vermelho (4.11). */
function barColor(status: CategoryBudgetRow["status"]): string {
  if (status === "over") return "bg-red-500";
  if (status === "warning") return "bg-amber-500";
  return "bg-emerald-500";
}

function BudgetRowItem({ row, indented, onSaved }: { row: CategoryBudgetRow; indented: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.budgetCents != null ? (row.budgetCents / 100).toFixed(2).replace(".", ",") : "");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await setCategoryBudget(row.categoryId, { monthlyBudget: value });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEditing(false);
      onSaved();
    });
  }

  const barPercent = row.percent != null ? Math.min(row.percent, 100) : 0;

  return (
    <div className={`flex flex-col gap-1.5 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08] ${indented ? "ml-4" : ""}`}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium text-black dark:text-zinc-50">{row.categoryName}</span>
        <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
          {formatBRL(row.spentCents)}
          {row.budgetCents != null && <span className="text-zinc-400 dark:text-zinc-500"> de {formatBRL(row.budgetCents)}</span>}
        </span>
      </div>

      {row.budgetCents != null && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/[.06] dark:bg-white/[.08]">
          <div className={`h-full rounded-full transition-[width] ${barColor(row.status)}`} style={{ width: `${barPercent}%` }} />
        </div>
      )}

      {editing ? (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          placeholder="Sem orçamento"
          disabled={pending}
          autoFocus
          className={`${inputClassName} w-32`}
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="self-start text-xs text-zinc-500 hover:underline dark:text-zinc-400">
          {row.budgetCents != null ? "Editar orçamento" : "Definir orçamento mensal"}
        </button>
      )}
    </div>
  );
}

/** `/financas/orcamento` (4.11): barras de gasto × orçamento por categoria, mês navegável, filtro de espaço. */
export function BudgetWorkspace({ spaces, initialMonth, initialRows }: { spaces: SidebarSpace[]; initialMonth: string; initialRows: CategoryBudgetRow[] }) {
  const [month, setMonth] = useState(initialMonth);
  const [spaceId, setSpaceId] = useState("");
  const [rows, setRows] = useState(initialRows);
  const [, startTransition] = useTransition();

  function reload(nextMonth: string, nextSpaceId: string) {
    const period = monthPeriod(nextMonth);
    startTransition(async () => {
      const result = await searchCategoryBudgets({ periodStart: period.start, periodEnd: period.end, spaceId: nextSpaceId || undefined });
      setRows(result);
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

  const period = monthPeriod(month);
  const topRows = rows.filter((r) => !r.parentId);
  const childrenOf = (parentId: string) => rows.filter((r) => r.parentId === parentId);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Orçamento</h1>

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

      {spaces.length > 0 && (
        <select value={spaceId} onChange={(e) => handleChangeSpace(e.target.value)} className={inputClassName}>
          <option value="">Todo espaço</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>
      )}

      {rows.length === 0 && <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Nenhuma categoria de despesa cadastrada.</p>}

      <div className="flex flex-col gap-2">
        {topRows.map((row) => (
          <div key={row.categoryId} className="flex flex-col gap-2">
            <BudgetRowItem row={row} indented={false} onSaved={() => reload(month, spaceId)} />
            {childrenOf(row.categoryId).map((child) => (
              <BudgetRowItem key={child.categoryId} row={child} indented onSaved={() => reload(month, spaceId)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
