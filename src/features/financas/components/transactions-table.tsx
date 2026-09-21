"use client";

import { formatBRL } from "@/lib/money";
import type { CategoryRow, TransactionRow } from "../queries";
import { TRANSACTION_STATUS_LABELS } from "../schemas";

const KIND_BADGES: Record<string, string> = {
  transfer: "Transferência",
  card_payment: "Pagamento de fatura",
  adjustment: "Ajuste",
};

const selectClassName =
  "rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-black/[.12] focus:border-black/[.2] focus:outline-none dark:hover:border-white/[.16] dark:focus:border-white/[.3]";

interface TransactionsTableProps {
  rows: TransactionRow[];
  accountNameById: Map<string, string>;
  categories: CategoryRow[];
  categoryLabelById: Map<string, string>;
  contactNameById: Map<string, string>;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onChangeCategory: (id: string, categoryId: string | null) => void;
  onChangeDescription: (id: string, description: string) => void;
  onDelete: (row: TransactionRow, scope: "this" | "future") => void;
  pending: boolean;
}

/** Tabela de `/financas/lancamentos` (4.4): edição inline de categoria/descrição, seleção pra categorizar em lote. */
export function TransactionsTable({
  rows,
  accountNameById,
  categories,
  categoryLabelById,
  contactNameById,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onChangeCategory,
  onChangeDescription,
  onDelete,
  pending,
}: TransactionsTableProps) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Nenhum lançamento neste período.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-black/[.08] px-2 py-2 text-left dark:border-white/[.08]">
              <input type="checkbox" checked={selected.size === rows.length} onChange={onToggleSelectAll} aria-label="Selecionar todos" />
            </th>
            {["Data", "Descrição", "Categoria", "Conta", "Contato"].map((label) => (
              <th key={label} className="border-b border-black/[.08] px-3 py-2 text-left text-xs font-medium text-zinc-500 dark:border-white/[.08] dark:text-zinc-400">
                {label}
              </th>
            ))}
            <th className="border-b border-black/[.08] px-3 py-2 text-right text-xs font-medium text-zinc-500 dark:border-white/[.08] dark:text-zinc-400">Valor</th>
            <th className="border-b border-black/[.08] px-3 py-2 text-left text-xs font-medium text-zinc-500 dark:border-white/[.08] dark:text-zinc-400">Status</th>
            <th className="border-b border-black/[.08] px-3 py-2 dark:border-white/[.08]" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowCategories = categories.filter((c) => c.kind === (row.amountCents >= 0 ? "income" : "expense"));
            const canDeleteFuture = row.installmentGroupId && row.installmentNumber != null && row.installmentTotal != null && row.installmentNumber < row.installmentTotal;

            return (
              <tr key={row.id} className="hover:bg-black/[.02] dark:hover:bg-white/[.03]">
                <td className="border-b border-black/[.06] px-2 py-1.5 align-top dark:border-white/[.06]">
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => onToggleSelect(row.id)} aria-label="Selecionar lançamento" />
                </td>
                <td className="border-b border-black/[.06] px-3 py-1.5 align-top whitespace-nowrap text-zinc-600 dark:border-white/[.06] dark:text-zinc-300">
                  {row.occurredOn.split("-").reverse().join("/")}
                </td>
                <td className="border-b border-black/[.06] px-3 py-1.5 align-top dark:border-white/[.06]">
                  <input
                    key={`${row.id}-${row.description}`}
                    defaultValue={row.description}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value && value !== row.description) onChangeDescription(row.id, value);
                      else e.target.value = row.description;
                    }}
                    disabled={pending}
                    className="w-full min-w-32 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-black/[.12] focus:border-black/[.2] focus:outline-none dark:hover:border-white/[.16] dark:focus:border-white/[.3]"
                  />
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {KIND_BADGES[row.kind] && (
                      <span className="rounded-full bg-black/[.06] px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-white/[.1] dark:text-zinc-400">{KIND_BADGES[row.kind]}</span>
                    )}
                    {row.installmentTotal != null && row.installmentTotal > 1 && (
                      <span className="rounded-full bg-black/[.06] px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-white/[.1] dark:text-zinc-400">
                        {row.installmentNumber}/{row.installmentTotal}
                      </span>
                    )}
                  </div>
                </td>
                <td className="border-b border-black/[.06] px-3 py-1.5 align-top dark:border-white/[.06]">
                  {row.kind === "transfer" ? (
                    <span className="text-xs text-zinc-400">—</span>
                  ) : (
                    <select value={row.categoryId ?? ""} onChange={(e) => onChangeCategory(row.id, e.target.value || null)} disabled={pending} className={selectClassName}>
                      <option value="">Sem categoria</option>
                      {rowCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {categoryLabelById.get(c.id) ?? c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="border-b border-black/[.06] px-3 py-1.5 align-top whitespace-nowrap text-zinc-600 dark:border-white/[.06] dark:text-zinc-300">
                  {accountNameById.get(row.accountId) ?? "—"}
                </td>
                <td className="border-b border-black/[.06] px-3 py-1.5 align-top whitespace-nowrap text-zinc-600 dark:border-white/[.06] dark:text-zinc-300">
                  {row.contactId ? (contactNameById.get(row.contactId) ?? "—") : ""}
                </td>
                <td
                  className={`border-b border-black/[.06] px-3 py-1.5 text-right align-top font-medium whitespace-nowrap dark:border-white/[.06] ${
                    row.amountCents >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formatBRL(row.amountCents, { sign: true })}
                </td>
                <td className="border-b border-black/[.06] px-3 py-1.5 align-top text-xs whitespace-nowrap text-zinc-500 dark:border-white/[.06] dark:text-zinc-400">
                  {TRANSACTION_STATUS_LABELS[row.status]}
                </td>
                <td className="border-b border-black/[.06] px-3 py-1.5 align-top whitespace-nowrap dark:border-white/[.06]">
                  <div className="flex justify-end gap-2 text-xs">
                    <button type="button" onClick={() => onDelete(row, "this")} disabled={pending} className="text-red-500 hover:underline disabled:opacity-60">
                      Excluir
                    </button>
                    {canDeleteFuture && (
                      <button type="button" onClick={() => onDelete(row, "future")} disabled={pending} className="text-red-500 hover:underline disabled:opacity-60">
                        + próximas
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
