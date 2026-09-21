"use client";

import { useState } from "react";

/**
 * Tags de `fin_transactions.tags` (`text[]` puro) — não passa por `item_tags`
 * como o `TagSelector` de itens (1.8), então é um componente próprio sobre
 * estado local, salvo junto com o resto do formulário (sem round-trip por tag).
 */
export function TagChipsInput({ value, onChange, disabled }: { value: string[]; onChange: (tags: string[]) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState("");

  function commit() {
    const tag = draft.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-black/[.12] px-2 py-1.5 dark:border-white/[.16]">
      {value.map((tag) => (
        <span key={tag} className="flex items-center gap-1 rounded-full bg-black/[.06] px-2 py-0.5 text-xs text-zinc-700 dark:bg-white/[.1] dark:text-zinc-200">
          {tag}
          <button type="button" onClick={() => remove(tag)} disabled={disabled} aria-label={`Remover tag ${tag}`} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            remove(value[value.length - 1]!);
          }
        }}
        onBlur={commit}
        disabled={disabled}
        placeholder={value.length === 0 ? "Adicionar tag…" : ""}
        className="min-w-24 flex-1 bg-transparent text-sm focus:outline-none"
      />
    </div>
  );
}
