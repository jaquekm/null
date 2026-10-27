"use client";

import { Archive, ArchiveRestore, Copy, Link as LinkIcon, ListChecks, Pin, PinOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HoverHint } from "@/components/ui/hover-hint";
import type { SidebarSpace } from "@/features/spaces/queries";
import type { TypeOptionWithFields } from "../queries";
import { changeItemType, duplicateItem, duplicateItemAsNewList, moveItem, setItemStatus, softDeleteItem, togglePin } from "../actions";

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
  typeSlug,
  spaces,
  types,
}: {
  itemId: string;
  status: string;
  pinned: boolean;
  spaceId: string | null;
  typeId: string | null;
  /** Só pra condicionar "Nova cópia desmarcada" (antes "Duplicar como nova") (5.9, pack Listas) ao tipo Lista — mesmo critério de outras ações condicionais por `slug`. */
  typeSlug?: string | null;
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

  function handleDuplicateAsNewList() {
    setError(null);
    startTransition(async () => {
      const result = await duplicateItemAsNewList(itemId);
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Espaço — onde este item fica</span>
          <select aria-label="Espaço" value={spaceId ?? ""} disabled={pending} onChange={(e) => run(() => moveItem(itemId, e.target.value || null))} className={selectClassName}>
            <option value="">Sem espaço (inbox)</option>
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.icon ? `${space.icon} ` : ""}
                {space.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tipo — Nota, Lista, Tarefa…</span>
          <select aria-label="Tipo" value={typeId ?? ""} disabled={pending} onChange={(e) => run(() => changeItemType(itemId, e.target.value || null))} className={selectClassName}>
            <option value="">Sem tipo</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <HoverHint text="Fica fixado no topo do espaço, antes dos outros itens.">
          <button type="button" disabled={pending} onClick={() => run(() => togglePin(itemId, !pinned))} className={buttonClassName}>
            {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            {pinned ? "Desafixar" : "Fixar"}
          </button>
        </HoverHint>

        <HoverHint
          text={
            status === "archived"
              ? "Volta a aparecer nas listas do espaço."
              : "Some das listas do espaço, mas continua guardado e aparece na busca. Reversível: é só restaurar."
          }
        >
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setItemStatus(itemId, status === "archived" ? "active" : "archived"))}
            className={buttonClassName}
          >
            {status === "archived" ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {status === "archived" ? "Restaurar" : "Arquivar"}
          </button>
        </HoverHint>

        <HoverHint text="Cria um item novo, separado deste, com o mesmo conteúdo.">
          <button type="button" disabled={pending} onClick={handleDuplicate} className={buttonClassName}>
            <Copy className="h-4 w-4" />
            Duplicar
          </button>
        </HoverHint>

        {typeSlug === "lista" && (
          <HoverHint text="Cria uma cópia desta lista com tudo desmarcado — pra listas que se repetem, como a de compras.">
            <button type="button" disabled={pending} onClick={handleDuplicateAsNewList} className={buttonClassName}>
              <ListChecks className="h-4 w-4" />
              Nova cópia desmarcada
            </button>
          </HoverHint>
        )}

        <HoverHint text="Copia o endereço desta página. Só abre pra você, já logada — pra mandar pra outra pessoa, use Compartilhar.">
          <button type="button" onClick={() => void navigator.clipboard.writeText(window.location.href)} className={buttonClassName}>
            <LinkIcon className="h-4 w-4" />
            Copiar link
          </button>
        </HoverHint>

        <HoverHint text="Move este item pra lixeira. Não é definitivo: dá pra restaurar depois.">
          <button
            type="button"
            disabled={pending}
            onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </button>
        </HoverHint>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
