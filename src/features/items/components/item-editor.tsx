"use client";

import type { JSONContent } from "@tiptap/core";
import { useState } from "react";
import { HabitTracker } from "@/features/habits/components/habit-tracker";
import type { HabitLog } from "@/features/habits/lib/habit-log";
import { expiryOf } from "@/features/documents/lib/expiry";
import { ItemContentEditor } from "./editor/item-content-editor";
import { ExpiryField } from "./expiry-field";
import { listStyleOf } from "../lib/list-styles";
import { ListModeView } from "./list-mode-view";
import { ListStylePicker } from "./list-style-picker";
import type { ItemDetail } from "../queries";
import { PropertiesPanel } from "./properties-panel";
import { TitleEditor } from "./title-editor";

export function ItemEditor({
  item,
  timezone,
  today,
  expirySuggestion = null,
}: {
  item: ItemDetail;
  timezone?: string;
  /** Hoje (yyyy-MM-dd) no fuso da dona — pra mostrar quanto falta pra vencer. */
  today?: string;
  /** Validade lida no texto de um anexo (9.5), pra sugerir. */
  expirySuggestion?: string | null;
}) {
  const [updatedAt, setUpdatedAt] = useState(item.updatedAt);
  const [content, setContent] = useState<JSONContent | null>(item.content);
  const [listMode, setListMode] = useState(item.type?.slug === "lista");
  const [listStyle, setListStyle] = useState(listStyleOf(item.properties));
  const [expiry, setExpiry] = useState(expiryOf(item.properties));

  const isLista = item.type?.slug === "lista";
  const isHabito = item.type?.slug === "habito";
  // Validade (9.5): sempre nos documentos; em outros tipos, só se já tiver uma data.
  const showExpiry = Boolean(today) && (item.type?.slug === "documento" || expiry !== null);

  function handleSaved(nextUpdatedAt: string) {
    setUpdatedAt(nextUpdatedAt);
  }

  return (
    <div className="flex flex-col gap-4">
      <TitleEditor itemId={item.id} initialTitle={item.title} updatedAt={updatedAt} onSaved={handleSaved} />

      {item.type && (
        <PropertiesPanel
          // Primeiro campo da grade, onde ficava o antigo "Tipo de lista" (assunto): um seletor só.
          leading={
            isLista ? (
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
            ) : showExpiry ? (
              <ExpiryField
                itemId={item.id}
                value={expiry}
                updatedAt={updatedAt}
                today={today!}
                suggestion={expirySuggestion}
                onChange={(value, nextUpdatedAt) => {
                  setExpiry(value);
                  handleSaved(nextUpdatedAt);
                }}
              />
            ) : null
          }
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
          timezone={timezone}
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
