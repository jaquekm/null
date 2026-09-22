"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ContactRow } from "@/features/contacts/queries";
import type { SidebarSpace } from "@/features/spaces/queries";
import { formatBRL } from "@/lib/money";
import { setRecurringActive } from "../actions";
import type { AccountRow, CategoryRow, RecurringRow } from "../queries";
import { BILL_DIRECTION_LABELS } from "../schemas";
import { RecurringFormDialog } from "./recurring-form-dialog";

/** `/financas/recorrencias` (4.8): lista, criar/editar, ativar/desativar — o job `generate_bills` cria as contas a partir daqui. */
export function RecurringWorkspace({
  recurring,
  accounts,
  categories,
  spaces,
  contacts,
  defaultAnchorDate,
}: {
  recurring: RecurringRow[];
  accounts: AccountRow[];
  categories: CategoryRow[];
  spaces: SidebarSpace[];
  contacts: ContactRow[];
  defaultAnchorDate: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecurringRow | null>(null);

  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const contactNameById = useMemo(() => new Map(contacts.map((c) => [c.id, c.name])), [contacts]);
  const categoryLabelById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  function handleToggleActive(row: RecurringRow) {
    startTransition(async () => {
      const result = await setRecurringActive(row.id, !row.active);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Recorrências</h1>
          <p className="text-sm text-black/60 dark:text-white/60">Gera contas a pagar/receber automaticamente, até 60 dias à frente.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="bg-foreground text-background self-start rounded-full px-4 py-1.5 text-sm font-medium"
        >
          + Nova recorrência
        </button>
      </div>

      {recurring.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nenhuma recorrência ainda. Crie uma aqui, ou marque &quot;Repetir&quot; ao criar um lançamento ou uma conta.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {recurring.map((row) => (
            <li
              key={row.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08] ${row.active ? "" : "opacity-50"}`}
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-black dark:text-zinc-50">
                  {row.description} · {formatBRL(row.amountCents)}
                  {row.amountIsEstimate ? " (estimado)" : ""}
                </span>
                <span className="truncate text-xs text-zinc-400 dark:text-zinc-500">
                  {BILL_DIRECTION_LABELS[row.direction]} · próxima em {row.nextDueOn}
                  {row.categoryId && ` · ${categoryLabelById.get(row.categoryId) ?? "categoria removida"}`}
                  {row.contactId && ` · ${contactNameById.get(row.contactId) ?? "contato removido"}`}
                  {row.accountId && ` · ${accountNameById.get(row.accountId) ?? "conta removida"}`}
                  {!row.active && " · desativada"}
                </span>
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(row);
                    setShowForm(true);
                  }}
                  className="text-zinc-500 hover:underline dark:text-zinc-400"
                >
                  Editar
                </button>
                <button type="button" onClick={() => handleToggleActive(row)} disabled={pending} className="text-zinc-500 hover:underline disabled:opacity-60 dark:text-zinc-400">
                  {row.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <RecurringFormDialog
          recurring={editing ?? undefined}
          accounts={accounts}
          categories={categories}
          spaces={spaces}
          contacts={contacts}
          defaultAnchorDate={defaultAnchorDate}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
