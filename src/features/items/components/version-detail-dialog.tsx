"use client";

import type { JSONContent } from "@tiptap/core";
import { diffWords } from "diff";
import { X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { FieldDefinition } from "@/features/types/schemas";
import { formatPropertyValue } from "@/features/views/lib/format-property-value";
import { getItemVersionDetail, restoreItemVersion } from "../actions";
import { diffProperties } from "../lib/diff-properties";
import { extractText } from "../lib/extract-text";
import type { ItemVersionRow } from "../queries";

const REASON_LABELS: Record<string, string> = {
  auto: "Automático",
  manual: "Manual",
  restore: "Restauração",
  ai: "IA",
};

interface VersionDetail {
  id: string;
  title: string;
  content: JSONContent | null;
  properties: Record<string, unknown>;
}

export function VersionDetailDialog({
  itemId,
  version,
  fields,
  currentContent,
  currentProperties,
  onClose,
  onRestored,
}: {
  itemId: string;
  version: ItemVersionRow;
  fields: FieldDefinition[];
  currentContent: JSONContent | null;
  currentProperties: Record<string, unknown>;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [detail, setDetail] = useState<VersionDetail | null>(null);
  const [mode, setMode] = useState<"ver" | "comparar">("ver");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getItemVersionDetail(itemId, version.id).then(setDetail);
  }, [itemId, version.id]);

  const ready = detail !== null && detail.id === version.id;

  function handleRestore() {
    if (!window.confirm("Restaurar esta versão? O estado atual vira uma nova versão antes de ser substituído.")) return;
    startTransition(async () => {
      const result = await restoreItemVersion(itemId, version.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Versão restaurada");
      onRestored();
    });
  }

  const textDiff = ready && mode === "comparar" ? diffWords(extractText(detail.content), extractText(currentContent)) : null;
  const propertyDiff = ready && mode === "comparar" ? diffProperties(detail.properties, currentProperties, fields) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-lg border border-black/[.08] bg-white shadow-xl dark:border-white/[.08] dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-black/[.08] px-4 py-3 dark:border-white/[.08]">
          <div>
            <h2 className="text-sm font-medium text-black dark:text-zinc-50">{version.title || "Sem título"}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {REASON_LABELS[version.reason] ?? version.reason} · {new Date(version.createdAt).toLocaleString("pt-BR")}
              {version.label ? ` · "${version.label}"` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-4 border-b border-black/[.08] px-4 py-2 text-sm dark:border-white/[.08]">
          <button
            type="button"
            onClick={() => setMode("ver")}
            className={mode === "ver" ? "font-medium text-black dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}
          >
            Ver
          </button>
          <button
            type="button"
            onClick={() => setMode("comparar")}
            className={mode === "comparar" ? "font-medium text-black dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}
          >
            Comparar com atual
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 text-sm">
          {!ready && <p className="text-zinc-500 dark:text-zinc-400">Carregando...</p>}

          {ready && mode === "ver" && (
            <div className="flex flex-col gap-3">
              <p className="font-medium text-black dark:text-zinc-50">{detail.title || "Sem título"}</p>
              <pre className="font-sans text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {extractText(detail.content) || "(vazio)"}
              </pre>
              {fields.length > 0 && (
                <dl className="flex flex-col gap-1 border-t border-black/[.08] pt-3 dark:border-white/[.08]">
                  {fields.map((field) => (
                    <div key={field.key} className="flex justify-between gap-4">
                      <dt className="text-zinc-500 dark:text-zinc-400">{field.label}</dt>
                      <dd className="text-right text-black dark:text-zinc-50">
                        {formatPropertyValue(detail.properties[field.key], field)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          {ready && mode === "comparar" && (
            <div className="flex flex-col gap-3">
              <p className="leading-relaxed whitespace-pre-wrap">
                {textDiff?.map((part, index) => (
                  <span
                    key={index}
                    className={
                      part.added
                        ? "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200"
                        : part.removed
                          ? "bg-red-100 text-red-900 line-through dark:bg-red-900/40 dark:text-red-200"
                          : undefined
                    }
                  >
                    {part.value}
                  </span>
                ))}
              </p>
              {propertyDiff.length > 0 ? (
                <dl className="flex flex-col gap-1 border-t border-black/[.08] pt-3 dark:border-white/[.08]">
                  {propertyDiff.map((entry) => (
                    <div key={entry.key} className="flex justify-between gap-4">
                      <dt className="text-zinc-500 dark:text-zinc-400">{entry.label}</dt>
                      <dd className="text-right text-black dark:text-zinc-50">
                        <span className="text-red-600 line-through dark:text-red-400">{entry.oldValue}</span>
                        {" → "}
                        <span className="text-green-700 dark:text-green-400">{entry.newValue}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">Nenhuma propriedade mudou.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-black/[.08] px-4 py-3 dark:border-white/[.08]">
          <button
            type="button"
            disabled={pending || !ready}
            onClick={handleRestore}
            className="bg-foreground text-background rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Restaurando..." : "Restaurar esta versão"}
          </button>
        </div>
      </div>
    </div>
  );
}
