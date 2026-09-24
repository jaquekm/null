"use client";

import { useActionState, useState, useTransition } from "react";
import type { Result } from "@/lib/result";
import { ColorPicker } from "@/components/shared/color-picker";
import type { SidebarSpace } from "../queries";
import { deleteSpace, moveItemsAndDeleteSpace, setSpaceArchived, updateSpace } from "../actions";

interface SpaceSettingsFormProps {
  space: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    description: string | null;
    archived_at: string | null;
  };
  otherSpaces: SidebarSpace[];
}

const initialUpdateState: Result<null> = { ok: true, data: null };

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

export function SpaceSettingsForm({ space, otherSpaces }: SpaceSettingsFormProps) {
  const updateAction = updateSpace.bind(null, space.id);
  const [updateState, formAction, updatePending] = useActionState(updateAction, initialUpdateState);

  const [archivePending, startArchiveTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [needsMove, setNeedsMove] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState(otherSpaces[0]?.id ?? "");

  function handleArchiveToggle() {
    startArchiveTransition(() => {
      void setSpaceArchived(space.id, !space.archived_at);
    });
  }

  function handleDelete() {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteSpace(space.id);
      if (!result.ok) {
        setDeleteError(result.error);
        setNeedsMove(true);
      }
    });
  }

  function handleMoveAndDelete() {
    if (!moveTargetId) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await moveItemsAndDeleteSpace(space.id, moveTargetId);
      if (!result.ok) setDeleteError(result.error);
    });
  }

  return (
    <details className="rounded-lg border border-black/[.08] dark:border-white/[.08]">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-black dark:text-zinc-50">
        Configurações do espaço
      </summary>

      <div className="flex flex-col gap-4 border-t border-black/[.08] p-4 dark:border-white/[.08]">
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              name="icon"
              defaultValue={space.icon ?? ""}
              aria-label="Emoji ou ícone"
              maxLength={4}
              className={`${inputClassName} w-14 text-center`}
            />
            <input
              name="name"
              defaultValue={space.name}
              aria-label="Nome do espaço"
              maxLength={80}
              className={`${inputClassName} min-w-0 flex-1`}
            />
          </div>
          <textarea
            name="description"
            defaultValue={space.description ?? ""}
            placeholder="Descrição (opcional)"
            rows={2}
            className={inputClassName}
          />
          <ColorPicker name="color" defaultValue={space.color} aria-label="Cor do espaço" />
          {!updateState.ok && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {updateState.error}
            </p>
          )}
          <button
            type="submit"
            disabled={updatePending}
            className="bg-foreground text-background self-start rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-60"
          >
            {updatePending ? "Salvando..." : "Salvar"}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 border-t border-black/[.08] pt-4 dark:border-white/[.08]">
          <button
            type="button"
            onClick={handleArchiveToggle}
            disabled={archivePending}
            className="rounded-lg border border-black/[.12] px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]"
          >
            {space.archived_at ? "Restaurar espaço" : "Arquivar espaço"}
          </button>

          {!needsMove && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deletePending}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              Excluir espaço
            </button>
          )}
        </div>

        {deleteError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {deleteError}
          </p>
        )}

        {needsMove && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={moveTargetId}
              onChange={(e) => setMoveTargetId(e.target.value)}
              aria-label="Mover itens para"
              className={inputClassName}
            >
              {otherSpaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleMoveAndDelete}
              disabled={deletePending || !moveTargetId}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              {deletePending ? "Movendo..." : "Mover itens e excluir"}
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
