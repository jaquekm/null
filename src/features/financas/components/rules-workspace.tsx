"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ContactRow } from "@/features/contacts/queries";
import type { SidebarSpace } from "@/features/spaces/queries";
import { deleteRule } from "../actions";
import type { AccountRow, CategoryRow, RuleRow } from "../queries";
import { RULE_MATCH_FIELD_LABELS, RULE_MATCH_TYPE_LABELS } from "../schemas";
import { RuleFormDialog } from "./rule-form-dialog";

/** `/financas/regras` (4.6): lista por prioridade, criar/editar/excluir. */
export function RulesWorkspace({
  rules,
  accounts,
  categories,
  contacts,
  spaces,
}: {
  rules: RuleRow[];
  accounts: AccountRow[];
  categories: CategoryRow[];
  contacts: ContactRow[];
  spaces: SidebarSpace[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RuleRow | null>(null);

  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const contactNameById = useMemo(() => new Map(contacts.map((c) => [c.id, c.name])), [contacts]);
  const spaceNameById = useMemo(() => new Map(spaces.map((s) => [s.id, s.name])), [spaces]);

  function handleDelete(id: string) {
    if (!window.confirm("Excluir esta regra?")) return;
    startTransition(async () => {
      const result = await deleteRule(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function ruleSetSummary(rule: RuleRow): string {
    return [
      rule.setCategoryId && categoryNameById.get(rule.setCategoryId),
      rule.setContactId && contactNameById.get(rule.setContactId),
      rule.setSpaceId && spaceNameById.get(rule.setSpaceId),
      rule.setDescription && `descrição "${rule.setDescription}"`,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Regras de categorização</h1>
          <p className="text-sm text-black/60 dark:text-white/60">Aplicadas por prioridade — a primeira que casar decide.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="bg-foreground text-background self-start rounded-full px-4 py-1.5 text-sm font-medium"
        >
          + Nova regra
        </button>
      </div>

      {rules.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nenhuma regra ainda. Crie uma aqui, ou troque a categoria de um lançamento importado e aceite a oferta de &quot;aprender&quot; com a correção.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rules.map((rule) => (
            <li key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-black dark:text-zinc-50">
                  <span className="text-zinc-400 dark:text-zinc-500">#{rule.priority}</span> {RULE_MATCH_FIELD_LABELS[rule.matchField]}{" "}
                  {RULE_MATCH_TYPE_LABELS[rule.matchType].toLowerCase()} &quot;{rule.pattern}&quot;
                  {rule.accountId && ` · ${accountNameById.get(rule.accountId) ?? "conta removida"}`}
                </span>
                <span className="truncate text-xs text-zinc-400 dark:text-zinc-500">
                  → {ruleSetSummary(rule) || "nada definido"} · aplicada {rule.timesApplied}x
                </span>
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(rule);
                    setShowForm(true);
                  }}
                  className="text-zinc-500 hover:underline dark:text-zinc-400"
                >
                  Editar
                </button>
                <button type="button" onClick={() => handleDelete(rule.id)} disabled={pending} className="text-red-500 hover:underline disabled:opacity-60">
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <RuleFormDialog
          accounts={accounts}
          categories={categories}
          contacts={contacts}
          spaces={spaces}
          initial={editing}
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
