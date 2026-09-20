"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { SidebarSpace } from "@/features/spaces/queries";
import { importCsvContacts, type ImportSummary } from "../actions";
import { parseCsv, type ParsedCsv } from "../lib/parse-csv";
import { CSV_COLUMN_LABELS, csvColumnKeys, type CsvColumnKey } from "../schemas";

/** Diálogo "Importar CSV" (3.3) — parse no cliente (`parseCsv`), dono mapeia cada coluna antes de importar. */
export function ImportCsvDialog({ spaces, onClose, onImported }: { spaces: SidebarSpace[]; onClose: () => void; onImported: () => void }) {
  const [spaceId, setSpaceId] = useState("");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Record<number, CsvColumnKey>>({});
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleFile(file: File) {
    const text = await file.text();
    const result = parseCsv(text);
    setParsed(result);
    // tenta adivinhar o mapeamento pelo nome do cabeçalho, senão "ignorar".
    const guessed: Record<number, CsvColumnKey> = {};
    result.headers.forEach((header, index) => {
      const normalized = header.trim().toLowerCase();
      const match = csvColumnKeys.find((key) => key !== "ignore" && CSV_COLUMN_LABELS[key].toLowerCase().includes(normalized));
      guessed[index] = match ?? (normalized.includes("nome") ? "name" : normalized.includes("mail") ? "email" : normalized.includes("tel") || normalized.includes("fone") ? "phone" : "ignore");
    });
    setMapping(guessed);
  }

  function handleImport() {
    if (!parsed) return;
    startTransition(async () => {
      const result = await importCsvContacts({
        rows: parsed.rows,
        mapping: Object.fromEntries(Object.entries(mapping).map(([k, v]) => [k, v])),
        spaceId: spaceId || null,
      });
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
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg border border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Importar CSV</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">×</button>
        </div>

        {summary ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>{summary.created} contato(s) criado(s).</p>
            {summary.skipped.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{summary.skipped.length} ignorado(s) por já existir:</p>
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
        ) : !parsed ? (
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
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{parsed.rows.length} linha(s) encontrada(s). Confira o mapeamento de colunas:</p>
            <div className="flex flex-col gap-2">
              {parsed.headers.map((header, index) => (
                <div key={index} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">{header || `Coluna ${index + 1}`}</span>
                  <select
                    value={mapping[index] ?? "ignore"}
                    onChange={(e) => setMapping((m) => ({ ...m, [index]: e.target.value as CsvColumnKey }))}
                    className="rounded-lg border border-black/[.12] bg-transparent px-2 py-1 text-xs dark:border-white/[.16]"
                  >
                    {csvColumnKeys.map((key) => (
                      <option key={key} value={key}>{CSV_COLUMN_LABELS[key]}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleImport}
              disabled={pending || !Object.values(mapping).includes("name")}
              className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
            >
              {pending ? "Importando..." : "Importar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
