"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/money";
import { markBillPaid } from "../actions";
import type { AccountRow, BillRow } from "../queries";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

interface MarkBillPaidDialogProps {
  bill: BillRow;
  accounts: AccountRow[];
  onClose: () => void;
  onPaid: () => void;
}

/** "Marcar como paga/recebida" (4.8): valor pago (permite parcial), data, conta. */
export function MarkBillPaidDialog({ bill, accounts, onClose, onPaid }: MarkBillPaidDialogProps) {
  const remainingCents = bill.amountCents - bill.paidCents;
  const [amount, setAmount] = useState(() => (remainingCents > 0 ? formatBRL(remainingCents) : ""));
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState(bill.accountId ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await markBillPaid({ billId: bill.id, amount, paidOn, accountId });
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success(bill.direction === "payable" ? "Pagamento registrado." : "Recebimento registrado.");
      onPaid();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">{bill.direction === "payable" ? "Marcar como paga" : "Marcar como recebida"}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            ×
          </button>
        </div>

        <p className="truncate text-sm text-zinc-600 dark:text-zinc-300">{bill.description}</p>

        <label className={labelClassName}>
          Valor pago*
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className={inputClassName} disabled={pending} />
          {fieldErrors.amount && <span className="text-red-500">{fieldErrors.amount[0]}</span>}
          <span className="font-normal text-zinc-400">Pode ser parcial — o restante continua em aberto.</span>
        </label>

        <label className={labelClassName}>
          Data
          <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputClassName} disabled={pending} />
        </label>

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

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={pending} className="rounded-full px-5 py-2 text-sm text-zinc-500 hover:underline">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !amount.trim() || !accountId}
            className="bg-foreground text-background rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
