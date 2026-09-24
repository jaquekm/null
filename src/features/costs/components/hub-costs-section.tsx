"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/money";
import { createHubCost, deleteHubCost } from "../actions";
import type { HubCostRow } from "../queries";
import { HUB_COST_CATEGORIES, HUB_COST_CATEGORY_LABELS, type HubCostCategory } from "../schemas";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function HubCostsSection({ costs }: { costs: HubCostRow[] }) {
  const [showForm, setShowForm] = useState(false);
  const [referenceMonth, setReferenceMonth] = useState(currentMonth());
  const [category, setCategory] = useState<HubCostCategory>("supabase");
  const [amount, setAmount] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const sorted = [...costs].sort((a, b) => b.referenceMonth.localeCompare(a.referenceMonth));

  function resetForm() {
    setReferenceMonth(currentMonth());
    setCategory("supabase");
    setAmount("");
    setFieldErrors({});
  }

  function handleCreate() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await createHubCost({ referenceMonth, category, amount });
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success("Custo lançado.");
      resetForm();
      setShowForm(false);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteHubCost(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">Custos fixos do Hub</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Lançamento manual mensal (Supabase, Vercel, domínio, bucket de backup). Um por categoria/mês — lançar de novo substitui o valor.</p>
      </div>

      {sorted.length > 0 && (
        <ul className="flex flex-col gap-1">
          {sorted.map((cost) => (
            <li key={cost.id} className="flex items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
              <div className="flex flex-col">
                <span className="font-medium text-black dark:text-zinc-50">{HUB_COST_CATEGORY_LABELS[cost.category]}</span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">{cost.referenceMonth.slice(0, 7)}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-sm">
                <span className="text-black dark:text-zinc-50">{formatBRL(cost.amountCents)}</span>
                <button type="button" onClick={() => handleDelete(cost.id)} disabled={pending} className="text-xs text-red-500 hover:underline disabled:opacity-60">
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <div className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className={labelClassName}>
              Mês*
              <input type="month" value={referenceMonth} onChange={(e) => setReferenceMonth(e.target.value)} className={inputClassName} disabled={pending} />
            </label>
            <label className={labelClassName}>
              Categoria
              <select value={category} onChange={(e) => setCategory(e.target.value as HubCostCategory)} className={inputClassName} disabled={pending}>
                {HUB_COST_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {HUB_COST_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Valor*
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="R$ 25,00" className={inputClassName} disabled={pending} />
              {fieldErrors.amount && <span className="text-red-500">{fieldErrors.amount[0]}</span>}
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={pending || !amount.trim()}
              className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
            >
              {pending ? "Salvando..." : "Lançar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              disabled={pending}
              className="self-start rounded-full px-5 py-2 text-sm text-zinc-500 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)} className="self-start text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          + Lançar custo
        </button>
      )}
    </section>
  );
}
