"use client";

import { useState, useTransition } from "react";
import { addTagToItem, removeTagFromItem } from "../actions";
import type { TagOption } from "../queries";

export function TagSelector({
  itemId,
  tags: initialTags,
  autoFocusInput,
  inputId,
  onTagsChange,
}: {
  itemId: string;
  tags: TagOption[];
  /** Foca a caixa de "+ tag" assim que o componente monta — usada pelo atalho G do Inbox (1.13). */
  autoFocusInput?: boolean;
  /** Id do input de "+ tag", para focar de fora via `document.getElementById` — atalho G no modo processamento do Inbox (1.13), onde o componente já está montado. */
  inputId?: string;
  /** Avisa o pai da lista atualizada — usado pelo Inbox (1.13) pra manter a prévia da linha em dia. */
  onTagsChange?: (tags: TagOption[]) => void;
}) {
  const [tags, setTags] = useState(initialTags);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    const name = input.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const result = await addTagToItem(itemId, name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.data) {
        const tag = result.data;
        const next = tags.some((t) => t.id === tag.id) ? tags : [...tags, tag];
        setTags(next);
        onTagsChange?.(next);
      }
      setInput("");
    });
  }

  function handleRemove(tagId: string) {
    startTransition(async () => {
      const result = await removeTagFromItem(itemId, tagId);
      if (result.ok) {
        const next = tags.filter((t) => t.id !== tagId);
        setTags(next);
        onTagsChange?.(next);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tags</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="flex items-center gap-1 rounded-full border border-black/[.12] px-2 py-0.5 text-xs text-zinc-700 dark:border-white/[.16] dark:text-zinc-200"
          >
            #{tag.name}
            <button
              type="button"
              onClick={() => handleRemove(tag.id)}
              disabled={pending}
              aria-label={`Remover tag ${tag.name}`}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={inputId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          onBlur={handleAdd}
          placeholder="+ tag"
          disabled={pending}
          autoFocus={autoFocusInput}
          className="w-20 rounded-full border border-dashed border-black/[.2] bg-transparent px-2 py-0.5 text-xs focus:outline-none dark:border-white/[.24]"
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
