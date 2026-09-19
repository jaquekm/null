"use client";

import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { TagSelector } from "@/features/tags/components/tag-selector";
import type { TagOption } from "@/features/tags/queries";
import type { SidebarSpace } from "@/features/spaces/queries";
import type { InboxItemRow, TypeOptionWithFields } from "../../queries";
import { OriginBadge } from "./origin-badge";

const selectClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

const buttonClassName =
  "flex items-center gap-1.5 rounded-lg border border-black/[.12] px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]";

export function InboxProcessing({
  item,
  index,
  total,
  spaces,
  types,
  pending,
  onBack,
  onSpaceChange,
  onTypeChange,
  onTagsChange,
  onArchive,
  onDelete,
}: {
  item: InboxItemRow;
  index: number;
  total: number;
  spaces: SidebarSpace[];
  types: TypeOptionWithFields[];
  pending: boolean;
  onBack: () => void;
  onSpaceChange: (spaceId: string | null) => void;
  onTypeChange: (typeId: string | null) => void;
  onTagsChange: (tags: TagOption[]) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar pra lista
        </button>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {index + 1} de {total}
        </span>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="min-w-0 flex-1 rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
          <div className="flex items-center gap-2">
            <OriginBadge source={item.source} />
            <h2 className="min-w-0 truncate text-lg font-semibold text-black dark:text-zinc-50">
              {item.title || "Sem título"}
            </h2>
          </div>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Capturado em {new Date(item.createdAt).toLocaleDateString("pt-BR")}
          </p>
          <p className="mt-3 text-sm whitespace-pre-wrap text-black/80 dark:text-white/80">
            {item.contentText || "Sem conteúdo."}
          </p>
          <Link href={`/itens/${item.id}`} className="mt-4 inline-block text-sm text-zinc-500 underline dark:text-zinc-400">
            Abrir edição completa →
          </Link>
        </div>

        <div className="flex w-full flex-col gap-3 md:w-64 md:shrink-0">
          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Espaço
            <select
              id={`space-picker-${item.id}`}
              aria-label="Espaço"
              value={item.spaceId ?? ""}
              disabled={pending}
              onChange={(e) => onSpaceChange(e.target.value || null)}
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
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Tipo
            <select
              id={`type-picker-${item.id}`}
              aria-label="Tipo"
              value={item.typeId ?? ""}
              disabled={pending}
              onChange={(e) => onTypeChange(e.target.value || null)}
              className={selectClassName}
            >
              <option value="">Sem tipo</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>

          <TagSelector itemId={item.id} tags={item.tags} inputId={`tags-picker-${item.id}`} onTagsChange={onTagsChange} />

          <div className="flex gap-2 pt-2">
            <button type="button" disabled={pending} onClick={onArchive} className={buttonClassName}>
              Arquivar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onDelete}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        Atalhos: <kbd>J</kbd>/<kbd>K</kbd> próximo/anterior · <kbd>E</kbd> espaço · <kbd>T</kbd> tipo · <kbd>G</kbd> tags ·{" "}
        <kbd>A</kbd> arquivar · <kbd>D</kbd> excluir · <kbd>Esc</kbd> voltar
      </p>
    </div>
  );
}
