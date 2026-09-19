"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { MeetingSummary } from "@/features/media/schemas";
import type { SidebarSpace } from "@/features/spaces/queries";
import { createTasksFromActions, regenerateSummary } from "../actions";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

const buttonClassName =
  "flex items-center gap-1.5 rounded-lg border border-black/[.12] px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]";

interface TaskDraft {
  descricao: string;
  responsavel: string | null;
  prazo: string | null;
  spaceId: string | null;
}

/** "Gerar resumo novamente" e "Criar tarefas das ações" (2.7) — mostrado na página do item quando há transcrição com resumo. */
export function MeetingSummaryActions({
  itemId,
  transcriptId,
  acoes,
  spaces,
  defaultSpaceId,
}: {
  itemId: string;
  transcriptId: string;
  acoes: MeetingSummary["acoes"];
  spaces: SidebarSpace[];
  defaultSpaceId: string | null;
}) {
  const [regenerating, startRegenerating] = useTransition();
  const [creating, startCreating] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drafts, setDrafts] = useState<TaskDraft[]>([]);

  function handleRegenerate() {
    startRegenerating(async () => {
      const result = await regenerateSummary(transcriptId, itemId);
      if (!result.ok) toast.error(result.error);
      else toast.success("Gerando um novo resumo — a página atualiza em instantes.");
    });
  }

  function openDialog() {
    setDrafts(
      acoes.map((acao) => ({
        descricao: acao.descricao,
        responsavel: acao.responsavel,
        prazo: acao.prazo,
        spaceId: defaultSpaceId,
      })),
    );
    setDialogOpen(true);
  }

  function updateDraft(index: number, patch: Partial<TaskDraft>) {
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  }

  function handleCreateTasks() {
    if (drafts.length === 0) return;
    startCreating(async () => {
      const result = await createTasksFromActions(itemId, drafts);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.createdCount} tarefa(s) criada(s).`);
      setDialogOpen(false);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={regenerating} onClick={handleRegenerate} className={buttonClassName}>
        <RefreshCw className="h-4 w-4" />
        Gerar resumo novamente
      </button>

      {acoes.length > 0 && (
        <button type="button" onClick={openDialog} className={buttonClassName}>
          <Sparkles className="h-4 w-4" />
          Criar tarefas das ações
        </button>
      )}

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16"
          onClick={() => setDialogOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
          >
            <h2 className="text-sm font-medium text-black dark:text-zinc-50">Criar tarefas das ações</h2>

            {drafts.map((draft, index) => (
              <div key={index} className="flex flex-col gap-1.5 rounded-lg border border-black/[.08] p-2.5 dark:border-white/[.08]">
                <input
                  value={draft.descricao}
                  onChange={(e) => updateDraft(index, { descricao: e.target.value })}
                  aria-label="Descrição da tarefa"
                  className={inputClassName}
                />
                {draft.responsavel && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Sugerido pela IA: {draft.responsavel}</span>
                )}
                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    value={draft.prazo ?? ""}
                    onChange={(e) => updateDraft(index, { prazo: e.target.value || null })}
                    aria-label="Prazo"
                    className={inputClassName}
                  />
                  <select
                    value={draft.spaceId ?? ""}
                    onChange={(e) => updateDraft(index, { spaceId: e.target.value || null })}
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
              </div>
            ))}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDialogOpen(false)} className={buttonClassName}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={handleCreateTasks}
                className="bg-foreground text-background rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-60"
              >
                {creating ? "Criando..." : `Criar ${drafts.length} tarefa(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
