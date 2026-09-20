"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { SidebarSpace } from "@/features/spaces/queries";
import { importVCardContacts, type ImportSummary } from "../actions";

/** Diálogo "Importar vCard" (3.3) — exportação do Google Contatos/iPhone (`.vcf`). */
export function ImportVCardDialog({ spaces, onClose, onImported }: { spaces: SidebarSpace[]; onClose: () => void; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [spaceId, setSpaceId] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(file: File) {
    startTransition(async () => {
      const text = await file.text();
      const result = await importVCardContacts(text, spaceId || null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSummary(result.data);
      onImported();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Importar vCard (.vcf)</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">×</button>
        </div>

        {!summary ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Espaço (opcional)
              <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className="rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.16]">
                <option value="">Nenhum</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>{space.name}</option>
                ))}
              </select>
            </label>
            <input
              ref={inputRef}
              type="file"
              accept=".vcf,text/vcard"
              disabled={pending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {pending && <p className="text-xs text-zinc-500 dark:text-zinc-400">Importando…</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <p>{summary.created} contato(s) criado(s).</p>
            {summary.skipped.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {summary.skipped.length} ignorado(s) por já existir (telefone/e-mail igual):
                </p>
                <ul className="flex flex-col gap-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {summary.skipped.map((s) => (
                    <li key={s.name}>{s.name} → já é {s.existingName}</li>
                  ))}
                </ul>
              </div>
            )}
            <button type="button" onClick={onClose} className="mt-2 self-start rounded-full border border-black/[.12] px-4 py-1.5 text-xs dark:border-white/[.16]">
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
