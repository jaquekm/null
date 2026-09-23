"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createRelatedLinkAction } from "../actions";
import type { RelatedItemRow } from "../queries";

/** "Talvez relacionado" (6.6): vizinhos por embedding, com "Criar link" — mesmo estilo visual de `BacklinksPanel`. */
export function RelatedItemsPanel({ itemId, relatedItems }: { itemId: string; relatedItems: RelatedItemRow[] }) {
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
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

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-black dark:text-zinc-50">Talvez relacionado</h2>
      <ul className="flex flex-col gap-1">
        {relatedItems.map((related) => (
          <li key={related.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm">
            <Link href={`/itens/${related.id}`} className="min-w-0 truncate text-black hover:underline dark:text-zinc-50">
              {related.title || "Sem título"}
            </Link>
            {linkedIds.has(related.id) ? (
              <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">Linkado</span>
            ) : (
              <button
                type="button"
                onClick={() => handleCreateLink(related.id)}
                disabled={pendingId === related.id}
                className="shrink-0 rounded-full border border-black/[.12] px-3 py-1 text-xs dark:border-white/[.16]"
              >
                {pendingId === related.id ? "Criando..." : "Criar link"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
