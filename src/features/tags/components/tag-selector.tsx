"use client";

import { useState, useTransition } from "react";
import { addTagToItem, removeTagFromItem } from "../actions";
import type { TagOption } from "../queries";

export function TagSelector({ itemId, tags: initialTags }: { itemId: string; tags: TagOption[] }) {
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
        setTags((current) => (current.some((t) => t.id === tag.id) ? current : [...current, tag]));
      }
      setInput("");
    });
  }

  function handleRemove(tagId: string) {
    startTransition(async () => {
      const result = await removeTagFromItem(itemId, tagId);
      if (result.ok) setTags((current) => current.filter((t) => t.id !== tagId));
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
