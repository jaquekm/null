"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ContactRow } from "@/features/contacts/queries";
import type { SidebarSpace } from "@/features/spaces/queries";
import { createTransaction } from "../actions";
import type { AccountRow, CategoryRow } from "../queries";
import {
  TRANSACTION_REPEAT_LABELS,
  TRANSACTION_REPEAT_OPTIONS,
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPES,
  type CreateTransactionInput,
  type TransactionRepeatOption,
  type TransactionType,
} from "../schemas";
import { TagChipsInput } from "./tag-chips-input";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

function categoryOptions(categories: CategoryRow[], kind: "income" | "expense") {
  const top = categories.filter((c) => c.kind === kind && !c.parentId);
  return top.map((parent) => ({
    parent,
    children: categories.filter((c) => c.kind === kind && c.parentId === parent.id),
  }));
}

interface TransactionFormDialogProps {
  accounts: AccountRow[];
  categories: CategoryRow[];
  spaces: SidebarSpace[];
  contacts: ContactRow[];
  defaultOccurredOn: string;
  onClose: () => void;
  onCreated: () => void;
}

/** Formulário de lançamento (4.4) — despesa/receita/transferência, parcelamento no cartão, "Repetir". */
export function TransactionFormDialog({ accounts, categories, spaces, contacts, defaultOccurredOn, onClose, onCreated }: TransactionFormDialogProps) {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(defaultOccurredOn);
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [contactId, setContactId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [spaceTouched, setSpaceTouched] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [installments, setInstallments] = useState("1");
  const [repeat, setRepeat] = useState<TransactionRepeatOption>("none");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  function applyDefaultSpace(newAccountId: string) {
    if (spaceTouched) return;
    const account = accounts.find((a) => a.id === newAccountId);
    setSpaceId(account?.spaceId ?? "");
  }

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const isCreditCard = type !== "transfer" && selectedAccount?.kind === "credit_card";
  const installmentsCount = Number(installments) || 1;

  function handleSubmit() {
    setFieldErrors({});

    const payload: CreateTransactionInput = {
      type,
      amount,
      occurredOn,
      description,
      accountId: type === "transfer" ? undefined : accountId || undefined,
      fromAccountId: type === "transfer" ? fromAccountId || undefined : undefined,
      toAccountId: type === "transfer" ? toAccountId || undefined : undefined,
      categoryId: type === "transfer" ? undefined : categoryId || undefined,
      contactId: type === "transfer" ? undefined : contactId || undefined,
      spaceId: spaceId || undefined,
      tags,
      notes: notes.trim() || undefined,
      installments: type === "transfer" ? 1 : installmentsCount,
      repeat: type === "transfer" ? "none" : repeat,
    };

    startTransition(async () => {
      const result = await createTransaction(payload);
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success(type === "transfer" ? "Transferência criada." : "Lançamento criado.");
      onCreated();
    });
  }

  const groups = type !== "transfer" ? categoryOptions(categories, type) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Novo lançamento</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            ×
          </button>
        </div>

        <div className="flex gap-1 rounded-lg bg-black/[.04] p-1 dark:bg-white/[.06]">
          {TRANSACTION_TYPES.map((t) => (
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
            {fieldErrors.occurredOn && <span className="text-red-500">{fieldErrors.occurredOn[0]}</span>}
          </label>
        </div>

        <label className={labelClassName}>
          Descrição*
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClassName} disabled={pending} />
          {fieldErrors.description && <span className="text-red-500">{fieldErrors.description[0]}</span>}
        </label>

        {type === "transfer" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClassName}>
              Conta de origem*
              <select
                value={fromAccountId}
                onChange={(e) => {
                  setFromAccountId(e.target.value);
                  applyDefaultSpace(e.target.value);
                }}
                className={inputClassName}
                disabled={pending}
              >
                <option value="">Selecione</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {fieldErrors.fromAccountId && <span className="text-red-500">{fieldErrors.fromAccountId[0]}</span>}
            </label>
            <label className={labelClassName}>
              Conta de destino*
              <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className={inputClassName} disabled={pending}>
                <option value="">Selecione</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {fieldErrors.toAccountId && <span className="text-red-500">{fieldErrors.toAccountId[0]}</span>}
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClassName}>
              Conta*
              <select
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  applyDefaultSpace(e.target.value);
                }}
                className={inputClassName}
                disabled={pending}
              >
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
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClassName}>
            Espaço
            <select
              value={spaceId}
              onChange={(e) => {
                setSpaceId(e.target.value);
                setSpaceTouched(true);
              }}
              className={inputClassName}
              disabled={pending}
            >
              <option value="">Nenhum</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </label>
          {type !== "transfer" && (
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
          )}
        </div>

        {isCreditCard && (
          <label className={labelClassName}>
            Parcelar em
            <input
              type="number"
              min={1}
              max={60}
              value={installments}
              onChange={(e) => {
                setInstallments(e.target.value);
                if (Number(e.target.value) > 1) setRepeat("none");
              }}
              className={`${inputClassName} max-w-24`}
              disabled={pending}
            />
            {fieldErrors.installments && <span className="text-red-500">{fieldErrors.installments[0]}</span>}
            <span className="font-normal text-zinc-400">{installmentsCount > 1 ? `${installmentsCount}x na fatura, cada parcela no mês seguinte.` : "1 = à vista"}</span>
          </label>
        )}

        {type !== "transfer" && installmentsCount <= 1 && (
          <label className={labelClassName}>
            Repetir
            <select value={repeat} onChange={(e) => setRepeat(e.target.value as TransactionRepeatOption)} className={inputClassName} disabled={pending}>
              {TRANSACTION_REPEAT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {TRANSACTION_REPEAT_LABELS[option]}
                </option>
              ))}
            </select>
            {fieldErrors.repeat && <span className="text-red-500">{fieldErrors.repeat[0]}</span>}
          </label>
        )}

        <label className={labelClassName}>
          Tags
          <TagChipsInput value={tags} onChange={setTags} disabled={pending} />
        </label>

        <label className={labelClassName}>
          Observações
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClassName} disabled={pending} />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={pending} className="rounded-full px-5 py-2 text-sm text-zinc-500 hover:underline">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !amount.trim() || !description.trim()}
            className="bg-foreground text-background rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
