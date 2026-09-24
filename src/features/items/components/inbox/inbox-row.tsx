"use client";

import { TagBadge } from "@/components/shared/tag-badge";
import { TagSelector } from "@/features/tags/components/tag-selector";
import type { TagOption } from "@/features/tags/queries";
import type { SidebarSpace } from "@/features/spaces/queries";
import type { InboxItemRow, TypeOptionWithFields } from "../../queries";
import { OriginBadge } from "./origin-badge";
import type { QuickPanel } from "./inbox-workspace";

const selectClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

export function InboxRow({
  item,
  focused,
  selected,
  quickPanel,
  spaces,
  types,
  onFocus,
  onToggleSelect,
  onOpen,
  onSpaceChange,
  onTypeChange,
  onTagsChange,
}: {
  item: InboxItemRow;
  focused: boolean;
  selected: boolean;
  quickPanel: QuickPanel;
  spaces: SidebarSpace[];
  types: TypeOptionWithFields[];
  onFocus: () => void;
  onToggleSelect: () => void;
  onOpen: () => void;
  onSpaceChange: (spaceId: string | null) => void;
  onTypeChange: (typeId: string | null) => void;
  onTagsChange: (tags: TagOption[]) => void;
}) {
  return (
    <li
      className={`rounded-lg border transition-colors ${
        focused ? "border-black/30 dark:border-white/30" : "border-black/[.08] dark:border-white/[.08]"
      }`}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onFocus={onFocus}
          aria-label={`Selecionar ${item.title || "item sem título"}`}
          className="mt-1"
        />
        <button
          type="button"
          onClick={() => {
            onFocus();
            onOpen();
          }}
          onFocus={onFocus}
          className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
        >
          <div className="flex w-full items-center gap-2">
            <OriginBadge source={item.source} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-black dark:text-zinc-50">
              {item.title || "Sem título"}
            </span>
            <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
              {new Date(item.createdAt).toLocaleDateString("pt-BR")}
            </span>
          </div>
          {item.contentText && (
            <p className="w-full truncate text-xs text-zinc-500 dark:text-zinc-400">{item.contentText.slice(0, 160)}</p>
          )}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <TagBadge key={tag.id} tag={tag} size="sm" />
              ))}
            </div>
          )}
        </button>
      </div>

      {focused && quickPanel && (
        <div className="border-t border-black/[.08] px-3 py-2 dark:border-white/[.08]">
          {quickPanel === "space" && (
            <select
              autoFocus
              aria-label="Espaço"
              value={item.spaceId ?? ""}
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
          )}
          {quickPanel === "type" && (
            <select
              autoFocus
              aria-label="Tipo"
              value={item.typeId ?? ""}
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
          )}
          {quickPanel === "tags" && <TagSelector itemId={item.id} tags={item.tags} autoFocusInput onTagsChange={onTagsChange} />}
        </div>
      )}
    </li>
  );
}
