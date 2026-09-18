"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { SlashCommandItem } from "./slash-commands";

export interface SlashCommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashCommandListProps {
  items: SlashCommandItem[];
  onSelect: (item: SlashCommandItem) => void;
}

export const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(function SlashCommandList(
  { items, onSelect },
  ref,
) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false;
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = items[selectedIndex];
        if (item) onSelect(item);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-black/[.08] bg-white p-2 text-sm text-zinc-400 shadow-lg dark:border-white/[.08] dark:bg-zinc-900 dark:text-zinc-500">
        Nenhum comando
      </div>
    );
  }

  return (
    <div className="flex max-h-72 w-56 flex-col gap-0.5 overflow-y-auto rounded-lg border border-black/[.08] bg-white p-1 shadow-lg dark:border-white/[.08] dark:bg-zinc-900">
      {items.map((item, index) => (
        <button
          key={item.title}
          type="button"
          onClick={() => onSelect(item)}
          className={`truncate rounded-md px-2 py-1.5 text-left text-sm ${
            index === selectedIndex
              ? "bg-black/[.06] dark:bg-white/[.1]"
              : "hover:bg-black/[.04] dark:hover:bg-white/[.06]"
          }`}
        >
          {item.title}
        </button>
      ))}
    </div>
  );
});
