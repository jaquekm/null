"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ContactRow } from "@/features/contacts/queries";
import type { SidebarSpace } from "@/features/spaces/queries";
import { createRecurring, updateRecurring } from "../actions";
import type { AccountRow, CategoryRow, RecurringRow } from "../queries";
import { BILL_DIRECTION_LABELS, BILL_DIRECTIONS, RECURRING_REPEAT_OPTIONS, TRANSACTION_REPEAT_LABELS, type BillDirection, type RecurringRepeatOption } from "../schemas";

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

interface RecurringFormDialogProps {
  recurring?: RecurringRow;
  accounts: AccountRow[];
  categories: CategoryRow[];
  spaces: SidebarSpace[];
  contacts: ContactRow[];
  defaultAnchorDate: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Formulário de recorrência avulsa (4.8, `/financas/recorrencias`) — frequência/data só na criação; edição só ajusta os dados. */
export function RecurringFormDialog({ recurring, accounts, categories, spaces, contacts, defaultAnchorDate, onClose, onSaved }: RecurringFormDialogProps) {
  const isEditing = Boolean(recurring);
  const [direction, setDirection] = useState<BillDirection>(recurring?.direction ?? "payable");
  const [description, setDescription] = useState(recurring?.description ?? "");
  const [amount, setAmount] = useState("");
  const [amountIsEstimate, setAmountIsEstimate] = useState(recurring?.amountIsEstimate ?? false);
  const [repeat, setRepeat] = useState<RecurringRepeatOption>("monthly");
  const [anchorDate, setAnchorDate] = useState(defaultAnchorDate);
  const [contactId, setContactId] = useState(recurring?.contactId ?? "");
  const [categoryId, setCategoryId] = useState(recurring?.categoryId ?? "");
  const [accountId, setAccountId] = useState(recurring?.accountId ?? "");
  const [spaceId, setSpaceId] = useState(recurring?.spaceId ?? "");
  const [endsOn, setEndsOn] = useState(recurring?.endsOn ?? "");
  const [remindDaysBefore, setRemindDaysBefore] = useState(String(recurring?.remindDaysBefore ?? 3));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setFieldErrors({});

    const shared = {
      description,
      amount,
      amountIsEstimate,
      contactId: contactId || undefined,
      categoryId: categoryId || undefined,
      accountId: accountId || undefined,
      spaceId: spaceId || undefined,
      endsOn: endsOn || undefined,
      remindDaysBefore: Number(remindDaysBefore) || 0,
    };

    startTransition(async () => {
      const result = isEditing
        ? await updateRecurring(recurring!.id, shared)
        : await createRecurring({ ...shared, direction, repeat, anchorDate });
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success(isEditing ? "Recorrência atualizada." : "Recorrência criada.");
      onSaved();
    });
  }

  const groups = categoryOptions(categories, direction === "payable" ? "expense" : "income");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">{isEditing ? "Editar recorrência" : "Nova recorrência"}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            ×
          </button>
        </div>

        <div className="flex gap-1 rounded-lg bg-black/[.04] p-1 dark:bg-white/[.06]">
          {BILL_DIRECTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              disabled={pending || isEditing}
              className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                direction === d ? "bg-white text-black shadow-sm dark:bg-zinc-800 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {BILL_DIRECTION_LABELS[d]}
            </button>
          ))}
        </div>

        <label className={labelClassName}>
          Descrição*
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClassName} disabled={pending} />
          {fieldErrors.description && <span className="text-red-500">{fieldErrors.description[0]}</span>}
        </label>

        <label className={labelClassName}>
          Valor*
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className={inputClassName} disabled={pending} />
          {fieldErrors.amount && <span className="text-red-500">{fieldErrors.amount[0]}</span>}
        </label>

        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input type="checkbox" checked={amountIsEstimate} onChange={(e) => setAmountIsEstimate(e.target.checked)} disabled={pending} />
          Valor estimado (ex.: conta de luz) — as próximas contas nascem para confirmar o valor
        </label>

        {!isEditing && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClassName}>
              Frequência*
              <select value={repeat} onChange={(e) => setRepeat(e.target.value as RecurringRepeatOption)} className={inputClassName} disabled={pending}>
                {RECURRING_REPEAT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {TRANSACTION_REPEAT_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Primeiro vencimento*
              <input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} className={inputClassName} disabled={pending} />
              {fieldErrors.anchorDate && <span className="text-red-500">{fieldErrors.anchorDate[0]}</span>}
            </label>
          </div>
        )}
        {isEditing && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Próximo vencimento: {recurring!.nextDueOn}. Pra mudar a frequência, desative esta recorrência e crie outra.
          </p>
        )}

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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClassName}>
            Conta prevista
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClassName} disabled={pending}>
              <option value="">Nenhuma</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {fieldErrors.accountId && <span className="text-red-500">{fieldErrors.accountId[0]}</span>}
          </label>
          <label className={labelClassName}>
            Espaço
            <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className={inputClassName} disabled={pending}>
              <option value="">Nenhum</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClassName}>
            Termina em
            <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={inputClassName} disabled={pending} />
            <span className="font-normal text-zinc-400">Opcional — em branco, repete sem data final.</span>
          </label>
          <label className={labelClassName}>
            Lembrar dias antes
            <input type="number" min={0} max={30} value={remindDaysBefore} onChange={(e) => setRemindDaysBefore(e.target.value)} className={`${inputClassName} max-w-24`} disabled={pending} />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={pending} className="rounded-full px-5 py-2 text-sm text-zinc-500 hover:underline">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !amount.trim() || !description.trim() || (!isEditing && !anchorDate)}
            className="bg-foreground text-background rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
