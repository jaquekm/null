"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { applyInboxOrganizationBatch, previewInboxOrganization } from "@/features/ai/actions";
import type { InboxSuggestion } from "@/features/ai/prompts/organize-inbox";
import type { InboxItemRow, TypeOptionWithFields } from "@/features/items/queries";
import type { SidebarSpace } from "@/features/spaces/queries";

interface OrganizeInboxPanelProps {
  items: InboxItemRow[];
  spaces: SidebarSpace[];
  types: TypeOptionWithFields[];
}

interface ReviewRow {
  itemId: string;
  title: string;
  suggestion: InboxSuggestion;
  accepted: boolean;
}

/**
 * "Organizar inbox" (6.8): uma sugestão por item (espaço/tipo/tags/título),
 * revisável com checkbox por item — "aplicar individual" (botão por linha) ou
 * "em lote" (`applyInboxOrganizationBatch`, todos os aceitos de uma vez).
 * Fica fora de `InboxWorkspace` de propósito: aquele componente guarda a
 * lista em estado local (`useState(initialItems)`), então `router.refresh()`
 * não bastaria pra tirar os itens já organizados da lista — `window.location.reload()`
 * garante isso sem mexer num componente já grande e testado.
 */
export function OrganizeInboxPanel({ items, spaces, types }: OrganizeInboxPanelProps) {
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [pending, startTransition] = useTransition();

  function spaceName(id: string | null): string | null {
    return id ? (spaces.find((space) => space.id === id)?.name ?? null) : null;
  }
  function typeName(id: string | null): string | null {
    return id ? (types.find((type) => type.id === id)?.name ?? null) : null;
  }

  function handleGenerate() {
    if (items.length === 0) return;
    startTransition(async () => {
      const result = await previewInboxOrganization(items.map((item) => item.id));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const built = items
        .filter((item) => result.data[item.id])
        .map((item) => ({ itemId: item.id, title: item.title || "Sem título", suggestion: result.data[item.id]!, accepted: true }));
      setRows(built);
    });
  }

  function handleApply(entries: ReviewRow[]) {
    if (entries.length === 0) return;
    startTransition(async () => {
      const result = await applyInboxOrganizationBatch(entries.map((row) => ({ itemId: row.itemId, ...row.suggestion })));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.location.reload();
    });
  }

  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      {!rows ? (
        <button type="button" onClick={handleGenerate} disabled={pending} className="self-start rounded-full border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
          {pending ? "Gerando sugestões…" : "Organizar inbox com IA"}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-black/[.08] p-3 dark:border-white/[.08]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-black dark:text-zinc-50">Sugestões ({rows.length})</p>
            <button
              type="button"
              onClick={() => handleApply(rows.filter((row) => row.accepted))}
              disabled={pending || !rows.some((row) => row.accepted)}
              className="rounded-full border border-black/[.12] px-3 py-1 text-xs dark:border-white/[.16]"
            >
              {pending ? "Aplicando…" : "Aplicar selecionados"}
            </button>
          </div>

          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.itemId} className="flex flex-col gap-1.5 rounded-lg border border-black/[.06] p-2 text-sm dark:border-white/[.08]">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={row.accepted}
                    onChange={(e) => setRows((prev) => prev!.map((r) => (r.itemId === row.itemId ? { ...r, accepted: e.target.checked } : r)))}
                    className="mt-1"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium text-black dark:text-zinc-50">{row.title}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {[
                        row.suggestion.title && `Novo título: ${row.suggestion.title}`,
                        spaceName(row.suggestion.spaceId) && `Espaço: ${spaceName(row.suggestion.spaceId)}`,
                        typeName(row.suggestion.typeId) && `Tipo: ${typeName(row.suggestion.typeId)}`,
                        row.suggestion.tags.length > 0 && `Tags: ${row.suggestion.tags.join(", ")}`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Nenhuma sugestão pra este item."}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={() => handleApply([row])} disabled={pending} className="self-start rounded-full border border-black/[.12] px-2.5 py-0.5 text-xs dark:border-white/[.16]">
                  Aplicar só este
                </button>
              </li>
            ))}
          </ul>

          <button type="button" onClick={() => setRows(null)} disabled={pending} className="self-start text-xs text-zinc-500 hover:underline dark:text-zinc-400">
            Cancelar
          </button>
        </div>
      )}
    </section>
  );
}
