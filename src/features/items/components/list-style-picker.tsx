"use client";

import { useState, useTransition } from "react";
import { setListStyle } from "../actions";
import { LIST_STYLE_INFO, listStyles, type ListStyle } from "../lib/list-styles";

/** "Tipo de lista": como a lista se comporta. O assunto/grupo é o espaço onde ela está. */
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

  function pick(style: ListStyle) {
    if (style === value) return;
    setError(null);
    startTransition(async () => {
      const result = await setListStyle(itemId, updatedAt, style);
      if (!result.ok) setError(result.error);
      else onChange(style, result.data.updatedAt);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`list-style-${itemId}`} className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Tipo de lista
      </span>
      <div role="radiogroup" aria-labelledby={`list-style-${itemId}`} className="flex flex-wrap gap-1.5">
        {listStyles.map((style) => (
          <button
            key={style}
            type="button"
            role="radio"
            aria-checked={style === value}
            disabled={pending}
            onClick={() => pick(style)}
            className={`rounded-full border px-3 py-1.5 text-sm disabled:opacity-60 ${
              style === value
                ? "border-transparent bg-black text-white dark:bg-white dark:text-black"
                : "border-black/[.12] text-zinc-600 hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-300 dark:hover:bg-white/[.06]"
            }`}
          >
            {LIST_STYLE_INFO[style].label}
          </button>
        ))}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{LIST_STYLE_INFO[value].description}</p>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
