"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createQuickExpense, suggestCategoryForDescription } from "../actions";
import type { AccountRow, CategoryRow } from "../queries";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

interface QuickExpenseDialogProps {
  accounts: AccountRow[];
  categories: CategoryRow[];
  defaultAccountId: string;
  defaultOccurredOn: string;
  onClose: () => void;
  onCreated: () => void;
}

/** "Gasto rápido" (4.4): valor + descrição + categoria sugerida pela última usada com descrição parecida. */
export function QuickExpenseDialog({ accounts, categories, defaultAccountId, defaultOccurredOn, onClose, onCreated }: QuickExpenseDialogProps) {
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [occurredOn, setOccurredOn] = useState(defaultOccurredOn);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const [, startSuggestTransition] = useTransition();

  useEffect(() => {
    if (categoryTouched) return;
    const term = description.trim();
    if (term.length < 3) return;

    const timeout = setTimeout(() => {
      startSuggestTransition(async () => {
        const suggested = await suggestCategoryForDescription(term);
        if (suggested) {
          setCategoryId((current) => (categoryTouched ? current : suggested));
        }
      });
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `categoryTouched` só decide se ainda aceita sugestão, não deve reiniciar o debounce.
  }, [description]);

  const expenseCategories = categories.filter((c) => c.kind === "expense");

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await createQuickExpense({ accountId, amount, description, categoryId: categoryId || undefined, occurredOn });
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success("Gasto registrado.");
      onCreated();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Gasto rápido</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            ×
          </button>
        </div>

        <label className={labelClassName}>
          Valor*
          <input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className={inputClassName} disabled={pending} />
          {fieldErrors.amount && <span className="text-red-500">{fieldErrors.amount[0]}</span>}
        </label>

        <label className={labelClassName}>
          Descrição*
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClassName} disabled={pending} />
          {fieldErrors.description && <span className="text-red-500">{fieldErrors.description[0]}</span>}
        </label>

        <label className={labelClassName}>
          Categoria
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setCategoryTouched(true);
            }}
            className={inputClassName}
            disabled={pending}
          >
            <option value="">Sem categoria</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClassName}>
            Conta*
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClassName} disabled={pending}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClassName}>
            Data
            <input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} className={inputClassName} disabled={pending} />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={pending} className="rounded-full px-5 py-2 text-sm text-zinc-500 hover:underline">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !amount.trim() || !description.trim() || !accountId}
            className="bg-foreground text-background rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
