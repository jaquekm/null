"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/money";
import { payCardStatement } from "../actions";
import type { AccountRow } from "../queries";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

interface PayStatementDialogProps {
  statementId: string;
  remainingCents: number;
  accounts: AccountRow[];
  onClose: () => void;
  onPaid: () => void;
}

/** "Pagar fatura" (4.7): saída na conta pagadora + entrada no cartão. */
export function PayStatementDialog({ statementId, remainingCents, accounts, onClose, onPaid }: PayStatementDialogProps) {
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [amount, setAmount] = useState(() => (remainingCents > 0 ? formatBRL(remainingCents) : ""));
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await payCardStatement({ statementId, paymentAccountId, amount, occurredOn });
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success("Pagamento registrado.");
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
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Pagar fatura</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            ×
          </button>
        </div>

        <label className={labelClassName}>
          Conta pagadora*
          <select value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)} className={inputClassName} disabled={pending}>
            <option value="">Selecione</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {fieldErrors.paymentAccountId && <span className="text-red-500">{fieldErrors.paymentAccountId[0]}</span>}
        </label>

        <label className={labelClassName}>
          Valor*
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className={inputClassName} disabled={pending} />
          {fieldErrors.amount && <span className="text-red-500">{fieldErrors.amount[0]}</span>}
        </label>

        <label className={labelClassName}>
          Data
          <input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} className={inputClassName} disabled={pending} />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={pending} className="rounded-full px-5 py-2 text-sm text-zinc-500 hover:underline">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !paymentAccountId || !amount.trim()}
            className="bg-foreground text-background rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Salvando..." : "Pagar"}
          </button>
        </div>
      </div>
    </div>
  );
}
