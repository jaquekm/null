"use client";

import type { JSONContent } from "@tiptap/core";
import { useState } from "react";
import { HabitTracker } from "@/features/habits/components/habit-tracker";
import type { HabitLog } from "@/features/habits/lib/habit-log";
import { ItemContentEditor } from "./editor/item-content-editor";
import { listStyleOf } from "../lib/list-styles";
import { ListModeView } from "./list-mode-view";
import { ListStylePicker } from "./list-style-picker";
import type { ItemDetail } from "../queries";
import { PropertiesPanel } from "./properties-panel";
import { TitleEditor } from "./title-editor";

export function ItemEditor({ item }: { item: ItemDetail }) {
  const [updatedAt, setUpdatedAt] = useState(item.updatedAt);
  const [content, setContent] = useState<JSONContent | null>(item.content);
  const [listMode, setListMode] = useState(item.type?.slug === "lista");
  const [listStyle, setListStyle] = useState(listStyleOf(item.properties));

  const isLista = item.type?.slug === "lista";
  const isHabito = item.type?.slug === "habito";

  function handleSaved(nextUpdatedAt: string) {
    setUpdatedAt(nextUpdatedAt);
  }

  return (
    <div className="flex flex-col gap-4">
      <TitleEditor itemId={item.id} initialTitle={item.title} updatedAt={updatedAt} onSaved={handleSaved} />

      {/* Logo abaixo do nome: o tipo decide como a lista funciona, é a primeira escolha depois de dar o nome. */}
      {isLista && (
        <ListStylePicker
          itemId={item.id}
          value={listStyle}
          updatedAt={updatedAt}
          onChange={(style, nextUpdatedAt) => {
            setListStyle(style);
            setListMode(true);
            handleSaved(nextUpdatedAt);
          }}
        />
      )}

      {item.type && (
        <PropertiesPanel
          itemId={item.id}
          typeSlug={item.type.slug}
          fields={item.type.fields}
          properties={item.properties}
          updatedAt={updatedAt}
          onSaved={handleSaved}
        />
      )}

      {isHabito && (
        <HabitTracker
          itemId={item.id}
          initialLog={(item.properties.log as HabitLog | undefined) ?? {}}
          targetPerPeriod={typeof item.properties.target_per_period === "number" ? item.properties.target_per_period : null}
        />
      )}

      {isLista && (
        <button
          type="button"
          onClick={() => setListMode((value) => !value)}
          className="self-start rounded-lg border border-black/[.12] px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-300 dark:hover:bg-white/[.06]"
        >
          {listMode ? "Editor completo" : "Modo lista"}
        </button>
      )}

      {isLista && listMode ? (
        <ListModeView
          itemId={item.id}
          style={listStyle}
          content={content}
          updatedAt={updatedAt}
          onSaved={handleSaved}
          onContentChange={setContent}
        />
      ) : (
        <ItemContentEditor
          itemId={item.id}
          spaceId={item.space?.id ?? null}
          initialContent={content}
          updatedAt={updatedAt}
          onSaved={handleSaved}
          onContentSaved={setContent}
        />
      )}
    </div>
  );
}
