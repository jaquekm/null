import Link from "next/link";
import { formatBRL } from "@/lib/money";
import type { ContactFinanceSummary } from "../queries";
import { BILL_DIRECTION_LABELS, BILL_STATUS_LABELS } from "../schemas";

/** Aba/seção "Finanças" do contato (4.13): contas em aberto, lançamentos recentes e saldo de divisões com essa pessoa. */
export function ContactFinanceSection({ finance }: { finance: ContactFinanceSummary }) {
  const hasAnything = finance.balanceCents !== 0 || finance.bills.length > 0 || finance.transactions.length > 0;
  if (!hasAnything) {
    return <p className="text-sm text-zinc-400 dark:text-zinc-500">Nada por aqui ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {finance.balanceCents !== 0 && (
        <p className="text-sm">
          {finance.balanceCents > 0 ? (
            <>
              Te deve <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatBRL(finance.balanceCents)}</span> em divisões.
            </>
          ) : (
            <>
              Você deve <span className="font-medium text-red-600 dark:text-red-400">{formatBRL(-finance.balanceCents)}</span> em divisões.
            </>
          )}{" "}
          <Link href="/financas/dividir" className="text-xs text-zinc-400 hover:underline dark:text-zinc-500">
            Ver divisões
          </Link>
        </p>
      )}

      {finance.bills.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Contas em aberto</h3>
          <ul className="flex flex-col gap-1">
            {finance.bills.map((bill) => (
              <li key={bill.id} className="flex items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
                <span className="min-w-0 truncate">
                  {bill.description}{" "}
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    ({BILL_DIRECTION_LABELS[bill.direction]} · {BILL_STATUS_LABELS[bill.status]} · vence {bill.dueOn})
                  </span>
                </span>
                <span className="shrink-0">{formatBRL(bill.amountCents - bill.paidCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {finance.transactions.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Lançamentos recentes</h3>
          <ul className="flex flex-col gap-1">
            {finance.transactions.map((t) => (
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
        </div>
      )}

      <Link href="/financas/lancamentos" className="self-start text-xs text-zinc-400 hover:underline dark:text-zinc-500">
        Ver todos os lançamentos
      </Link>
    </div>
  );
}
