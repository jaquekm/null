"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createTransaction } from "../actions";
import type { AccountRow, CategoryRow } from "../queries";
import { TRANSACTION_TYPE_LABELS, type TransactionType } from "../schemas";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

function categoryOptions(categories: CategoryRow[], kind: "income" | "expense") {
  const top = categories.filter((c) => c.kind === kind && !c.parentId);
  return top.map((parent) => ({ parent, children: categories.filter((c) => c.kind === kind && c.parentId === parent.id) }));
}

/** "Registrar despesa/receita" a partir de um item (4.13) — versão enxuta de `TransactionFormDialog`, já com `itemId` fixo. */
export function ItemTransactionDialog({
  itemId,
  defaultDescription,
  defaultOccurredOn,
  accounts,
  categories,
  onClose,
  onCreated,
}: {
  itemId: string;
  defaultDescription: string;
  defaultOccurredOn: string;
  accounts: AccountRow[];
  categories: CategoryRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState<Exclude<TransactionType, "transfer">>("expense");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(defaultOccurredOn);
  const [description, setDescription] = useState(defaultDescription);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  const groups = categoryOptions(categories, type);

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await createTransaction({
        type,
        amount,
        occurredOn,
        description,
        accountId: accountId || undefined,
        categoryId: categoryId || undefined,
        tags: [],
        installments: 1,
        repeat: "none",
        itemId,
      });
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success("Lançamento criado.");
      onCreated();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Registrar despesa/receita</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            ×
          </button>
        </div>

        <div className="flex gap-1 rounded-lg bg-black/[.04] p-1 dark:bg-white/[.06]">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              disabled={pending}
              className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                type === t ? "bg-white text-black shadow-sm dark:bg-zinc-800 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {TRANSACTION_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClassName}>
            Valor*
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className={inputClassName} disabled={pending} />
            {fieldErrors.amount && <span className="text-red-500">{fieldErrors.amount[0]}</span>}
          </label>
          <label className={labelClassName}>
            Data*
            <input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} className={inputClassName} disabled={pending} />
          </label>
        </div>

        <label className={labelClassName}>
          Descrição*
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClassName} disabled={pending} />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClassName}>
            Conta*
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClassName} disabled={pending}>
              <option value="">Selecione</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {fieldErrors.accountId && <span className="text-red-500">{fieldErrors.accountId[0]}</span>}
          </label>
          <label className={labelClassName}>
            Categoria
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClassName} disabled={pending}>
              <option value="">Sem categoria</option>
              {groups.map(({ parent, children }) => (
                <optgroup key={parent.id} label={parent.name}>
                  <option value={parent.id}>{parent.name}</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
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
