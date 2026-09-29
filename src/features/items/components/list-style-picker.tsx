"use client";

import { useState, useTransition } from "react";
import { setListStyle } from "../actions";
import { LIST_STYLE_INFO, listStyleSchema, listStyles, type ListStyle } from "../lib/list-styles";

const selectClassName =
  "w-full rounded-lg border border-black/[.08] bg-surface-muted px-3 py-2 text-sm transition-colors hover:border-black/[.16] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-60 dark:border-white/[.08] dark:hover:border-white/[.16]";

/**
 * "Tipo de lista": como a lista se comporta (o assunto/grupo é o espaço onde
 * ela está). Um menu de seleção só, no lugar do antigo campo de assunto —
 * a dona achou a fileira de botões poluída.
 */
export function ListStylePicker({
  itemId,
  value,
  updatedAt,
  onChange,
}: {
  itemId: string;
  value: ListStyle;
  updatedAt: string;
  onChange: (style: ListStyle, updatedAt: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(raw: string) {
    const parsed = listStyleSchema.safeParse(raw);
    if (!parsed.success || parsed.data === value) return;
    setError(null);
    startTransition(async () => {
      const result = await setListStyle(itemId, updatedAt, parsed.data);
      if (!result.ok) setError(result.error);
      else onChange(parsed.data, result.data.updatedAt);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`list-style-${itemId}`} className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Tipo de lista
      </label>
      <select
        id={`list-style-${itemId}`}
        value={value}
        disabled={pending}
        onChange={(e) => pick(e.target.value)}
        title={LIST_STYLE_INFO[value].description}
        className={selectClassName}
      >
        {listStyles.map((style) => (
          <option key={style} value={style}>
            {LIST_STYLE_INFO[style].label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
