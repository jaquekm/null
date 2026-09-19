"use client";

import type { JSONContent } from "@tiptap/core";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { FieldDefinition } from "@/features/types/schemas";
import { saveItemVersionNow } from "../actions";
import type { ItemVersionRow } from "../queries";
import { VersionDetailDialog } from "./version-detail-dialog";

const REASON_LABELS: Record<string, string> = {
  auto: "Automático",
  manual: "Manual",
  restore: "Restauração",
  ai: "IA",
};

export function VersionsPanel({
  itemId,
  versions,
  fields,
  currentContent,
  currentProperties,
}: {
  itemId: string;
  versions: ItemVersionRow[];
  fields: FieldDefinition[];
  currentContent: JSONContent | null;
  currentProperties: Record<string, unknown>;
}) {
  const [openVersion, setOpenVersion] = useState<ItemVersionRow | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSaveNow() {
    const label = window.prompt("Rótulo desta versão (opcional)");
    if (label === null) return;
    startTransition(async () => {
      const result = await saveItemVersionNow(itemId, label);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Versão salva");
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">Versões</h2>
        <button
          type="button"
          disabled={pending}
          onClick={handleSaveNow}
          className="rounded-full border border-black/[.12] px-3 py-1 text-xs text-zinc-600 transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-300 dark:hover:bg-white/[.06]"
        >
          Salvar versão agora
        </button>
      </div>

      {versions.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma versão salva ainda.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {versions.map((version) => (
            <li key={version.id}>
              <button
                type="button"
                onClick={() => setOpenVersion(version)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-black/[.04] dark:hover:bg-white/[.06]"
              >
                <span className="truncate text-black dark:text-zinc-50">
                  {version.label || version.title || "Sem título"}
                </span>
                <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                  {REASON_LABELS[version.reason] ?? version.reason} ·{" "}
                  {new Date(version.createdAt).toLocaleString("pt-BR")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {openVersion && (
        <VersionDetailDialog
          itemId={itemId}
          version={openVersion}
          fields={fields}
          currentContent={currentContent}
          currentProperties={currentProperties}
          onClose={() => setOpenVersion(null)}
          onRestored={() => setOpenVersion(null)}
        />
      )}
    </section>
  );
}
