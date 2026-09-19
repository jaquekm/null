"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { SidebarSpace } from "@/features/spaces/queries";
import { addTagToItems } from "@/features/tags/actions";
import type { TagOption } from "@/features/tags/queries";
import { archiveItems, changeItemType, moveItems, softDeleteItems } from "../../actions";
import type { InboxItemRow, TypeOptionWithFields } from "../../queries";
import { InboxProcessing } from "./inbox-processing";
import { InboxRow } from "./inbox-row";

export type QuickPanel = "space" | "type" | "tags" | null;

const selectClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

const buttonClassName =
  "flex items-center gap-1.5 rounded-lg border border-black/[.12] px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * Inbox (1.13): lista + modo processamento + atalhos de teclado, tudo em
 * estado local (sem depender de `revalidatePath` pra sentir rápido) —
 * mesmo padrão de "mutar e atualizar a lista local" já usado em
 * `tag-management-list.tsx` (1.8) e `token-management.tsx` (1.11).
 */
export function InboxWorkspace({
  items: initialItems,
  spaces,
  types,
}: {
  items: InboxItemRow[];
  spaces: SidebarSpace[];
  types: TypeOptionWithFields[];
}) {
  const [items, setItems] = useState(initialItems);
  const [focusedId, setFocusedId] = useState<string | null>(initialItems[0]?.id ?? null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quickPanel, setQuickPanel] = useState<QuickPanel>(null);
  const [processing, setProcessing] = useState(false);
  const [batchTagInput, setBatchTagInput] = useState("");
  const [pending, startTransition] = useTransition();

  const focusedIndex = items.findIndex((item) => item.id === focusedId);
  const focusedItem = focusedIndex >= 0 ? items[focusedIndex] : null;
  const selectedCount = selectedIds.size;

  function moveFocus(offset: number) {
    if (items.length === 0) return;
    const currentIndex = focusedIndex >= 0 ? focusedIndex : 0;
    const nextIndex = Math.min(Math.max(currentIndex + offset, 0), items.length - 1);
    const nextItem = items[nextIndex];
    if (!nextItem) return;
    setFocusedId(nextItem.id);
    setQuickPanel(null);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateItem(id: string, patch: Partial<InboxItemRow>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  /** Remove um item e avança o foco pro próximo na mesma posição — usado por ações de um item só. */
  function removeItemAndAdvance(id: string) {
    const index = items.findIndex((item) => item.id === id);
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    setQuickPanel(null);
    if (next.length === 0) {
      setFocusedId(null);
      setProcessing(false);
    } else if (focusedId === id) {
      const advanceTo = next[Math.min(index, next.length - 1)];
      if (advanceTo) setFocusedId(advanceTo.id);
    }
    setSelectedIds((current) => {
      if (!current.has(id)) return current;
      const nextSet = new Set(current);
      nextSet.delete(id);
      return nextSet;
    });
  }

  /** Remove vários itens de uma vez (ações em lote) e volta o foco pro topo da lista restante. */
  function removeItemsAndReset(ids: string[]) {
    const idSet = new Set(ids);
    const next = items.filter((item) => !idSet.has(item.id));
    setItems(next);
    setSelectedIds(new Set());
    setQuickPanel(null);
    if (next.length === 0) {
      setFocusedId(null);
      setProcessing(false);
    } else if (focusedId && idSet.has(focusedId)) {
      setFocusedId(next[0]?.id ?? null);
    }
  }

  function handleSpaceChange(id: string, spaceId: string | null) {
    setQuickPanel(null);
    startTransition(async () => {
      const result = await moveItems([id], spaceId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Definir espaço tira o item do inbox (status vira "active") — sai da lista.
      removeItemAndAdvance(id);
    });
  }

  function handleTypeChange(id: string, typeId: string | null) {
    setQuickPanel(null);
    startTransition(async () => {
      const result = await changeItemType(id, typeId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      updateItem(id, { typeId });
    });
  }

  function handleTagsChange(id: string, tags: TagOption[]) {
    updateItem(id, { tags });
  }

  function handleArchive(id: string) {
    startTransition(async () => {
      const result = await archiveItems([id]);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      removeItemAndAdvance(id);
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("Mover este item para a lixeira?")) return;
    startTransition(async () => {
      const result = await softDeleteItems([id]);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      removeItemAndAdvance(id);
    });
  }

  function handleOpen(id: string) {
    setFocusedId(id);
    setQuickPanel(null);
    setProcessing(true);
  }

  function handleBatchMove(spaceId: string) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await moveItems(ids, spaceId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      removeItemsAndReset(ids);
    });
  }

  function handleBatchTag() {
    const name = batchTagInput.trim();
    const ids = [...selectedIds];
    if (!name || ids.length === 0) return;
    startTransition(async () => {
      const result = await addTagToItems(ids, name);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const tag = result.data;
      if (tag) {
        setItems((current) =>
          current.map((item) =>
            ids.includes(item.id) && !item.tags.some((t) => t.id === tag.id)
              ? { ...item, tags: [...item.tags, tag] }
              : item,
          ),
        );
      }
      setBatchTagInput("");
      toast.success(`Tag adicionada a ${ids.length} ${ids.length === 1 ? "item" : "itens"}.`);
    });
  }

  function handleBatchArchive() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await archiveItems(ids);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      removeItemsAndReset(ids);
    });
  }

  function handleBatchDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!window.confirm(`Mover ${ids.length} ${ids.length === 1 ? "item" : "itens"} para a lixeira?`)) return;
    startTransition(async () => {
      const result = await softDeleteItems(ids);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      removeItemsAndReset(ids);
    });
  }

  // Atalhos de teclado (1.13). Sem array de dependências: precisa ler o estado mais
  // recente (item focado, modo) a cada tecla, e o componente não é grande o bastante
  // pra memoizar tudo com useCallback só por causa disso.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      if (!focusedItem) return;

      switch (event.key) {
        case "j":
        case "J":
          event.preventDefault();
          moveFocus(1);
          break;
        case "k":
        case "K":
          event.preventDefault();
          moveFocus(-1);
          break;
        case "x":
        case "X":
          event.preventDefault();
          toggleSelected(focusedItem.id);
          break;
        case "Enter":
          event.preventDefault();
          if (!processing) handleOpen(focusedItem.id);
          break;
        case "Escape":
          event.preventDefault();
          if (quickPanel) setQuickPanel(null);
          else if (processing) setProcessing(false);
          break;
        case "e":
        case "E":
          event.preventDefault();
          if (processing) document.getElementById(`space-picker-${focusedItem.id}`)?.focus();
          else setQuickPanel((current) => (current === "space" ? null : "space"));
          break;
        case "t":
        case "T":
          event.preventDefault();
          if (processing) document.getElementById(`type-picker-${focusedItem.id}`)?.focus();
          else setQuickPanel((current) => (current === "type" ? null : "type"));
          break;
        case "g":
        case "G":
          event.preventDefault();
          if (processing) document.getElementById(`tags-picker-${focusedItem.id}`)?.focus();
          else setQuickPanel((current) => (current === "tags" ? null : "tags"));
          break;
        case "a":
        case "A":
          event.preventDefault();
          handleArchive(focusedItem.id);
          break;
        case "d":
        case "D":
          event.preventDefault();
          handleDelete(focusedItem.id);
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Inbox</h1>
        {items.length > 0 && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {items.length} {items.length === 1 ? "item" : "itens"}
          </span>
        )}
      </div>

      {selectedCount > 0 && !processing && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-black/[.12] bg-black/[.02] p-3 dark:border-white/[.16] dark:bg-white/[.04]">
          <span className="text-sm text-zinc-600 dark:text-zinc-300">
            {selectedCount} {selectedCount === 1 ? "selecionado" : "selecionados"}
          </span>
          <select
            aria-label="Mover selecionados para"
            disabled={pending}
            value=""
            onChange={(e) => e.target.value && handleBatchMove(e.target.value)}
            className={selectClassName}
          >
            <option value="" disabled>
              Mover para...
            </option>
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.icon ? `${space.icon} ` : ""}
                {space.name}
              </option>
            ))}
          </select>
          <input
            value={batchTagInput}
            onChange={(e) => setBatchTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleBatchTag();
              }
            }}
            placeholder="+ tag para todos"
            disabled={pending}
            className={selectClassName}
          />
          <button type="button" disabled={pending} onClick={handleBatchArchive} className={buttonClassName}>
            Arquivar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleBatchDelete}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Excluir
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-zinc-500 hover:underline dark:text-zinc-400"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">Inbox zerado</p>
      ) : processing && focusedItem ? (
        <InboxProcessing
          item={focusedItem}
          index={focusedIndex}
          total={items.length}
          spaces={spaces}
          types={types}
          pending={pending}
          onBack={() => setProcessing(false)}
          onSpaceChange={(spaceId) => handleSpaceChange(focusedItem.id, spaceId)}
          onTypeChange={(typeId) => handleTypeChange(focusedItem.id, typeId)}
          onTagsChange={(tags) => handleTagsChange(focusedItem.id, tags)}
          onArchive={() => handleArchive(focusedItem.id)}
          onDelete={() => handleDelete(focusedItem.id)}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-1.5">
            {items.map((item) => (
              <InboxRow
                key={item.id}
                item={item}
                focused={item.id === focusedId}
                selected={selectedIds.has(item.id)}
                quickPanel={item.id === focusedId ? quickPanel : null}
                spaces={spaces}
                types={types}
                onFocus={() => setFocusedId(item.id)}
                onToggleSelect={() => toggleSelected(item.id)}
                onOpen={() => handleOpen(item.id)}
                onSpaceChange={(spaceId) => handleSpaceChange(item.id, spaceId)}
                onTypeChange={(typeId) => handleTypeChange(item.id, typeId)}
                onTagsChange={(tags) => handleTagsChange(item.id, tags)}
              />
            ))}
          </ul>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Atalhos: <kbd>J</kbd>/<kbd>K</kbd> navegar · <kbd>X</kbd> selecionar · <kbd>Enter</kbd> abrir · <kbd>E</kbd>{" "}
            espaço · <kbd>T</kbd> tipo · <kbd>G</kbd> tags · <kbd>A</kbd> arquivar · <kbd>D</kbd> excluir
          </p>
        </>
      )}
    </div>
  );
}
