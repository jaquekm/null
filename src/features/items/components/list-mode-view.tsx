"use client";

import type { JSONContent } from "@tiptap/core";
import { Check } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { updateItemContent } from "../actions";
import { appendChecklistItem, flattenChecklist, toggleChecklistItem, type ChecklistItem } from "../lib/checklist";

/**
 * "Modo lista" (5.9, pack Listas): itens grandes, marcar com toque, marcados
 * vão pro fim, adicionar com Enter — versão simplificada do editor pra
 * celular, otimizada pra listas de compras/viagem/checklist de processo.
 * Opera no mesmo `content`/`updatedAt` do editor normal (`ItemEditor`).
 */
export function ListModeView({
  itemId,
  content,
  updatedAt,
  onSaved,
  onContentChange,
}: {
  itemId: string;
  content: JSONContent | null;
  updatedAt: string;
  onSaved: (updatedAt: string) => void;
  onContentChange: (content: JSONContent) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [newItemText, setNewItemText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => flattenChecklist(content), [content]);
  const ordered = useMemo(() => [...items].sort((a, b) => Number(a.checked) - Number(b.checked)), [items]);

  function save(nextContent: JSONContent) {
    setError(null);
    onContentChange(nextContent);
    startTransition(async () => {
      const result = await updateItemContent(itemId, updatedAt, nextContent);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.data) onSaved(result.data.updatedAt);
    });
  }

  function handleToggle(item: ChecklistItem) {
    if (!content) return;
    save(toggleChecklistItem(content, item.index, !item.checked));
  }

  function handleAdd() {
    const text = newItemText.trim();
    if (!text) return;
    setNewItemText("");
    save(appendChecklistItem(content, text));
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {ordered.map((item) => (
          <li key={item.index}>
            <button
              type="button"
              disabled={pending}
              onClick={() => handleToggle(item)}
              className={`flex w-full items-center gap-3 rounded-lg border border-black/[.08] px-4 py-3.5 text-left text-base transition-colors disabled:opacity-60 dark:border-white/[.08] ${
                item.checked ? "text-zinc-400 line-through dark:text-zinc-600" : "text-black dark:text-zinc-50"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  item.checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-black/20 dark:border-white/25"
                }`}
              >
                {item.checked && <Check className="h-4 w-4" />}
              </span>
              {item.text || <span className="italic text-zinc-400">(sem texto)</span>}
            </button>
          </li>
        ))}
        {ordered.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">Lista vazia — adicione o primeiro item abaixo.</p>}
      </ul>

      <input
        type="text"
        value={newItemText}
        onChange={(e) => setNewItemText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
          }
        }}
        disabled={pending}
        placeholder="Adicionar item e apertar Enter…"
        className="w-full rounded-lg border border-black/[.12] bg-transparent px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20"
      />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
