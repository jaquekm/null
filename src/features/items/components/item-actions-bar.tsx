"use client";

import { Archive, ArchiveRestore, Copy, Link as LinkIcon, Pin, PinOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SidebarSpace } from "@/features/spaces/queries";
import type { TypeOptionWithFields } from "../queries";
import { changeItemType, duplicateItem, moveItem, setItemStatus, softDeleteItem, togglePin } from "../actions";

const selectClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

const buttonClassName =
  "flex items-center gap-1.5 rounded-lg border border-black/[.12] px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]";

export function ItemActionsBar({
  itemId,
  status,
  pinned,
  spaceId,
  typeId,
  spaces,
  types,
}: {
  itemId: string;
  status: string;
  pinned: boolean;
  spaceId: string | null;
  typeId: string | null;
  spaces: SidebarSpace[];
  types: TypeOptionWithFields[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Não foi possível concluir a ação.");
    });
  }

  function handleDuplicate() {
    setError(null);
    startTransition(async () => {
      const result = await duplicateItem(itemId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.data) router.push(`/itens/${result.data.id}`);
    });
  }

  function handleDelete() {
    if (!window.confirm("Mover este item para a lixeira?")) return;
    startTransition(() => {
      void softDeleteItem(itemId);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Espaço"
          value={spaceId ?? ""}
          disabled={pending}
          onChange={(e) => run(() => moveItem(itemId, e.target.value || null))}
          className={selectClassName}
        >
          <option value="">Sem espaço (inbox)</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.icon ? `${space.icon} ` : ""}
              {space.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Tipo"
          value={typeId ?? ""}
          disabled={pending}
          onChange={(e) => run(() => changeItemType(itemId, e.target.value || null))}
          className={selectClassName}
        >
          <option value="">Sem tipo</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => togglePin(itemId, !pinned))}
          className={buttonClassName}
        >
          {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          {pinned ? "Desafixar" : "Fixar"}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setItemStatus(itemId, status === "archived" ? "active" : "archived"))}
          className={buttonClassName}
        >
          {status === "archived" ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          {status === "archived" ? "Restaurar" : "Arquivar"}
        </button>

        <button type="button" disabled={pending} onClick={handleDuplicate} className={buttonClassName}>
          <Copy className="h-4 w-4" />
          Duplicar
        </button>

        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(window.location.href)}
          className={buttonClassName}
        >
          <LinkIcon className="h-4 w-4" />
          Copiar link
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={handleDelete}
          className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          <Trash2 className="h-4 w-4" />
          Excluir
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
