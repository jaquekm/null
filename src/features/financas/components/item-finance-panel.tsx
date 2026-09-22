"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ContactRow } from "@/features/contacts/queries";
import { formatBRL } from "@/lib/money";
import type { AccountRow, BillRow, CategoryRow, TransactionRow } from "../queries";
import { BILL_DIRECTION_LABELS, BILL_STATUS_LABELS } from "../schemas";
import { ItemBillDialog } from "./item-bill-dialog";
import { ItemTransactionDialog } from "./item-transaction-dialog";

/**
 * Painel "Financeiro" do item (4.13): "Registrar despesa/receita" e "Criar
 * conta a receber" (ex.: oportunidade ganha na fase 5), mais os lançamentos
 * e contas já vinculados a este item (`fin_transactions.item_id`/
 * `fin_bills.item_id`). Sem link pra tela de detalhe (não existe uma —
 * lançamento/conta vivem só nas listas de `/financas/lancamentos` e
 * `/financas/contas`).
 */
export function ItemFinancePanel({
  itemId,
  itemTitle,
  today,
  accounts,
  categories,
  contacts,
  transactions,
  bills,
}: {
  itemId: string;
  itemTitle: string;
  today: string;
  accounts: AccountRow[];
  categories: CategoryRow[];
  contacts: ContactRow[];
  transactions: TransactionRow[];
  bills: BillRow[];
}) {
  const router = useRouter();
  const [showTransaction, setShowTransaction] = useState(false);
  const [showBill, setShowBill] = useState(false);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-black dark:text-zinc-50">Financeiro</h2>

      <div className="flex flex-wrap gap-2">
        {accounts.length > 0 && (
          <button
            type="button"
            onClick={() => setShowTransaction(true)}
            className="rounded-lg border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]"
          >
            Registrar despesa/receita
          </button>
        )}
        <button type="button" onClick={() => setShowBill(true)} className="rounded-lg border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
          Criar conta a receber
        </button>
      </div>

      {transactions.length > 0 && (
        <ul className="flex flex-col gap-1">
          {transactions.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
              <span className="min-w-0 truncate">
                {t.description} <span className="text-xs text-zinc-400 dark:text-zinc-500">({t.occurredOn})</span>
              </span>
              <span className={`shrink-0 ${t.amountCents < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {formatBRL(t.amountCents)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {bills.length > 0 && (
        <ul className="flex flex-col gap-1">
          {bills.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
              <span className="min-w-0 truncate">
                {b.description}{" "}
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  ({BILL_DIRECTION_LABELS[b.direction]} · {BILL_STATUS_LABELS[b.status]} · vence {b.dueOn})
                </span>
              </span>
              <span className="shrink-0">{formatBRL(b.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}

      {showTransaction && (
        <ItemTransactionDialog
          itemId={itemId}
          defaultDescription={itemTitle}
          defaultOccurredOn={today}
          accounts={accounts}
          categories={categories}
          onClose={() => setShowTransaction(false)}
          onCreated={() => {
            setShowTransaction(false);
            router.refresh();
          }}
        />
      )}

      {showBill && (
        <ItemBillDialog
          itemId={itemId}
          defaultDescription={itemTitle}
          defaultDueOn={today}
          categories={categories}
          contacts={contacts}
          onClose={() => setShowBill(false)}
          onCreated={() => {
            setShowBill(false);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
