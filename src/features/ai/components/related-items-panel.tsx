"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createRelatedLinkAction, explainRelatedItem } from "../actions";
import type { RelatedItemRow } from "../queries";

/**
 * "Talvez relacionado" (6.6) + "Sugerir conexões" (6.8, explicação do
 * porquê): vizinhos por embedding, com "Criar link" e um "Por quê?" sob
 * demanda por item — gerar a explicação de todos automaticamente ao abrir a
 * página gastaria orçamento de IA só de olhar o item.
 */
export function RelatedItemsPanel({ itemId, relatedItems }: { itemId: string; relatedItems: RelatedItemRow[] }) {
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explainingId, setExplainingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  if (relatedItems.length === 0) return null;

  function handleCreateLink(relatedItemId: string) {
    setPendingId(relatedItemId);
    startTransition(async () => {
      const result = await createRelatedLinkAction(itemId, relatedItemId);
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLinkedIds((prev) => new Set(prev).add(relatedItemId));
      router.refresh();
    });
  }

  function handleExplain(relatedItemId: string) {
    setExplainingId(relatedItemId);
    startTransition(async () => {
      const result = await explainRelatedItem(itemId, relatedItemId);
      setExplainingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setExplanations((prev) => ({ ...prev, [relatedItemId]: result.data }));
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-black dark:text-zinc-50">Talvez relacionado</h2>
      <ul className="flex flex-col gap-1">
        {relatedItems.map((related) => (
          <li key={related.id} className="flex flex-col gap-0.5 rounded-lg px-2 py-1.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/itens/${related.id}`} className="min-w-0 truncate text-black hover:underline dark:text-zinc-50">
                {related.title || "Sem título"}
              </Link>
              <div className="flex shrink-0 items-center gap-1.5">
                {!explanations[related.id] && (
                  <button
                    type="button"
                    onClick={() => handleExplain(related.id)}
                    disabled={explainingId === related.id}
                    className="rounded-full border border-black/[.12] px-3 py-1 text-xs dark:border-white/[.16]"
                  >
                    {explainingId === related.id ? "Pensando..." : "Por quê?"}
                  </button>
                )}
                {linkedIds.has(related.id) ? (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">Linkado</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCreateLink(related.id)}
                    disabled={pendingId === related.id}
                    className="rounded-full border border-black/[.12] px-3 py-1 text-xs dark:border-white/[.16]"
                  >
                    {pendingId === related.id ? "Criando..." : "Criar link"}
                  </button>
                )}
              </div>
            </div>
            {explanations[related.id] && <p className="text-xs text-zinc-500 dark:text-zinc-400">{explanations[related.id]}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
