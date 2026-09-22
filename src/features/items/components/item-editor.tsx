"use client";

import type { JSONContent } from "@tiptap/core";
import { useState } from "react";
import { ItemContentEditor } from "./editor/item-content-editor";
import { ListModeView } from "./list-mode-view";
import type { ItemDetail } from "../queries";
import { PropertiesPanel } from "./properties-panel";
import { TitleEditor } from "./title-editor";

export function ItemEditor({ item }: { item: ItemDetail }) {
  const [updatedAt, setUpdatedAt] = useState(item.updatedAt);
  const [content, setContent] = useState<JSONContent | null>(item.content);
  const [listMode, setListMode] = useState(item.type?.slug === "lista");

  const isLista = item.type?.slug === "lista";

  function handleSaved(nextUpdatedAt: string) {
    setUpdatedAt(nextUpdatedAt);
  }

  return (
    <div className="flex flex-col gap-4">
      <TitleEditor itemId={item.id} initialTitle={item.title} updatedAt={updatedAt} onSaved={handleSaved} />
      {item.type && (
        <PropertiesPanel
          itemId={item.id}
          fields={item.type.fields}
          properties={item.properties}
          updatedAt={updatedAt}
          onSaved={handleSaved}
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
