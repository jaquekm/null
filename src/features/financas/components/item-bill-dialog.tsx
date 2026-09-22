"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ContactRow } from "@/features/contacts/queries";
import { createBill } from "../actions";
import type { CategoryRow } from "../queries";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

/** "Criar conta a receber" a partir de um item (4.13, ex.: oportunidade ganha na fase 5) — sempre `direction: "receivable"`, já com `itemId` fixo. */
export function ItemBillDialog({
  itemId,
  defaultDescription,
  defaultDueOn,
  categories,
  contacts,
  onClose,
  onCreated,
}: {
  itemId: string;
  defaultDescription: string;
  defaultDueOn: string;
  categories: CategoryRow[];
  contacts: ContactRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [dueOn, setDueOn] = useState(defaultDueOn);
  const [description, setDescription] = useState(defaultDescription);
  const [contactId, setContactId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  const incomeCategories = categories.filter((c) => c.kind === "income");

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await createBill({
        direction: "receivable",
        description,
        amount,
        amountIsEstimate: false,
        dueOn,
        contactId: contactId || undefined,
        categoryId: categoryId || undefined,
        repeat: "none",
        itemId,
      });
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success("Conta a receber criada.");
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
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Criar conta a receber</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClassName}>
            Valor*
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className={inputClassName} disabled={pending} />
            {fieldErrors.amount && <span className="text-red-500">{fieldErrors.amount[0]}</span>}
          </label>
          <label className={labelClassName}>
            Vencimento*
            <input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} className={inputClassName} disabled={pending} />
          </label>
        </div>

        <label className={labelClassName}>
          Descrição*
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClassName} disabled={pending} />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClassName}>
            Contato
            <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputClassName} disabled={pending}>
              <option value="">Nenhum</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClassName}>
            Categoria
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClassName} disabled={pending}>
              <option value="">Sem categoria</option>
              {incomeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
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
            disabled={pending || !amount.trim() || !description.trim() || !dueOn}
            className="bg-foreground text-background rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
