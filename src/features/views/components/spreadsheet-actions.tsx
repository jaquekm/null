"use client";

import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { FieldDefinition } from "@/features/types/schemas";
import { exportViewSpreadsheet, importSpreadsheetRows } from "../actions";
import { MAX_IMPORT_ROWS, planSheetImport, readSheetRows, type SheetImportPlan } from "../lib/sheet-import";
import type { ViewFilter, ViewSort } from "../schemas";

const buttonClassName =
  "flex items-center gap-1.5 rounded-lg border border-black/[.12] px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]";

function downloadBase64(base64: string, fileName: string) {
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * "Baixar Excel" e "Importar planilha" da Tabela (9.6). A importação lê o
 * arquivo aqui no navegador, mostra como cada coluna vai entrar e só cria
 * os itens depois do "Importar".
 */
export function SpreadsheetActions({
  spaceId,
  typeId,
  viewName,
  fields,
  filters,
  sort,
  visibleFields,
  onImported,
}: {
  spaceId: string | null;
  typeId: string | null;
  viewName: string;
  fields: FieldDefinition[];
  filters: ViewFilter[];
  sort: ViewSort[];
  visibleFields?: string[];
  onImported: () => void;
}) {
  const [exporting, startExport] = useTransition();
  // Ler o arquivo e criar os itens são estados separados: com um só, a prévia abria dizendo "Importando…" e travada.
  const [reading, startReading] = useTransition();
  const [importing, startImport] = useTransition();
  const [plan, setPlan] = useState<(SheetImportPlan & { fileName: string }) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const labelByKey = new Map(fields.map((field) => [field.key, field.label]));

  function handleExport() {
    startExport(async () => {
      const result = await exportViewSpreadsheet({ spaceId, typeId, filters, sort, visibleFields, name: viewName });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      downloadBase64(result.data.base64, result.data.fileName);
      if (result.data.truncated) toast.message("A planilha leva só as primeiras 5.000 linhas — filtre pra exportar o resto.");
    });
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    startReading(async () => {
      try {
        const rows = await readSheetRows(file.name, new Uint8Array(await file.arrayBuffer()));
        const next = planSheetImport(rows, fields);
        if (next.rows.length === 0) {
          toast.error("Não achei linhas com título nessa planilha.");
          return;
        }
        setPlan({ ...next, fileName: file.name });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não consegui ler esse arquivo.");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  function handleConfirm() {
    if (!plan || !spaceId || !typeId) return;
    startImport(async () => {
      const result = await importSpreadsheetRows({ spaceId, typeId, rows: plan.rows });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.created} ${result.data.created === 1 ? "item importado" : "itens importados"}.`);
      setPlan(null);
      onImported();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleExport} disabled={exporting} className={buttonClassName}>
          <Download className="h-3.5 w-3.5" aria-hidden /> {exporting ? "Gerando…" : "Baixar Excel"}
        </button>
        {spaceId && typeId && (
          <>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={reading || importing} className={buttonClassName}>
              <Upload className="h-3.5 w-3.5" aria-hidden /> {reading ? "Lendo…" : "Importar planilha"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm,.csv,.tsv,.txt"
              className="hidden"
              aria-label="Escolher planilha"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </>
        )}
      </div>

      {plan && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-start sm:p-4 sm:pt-16" onClick={() => setPlan(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Importar planilha"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-t-3xl border border-black/[.08] bg-surface p-5 shadow-2xl sm:rounded-3xl dark:border-white/[.08]"
          >
            <h2 className="flex items-center gap-2 font-semibold text-black dark:text-zinc-50">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand-text">
                <FileSpreadsheet className="h-4 w-4" aria-hidden />
              </span>
              Importar {plan.fileName}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              <strong>{plan.rows.length}</strong> {plan.rows.length === 1 ? "linha vai virar item" : "linhas vão virar itens"}
              {plan.skipped > 0 && <> · {plan.skipped} sem título ficam de fora</>}
              {plan.rows.length >= MAX_IMPORT_ROWS && <> · só as primeiras {MAX_IMPORT_ROWS}</>}.
            </p>

            <ul className="flex flex-col gap-1 rounded-2xl bg-surface-muted p-3 text-sm">
              {plan.columns.map((column, index) => (
                <li key={`${column.header}-${index}`} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-200">{column.header || `Coluna ${index + 1}`}</span>
                  <span
                    className={`shrink-0 text-xs ${column.target.kind === "ignore" ? "text-zinc-400" : "font-medium text-brand-text"}`}
                  >
                    {column.target.kind === "title" ? "→ Título" : column.target.kind === "field" ? `→ ${labelByKey.get(column.target.key)}` : "não entra"}
                  </span>
                </li>
              ))}
            </ul>

            {plan.problems.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-amber-700 dark:text-amber-400">
                {plan.problems.map((problem) => (
                  <li key={problem.header}>
                    {problem.count} {problem.count === 1 ? "valor" : "valores"} em “{problem.header}” não deu pra ler (ex.: “{problem.example}”) — ficam em branco.
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              As colunas entram nos campos de mesmo nome. Pra levar uma coluna que ficou de fora, crie um campo com esse nome no tipo e importe de novo.
            </p>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPlan(null)} className={buttonClassName}>
                Cancelar
              </button>
              <button type="button" onClick={handleConfirm} disabled={importing} className="bg-brand text-brand-fg rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-60">
                {importing ? "Importando…" : `Importar ${plan.rows.length} ${plan.rows.length === 1 ? "item" : "itens"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
