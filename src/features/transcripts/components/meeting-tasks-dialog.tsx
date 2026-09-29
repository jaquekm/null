"use client";

import { ListChecks } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { SidebarSpace } from "@/features/spaces/queries";
import { createTasksFromActions } from "../actions";

const inputClassName =
  "rounded-lg border border-black/[.08] bg-surface-muted px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 dark:border-white/[.08]";

export const meetingButtonClassName =
  "flex items-center gap-1.5 rounded-lg border border-black/[.12] px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]";

export interface TaskSuggestion {
  descricao: string;
  responsavel: string | null;
  prazo: string | null;
}

interface TaskDraft extends TaskSuggestion {
  spaceId: string | null;
  lembrar: boolean;
  incluir: boolean;
}

/**
 * Botão + diálogo "criar tarefas" da reunião (2.7, ampliado na 9.3): a dona
 * revisa cada tarefa — descrição, responsável, prazo, espaço e "me lembrar no
 * prazo" — e desmarca as que não quer. Serve pras ações do resumo da IA e pros
 * "Próximos passos" escritos à mão na nota.
 */
export function MeetingTasksButton({
  itemId,
  label,
  icon,
  suggestions,
  spaces,
  defaultSpaceId,
}: {
  itemId: string;
  label: string;
  icon?: ReactNode;
  suggestions: TaskSuggestion[];
  spaces: SidebarSpace[];
  defaultSpaceId: string | null;
}) {
  const [creating, startCreating] = useTransition();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<TaskDraft[]>([]);
  const chosen = drafts.filter((draft) => draft.incluir && draft.descricao.trim());

  function openDialog() {
    setDrafts(suggestions.map((s) => ({ ...s, spaceId: defaultSpaceId, lembrar: Boolean(s.prazo), incluir: true })));
    setOpen(true);
  }

  function update(index: number, patch: Partial<TaskDraft>) {
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  }

  function handleCreate() {
    if (chosen.length === 0) return;
    startCreating(async () => {
      const result = await createTasksFromActions(
        itemId,
        chosen.map(({ descricao, responsavel, prazo, spaceId, lembrar }) => ({
          descricao: descricao.trim(),
          responsavel: responsavel?.trim() || null,
          prazo,
          spaceId,
          lembrar: lembrar && Boolean(prazo),
        })),
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.createdCount} ${result.data.createdCount === 1 ? "tarefa criada" : "tarefas criadas"}.`);
      setOpen(false);
    });
  }

  return (
    <>
      <button type="button" onClick={openDialog} className={`${meetingButtonClassName} self-start`}>
        {icon ?? <ListChecks className="h-4 w-4" aria-hidden />}
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-start sm:p-4 sm:pt-16" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Criar tarefas da reunião"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-t-3xl border border-black/[.08] bg-surface p-5 shadow-2xl sm:rounded-3xl dark:border-white/[.08]"
          >
            <h2 className="font-semibold text-black dark:text-zinc-50">Criar tarefas da reunião</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Revise cada uma. As tarefas ficam ligadas a esta reunião.</p>

            {drafts.map((draft, index) => (
              <fieldset
                key={index}
                className={`flex flex-col gap-2 rounded-2xl border border-black/[.06] p-3 dark:border-white/[.06] ${draft.incluir ? "" : "opacity-50"}`}
              >
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={draft.incluir} onChange={(e) => update(index, { incluir: e.target.checked })} aria-label="Criar esta tarefa" />
                  <input
                    value={draft.descricao}
                    onChange={(e) => update(index, { descricao: e.target.value })}
                    aria-label="Descrição da tarefa"
                    className={`${inputClassName} min-w-0 flex-1`}
                  />
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input
                    value={draft.responsavel ?? ""}
                    onChange={(e) => update(index, { responsavel: e.target.value || null })}
                    placeholder="Responsável"
                    aria-label="Responsável"
                    className={inputClassName}
                  />
                  <input
                    type="date"
                    value={draft.prazo ?? ""}
                    onChange={(e) => update(index, { prazo: e.target.value || null, lembrar: e.target.value ? draft.lembrar || !draft.prazo : false })}
                    aria-label="Prazo"
                    className={inputClassName}
                  />
                  <select
                    value={draft.spaceId ?? ""}
                    onChange={(e) => update(index, { spaceId: e.target.value || null })}
                    aria-label="Espaço"
                    className={inputClassName}
                  >
                    <option value="">Inbox (sem espaço)</option>
                    {spaces.map((space) => (
                      <option key={space.id} value={space.id}>
                        {space.icon ? `${space.icon} ` : ""}
                        {space.name}
                      </option>
                    ))}
                  </select>
                </div>
                <label className={`flex items-center gap-2 text-xs ${draft.prazo ? "text-zinc-600 dark:text-zinc-300" : "text-zinc-400"}`}>
                  <input type="checkbox" disabled={!draft.prazo} checked={draft.lembrar && Boolean(draft.prazo)} onChange={(e) => update(index, { lembrar: e.target.checked })} />
                  Me lembrar no dia do prazo, às 9h
                </label>
              </fieldset>
            ))}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={meetingButtonClassName}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={creating || chosen.length === 0}
                onClick={handleCreate}
                className="bg-brand text-brand-fg rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-60"
              >
                {creating ? "Criando…" : `Criar ${chosen.length} ${chosen.length === 1 ? "tarefa" : "tarefas"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
