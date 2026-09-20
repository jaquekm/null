"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { mergeContacts, searchContactsForMention } from "../actions";

/** Diálogo "Mesclar" (3.3) — busca o outro contato, dono escolhe qual fica; o outro é apagado depois de mover os vínculos. */
export function MergeContactsDialog({
  contactId,
  contactName,
  onClose,
}: {
  contactId: string;
  contactName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [other, setOther] = useState<{ id: string; name: string } | null>(null);
  const [keepId, setKeepId] = useState(contactId);
  const [pending, startTransition] = useTransition();

  async function handleSearch(value: string) {
    setQuery(value);
    setOther(null);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const found = await searchContactsForMention(value);
    setResults(found.filter((r) => r.id !== contactId));
  }

  function handleMerge() {
    if (!other) return;
    const discardId = keepId === contactId ? other.id : contactId;
    startTransition(async () => {
      const result = await mergeContacts(keepId, discardId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Contatos mesclados.");
      onClose();
      router.push(`/contatos/${keepId}`);
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Mesclar contato</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">×</button>
        </div>

        {!other ? (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Mesclar &quot;{contactName}&quot; com…
              <input
                value={query}
                onChange={(e) => void handleSearch(e.target.value)}
                placeholder="Buscar contato"
                className="rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.16]"
              />
            </label>
            {results.length > 0 && (
              <ul className="flex flex-col gap-0.5">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setOther(r)}
                      className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                    >
                      {r.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-700 dark:text-zinc-200">Qual dos dois deve ficar? O outro é apagado depois de mover itens ligados, lembretes e histórico de mensagens.</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={keepId === contactId} onChange={() => setKeepId(contactId)} />
              {contactName}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={keepId === other.id} onChange={() => setKeepId(other.id)} />
              {other.name}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleMerge}
                disabled={pending}
                className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                {pending ? "Mesclando..." : "Confirmar mesclagem"}
              </button>
              <button type="button" onClick={() => setOther(null)} className="text-xs text-zinc-500 hover:underline">
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
