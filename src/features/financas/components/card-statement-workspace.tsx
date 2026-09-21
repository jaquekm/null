"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatBRL } from "@/lib/money";
import { getStatementTransactions } from "../actions";
import { monthPeriod } from "../lib/period-range";
import type { AccountRow, CardStatementRow, TransactionRow } from "../queries";
import { PayStatementDialog } from "./pay-statement-dialog";

const STATUS_LABELS: Record<CardStatementRow["status"], string> = { open: "Aberta", closed: "Fechada", paid: "Paga", partial: "Parcial" };
const STATUS_CLASSES: Record<CardStatementRow["status"], string> = {
  open: "text-zinc-500 dark:text-zinc-400",
  closed: "text-amber-600 dark:text-amber-400",
  partial: "text-amber-600 dark:text-amber-400",
  paid: "text-emerald-600 dark:text-emerald-400",
};

interface CardStatementWorkspaceProps {
  account: AccountRow;
  otherAccounts: AccountRow[];
  statements: CardStatementRow[];
  statementTotals: Record<string, number>;
  balanceCents: number;
}

/** `/financas/cartoes/[accountId]` (4.7): fatura atual, próximas, anteriores; limite usado/disponível; pagar fatura. */
export function CardStatementWorkspace({ account, otherAccounts, statements, statementTotals, balanceCents }: CardStatementWorkspaceProps) {
  const router = useRouter();
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [transactionsByStatement, setTransactionsByStatement] = useState<Record<string, TransactionRow[]>>({});
  const [payingId, setPayingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const usedCents = Math.max(0, -balanceCents);
  const availableCents = account.creditLimitCents != null ? account.creditLimitCents - usedCents : null;

  const groups = useMemo(() => {
    const current = statements.filter((s) => s.periodStart <= today && today <= s.periodEnd);
    const upcoming = statements.filter((s) => s.periodStart > today);
    const past = statements.filter((s) => s.periodEnd < today);
    return { current, upcoming, past };
  }, [statements, today]);

  function toggleExpand(statementId: string) {
    if (expandedId === statementId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(statementId);
    if (!transactionsByStatement[statementId]) {
      startTransition(async () => {
        const rows = await getStatementTransactions(statementId);
        setTransactionsByStatement((prev) => ({ ...prev, [statementId]: rows }));
      });
    }
  }

  function renderStatement(statement: CardStatementRow) {
    const totalCents = Math.abs(statementTotals[statement.id] ?? 0);
    const remainingCents = Math.max(0, totalCents - statement.paidCents);
    const label = monthPeriod(statement.referenceMonth.slice(0, 7)).label;
    const expanded = expandedId === statement.id;
    const transactions = transactionsByStatement[statement.id];

    return (
      <li key={statement.id} className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-black dark:text-zinc-50">{label}</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {statement.periodStart.split("-").reverse().join("/")} a {statement.periodEnd.split("-").reverse().join("/")} · vence{" "}
              {statement.dueOn.split("-").reverse().join("/")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${STATUS_CLASSES[statement.status]}`}>{STATUS_LABELS[statement.status]}</span>
            <span className="text-sm font-medium text-black dark:text-zinc-50">{formatBRL(totalCents)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button type="button" onClick={() => toggleExpand(statement.id)} className="text-zinc-500 hover:underline dark:text-zinc-400">
            {expanded ? "Ocultar lançamentos" : "Ver lançamentos"}
          </button>
          {statement.status !== "paid" && (
            <button type="button" onClick={() => setPayingId(statement.id)} className="text-black hover:underline dark:text-zinc-50">
              Pagar fatura {statement.status === "partial" && `(falta ${formatBRL(remainingCents)})`}
            </button>
          )}
        </div>

        {expanded && (
          <ul className="flex flex-col gap-1 border-t border-black/[.06] pt-2 dark:border-white/[.06]">
            {!transactions ? (
              <li className="text-xs text-zinc-400">Carregando...</li>
            ) : transactions.length === 0 ? (
              <li className="text-xs text-zinc-400">Nenhum lançamento nesta fatura.</li>
            ) : (
              transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-zinc-600 dark:text-zinc-300">
                    {t.occurredOn.split("-").reverse().join("/")} · {t.description}
                    {t.installmentTotal && t.installmentTotal > 1 && ` (${t.installmentNumber}/${t.installmentTotal})`}
                  </span>
                  <span className={t.amountCents >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{formatBRL(t.amountCents, { sign: true })}</span>
                </li>
              ))
            )}
          </ul>
        )}

        {payingId === statement.id && (
          <PayStatementDialog
            statementId={statement.id}
            remainingCents={remainingCents}
            accounts={otherAccounts}
            onClose={() => setPayingId(null)}
            onPaid={() => {
              setPayingId(null);
              router.refresh();
            }}
          />
        )}
      </li>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{account.name}</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Fechamento dia {account.closingDay ?? "—"}, vencimento dia {account.dueDay ?? "—"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Limite</p>
          <p className="text-lg font-semibold text-black dark:text-zinc-50">{account.creditLimitCents != null ? formatBRL(account.creditLimitCents) : "—"}</p>
        </div>
        <div className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Usado</p>
          <p className="text-lg font-semibold text-black dark:text-zinc-50">{formatBRL(usedCents)}</p>
        </div>
        <div className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Disponível</p>
          <p className="text-lg font-semibold text-black dark:text-zinc-50">{availableCents != null ? formatBRL(availableCents) : "—"}</p>
        </div>
      </div>

      {statements.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma fatura ainda — aparece aqui assim que houver um lançamento nesta conta.</p>
      ) : (
        <>
          {groups.current.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-black dark:text-zinc-50">Fatura atual</h2>
              <ul className="flex flex-col gap-2">{groups.current.map(renderStatement)}</ul>
            </div>
          )}
          {groups.upcoming.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-black dark:text-zinc-50">Próximas</h2>
              <ul className="flex flex-col gap-2">{groups.upcoming.map(renderStatement)}</ul>
            </div>
          )}
          {groups.past.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-black dark:text-zinc-50">Anteriores</h2>
              <ul className="flex flex-col gap-2">{groups.past.map(renderStatement)}</ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
