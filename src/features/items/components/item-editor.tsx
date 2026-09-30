"use client";

import type { JSONContent } from "@tiptap/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HabitTracker } from "@/features/habits/components/habit-tracker";
import type { HabitLog } from "@/features/habits/lib/habit-log";
import { expiryOf } from "@/features/documents/lib/expiry";
import { ItemContentEditor } from "./editor/item-content-editor";
import { ExpiryField } from "./expiry-field";
import { changeItemType } from "../actions";
import { LIST_STYLE_INFO, listStyleOf } from "../lib/list-styles";
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
  noteTypeId = null,
}: {
  item: ItemDetail;
  /** Tipo "Nota" da dona — "Não é uma lista? Virar nota" (troca o tipo, o texto fica). */
  noteTypeId?: string | null;
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
  const router = useRouter();
  const [converting, startConverting] = useTransition();

  const isLista = item.type?.slug === "lista";
  const isHabito = item.type?.slug === "habito";
  // Validade (9.5): sempre nos documentos e receitas (10.7); em outros tipos, só se já tiver uma data.
  const showExpiry = Boolean(today) && (["documento", "receita"].includes(item.type?.slug ?? "") || expiry !== null);

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
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Mostrar como</span>
            <div role="radiogroup" aria-label="Mostrar como" className="inline-flex rounded-lg border border-black/[.1] p-0.5 dark:border-white/[.12]">
              {(
                [
                  [true, "Lista"],
                  [false, "Texto"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={listMode === value}
                  onClick={() => setListMode(value)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    listMode === value ? "bg-brand text-brand-fg" : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-300 dark:hover:bg-white/[.06]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {noteTypeId && (
              <button
                type="button"
                disabled={converting}
                onClick={() =>
                  startConverting(async () => {
                    const result = await changeItemType(item.id, noteTypeId);
                    if (result.ok) router.refresh();
                  })
                }
                className="text-xs text-zinc-500 underline-offset-2 hover:underline disabled:opacity-60 dark:text-zinc-400"
              >
                Não é uma lista? Virar nota
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {listMode
              ? `${LIST_STYLE_INFO[listStyle].description} Seu texto fica em cima da lista.`
              : "Escreva à vontade. As linhas com caixinha (digite [ ] no começo) viram os itens da lista."}
          </p>
        </div>
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
          onEditText={() => setListMode(false)}
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
