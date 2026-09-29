"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { SidebarSpace, SpaceTypeOption } from "@/features/spaces/queries";
import {
  checkDuplicateItems,
  commitIcsImport,
  commitImport,
  listImportSpaceTypes,
  previewIcsImport,
  previewImport,
  undoIcsImportAction,
  undoImportBatchAction,
  type ImportCommitResult,
  type ImportPreviewResult,
} from "../actions";
import { readSpreadsheetHeaders, SPREADSHEET_COLUMN_ROLES, SPREADSHEET_DELIMITERS, type SpreadsheetColumnRole, type SpreadsheetDelimiter } from "../lib/parse-spreadsheet";
import type { ParsedIcsEvent } from "../lib/parse-ics";
import type { ImportSource } from "../types";
import { detectCsvDelimiter, readFileText } from "@/lib/csv";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const buttonClassName = "rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-fg disabled:opacity-60";
const secondaryButtonClassName = "rounded-full border border-black/[.12] px-4 py-2 text-sm dark:border-white/[.16]";

type WizardSource = ImportSource | "ics";
type Step = "source" | "file" | "mapping" | "destination" | "review" | "done";

const SOURCE_OPTIONS: { source: WizardSource; label: string; hint: string; accept: string }[] = [
  { source: "planilha", label: "Planilha (.csv)", hint: "cada linha vira um item — você escolhe qual coluna é título, categoria e subcategoria", accept: ".csv" },
  { source: "documento", label: "Documento (.docx)", hint: "um arquivo do Word — vira um item editável com o texto dele", accept: ".docx" },
  { source: "evernote", label: "Evernote", hint: "arquivo .enex exportado do Evernote", accept: ".enex" },
  { source: "obsidian", label: "Obsidian / Markdown", hint: "uma nota .md, ou um .zip com o vault inteiro", accept: ".md,.zip" },
  { source: "google_keep", label: "Google Keep", hint: "Google Takeout — um .json ou o .zip do Takeout", accept: ".json,.zip" },
  { source: "ics", label: "Calendário (.ics)", hint: "eventos antigos, só leitura, num calendário local \"Importado\"", accept: ".ics" },
];

const SPREADSHEET_COLUMN_ROLE_LABELS: Record<SpreadsheetColumnRole, string> = {
  ignore: "Ignorar",
  title: "Título",
  category: "Categoria",
  subcategory: "Subcategoria",
  body: "Incluir no corpo",
};

/** Limite de corpo de requisição da Vercel é 4,5 MB; sobra folga pro resto do FormData. */
const MAX_IMPORT_UPLOAD_BYTES = 4 * 1024 * 1024;

const SPREADSHEET_DELIMITER_LABELS: Record<SpreadsheetDelimiter, string> = { ",": "Vírgula ( , )", ";": "Ponto e vírgula ( ; )", "\t": "Tabulação" };

interface Props {
  spaces: SidebarSpace[];
}

export function ImportWizard({ spaces }: Props) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("source");
  const [source, setSource] = useState<WizardSource | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [icsPreview, setIcsPreview] = useState<{ events: ParsedIcsEvent[]; warnings: string[] } | null>(null);

  const [spreadsheetText, setSpreadsheetText] = useState("");
  const [spreadsheetDelimiter, setSpreadsheetDelimiter] = useState<SpreadsheetDelimiter>(",");
  const [spreadsheetColumns, setSpreadsheetColumns] = useState<SpreadsheetColumnRole[]>([]);
  const spreadsheetHeaders = spreadsheetText ? readSpreadsheetHeaders(spreadsheetText, spreadsheetDelimiter) : [];

  const [spaceId, setSpaceId] = useState<string>(spaces[0]?.id ?? "");
  const [types, setTypes] = useState<SpaceTypeOption[]>([]);
  const [typeId, setTypeId] = useState<string>("");

  const [tagRename, setTagRename] = useState<Record<string, string>>({});
  const [duplicateLocalIds, setDuplicateLocalIds] = useState<Set<string>>(new Set());
  const [excludedLocalIds, setExcludedLocalIds] = useState<Set<string>>(new Set());

  const [report, setReport] = useState<(ImportCommitResult & { source: ImportSource }) | { eventsCreated: number; batchId: string; source: "ics" } | null>(null);
  const [undone, setUndone] = useState(false);

  function reset() {
    setStep("source");
    setSource(null);
    setFile(null);
    setPreview(null);
    setIcsPreview(null);
    setSpreadsheetText("");
    setSpreadsheetColumns([]);
    setTagRename({});
    setDuplicateLocalIds(new Set());
    setExcludedLocalIds(new Set());
    setReport(null);
    setUndone(false);
  }

  function handlePickSource(picked: WizardSource) {
    setSource(picked);
    setStep("file");
  }

  function spreadsheetMappingFormValue() {
    return JSON.stringify({ delimiter: spreadsheetDelimiter, columns: spreadsheetColumns });
  }

  function handleFileChange(picked: File | null) {
    // A Vercel recusa corpo acima de ~4,5 MB antes de chegar no app — o erro
    // que voltava era genérico ("resposta inesperada do servidor").
    if (picked && picked.size > MAX_IMPORT_UPLOAD_BYTES) {
      setFile(null);
      toast.error(
        `Arquivo grande demais (${(picked.size / 1024 / 1024).toFixed(1)} MB). O limite é 4 MB — divida a exportação em partes menores (ex.: um caderno do Evernote por vez) ou tire as imagens do documento.`,
      );
      return;
    }
    setFile(picked);
    if (!picked || !source) return;

    if (source === "planilha") {
      startTransition(async () => {
        // Acentos de planilha salva pelo Excel no Windows + separador detectado (Excel em português usa ";").
        const text = await readFileText(picked);
        const delimiter = detectCsvDelimiter(text);
        setSpreadsheetText(text);
        setSpreadsheetDelimiter(delimiter);
        const headerCount = readSpreadsheetHeaders(text, delimiter).length;
        setSpreadsheetColumns(Array.from({ length: headerCount }, () => "ignore"));
        setStep("mapping");
      });
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("source", source === "ics" ? "" : source);
      formData.set("file", picked);

      if (source === "ics") {
        const result = await previewIcsImport(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setIcsPreview(result.data);
        setStep("review");
        return;
      }

      const result = await previewImport(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPreview(result.data);
      setExcludedLocalIds(new Set());
      setStep("destination");
      await loadTypesForPreselectedSpace();
    });
  }

  function handleMappingContinue() {
    if (!file || !source) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("source", source);
      formData.set("file", file);
      formData.set("mapping", spreadsheetMappingFormValue());

      const result = await previewImport(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPreview(result.data);
      setExcludedLocalIds(new Set());
      setStep("destination");
      await loadTypesForPreselectedSpace();
    });
  }

  // O espaço já vem pré-selecionado, mas os tipos só eram buscados ao trocar de espaço — a lista ficava vazia.
  async function loadTypesForPreselectedSpace() {
    if (spaceId && types.length === 0) setTypes(await listImportSpaceTypes(spaceId));
  }

  function handlePickSpace(nextSpaceId: string) {
    setSpaceId(nextSpaceId);
    setTypeId("");
    setTypes([]);
    if (!nextSpaceId) return;
    startTransition(async () => {
      setTypes(await listImportSpaceTypes(nextSpaceId));
    });
  }

  function handleContinueToReview() {
    if (!preview) return;
    startTransition(async () => {
      const result = await checkDuplicateItems(
        preview.items.map((i) => ({ localId: i.localId, title: i.title, createdAt: i.createdAt })),
        spaceId || null,
      );
      const duplicates = result.ok ? new Set(result.data) : new Set<string>();
      setDuplicateLocalIds(duplicates);
      setExcludedLocalIds(new Set(duplicates));
      setStep("review");
    });
  }

  function handleConfirm() {
    if (!source || !file) return;
    startTransition(async () => {
      if (source === "ics") {
        const formData = new FormData();
        formData.set("file", file);
        const result = await commitIcsImport(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setReport({ ...result.data, source: "ics" });
        setStep("done");
        return;
      }

      const formData = new FormData();
      formData.set("source", source);
      formData.set("file", file);
      formData.set("spaceId", spaceId);
      formData.set("typeId", typeId);
      formData.set("tagRename", JSON.stringify(tagRename));
      formData.set("excludeLocalIds", JSON.stringify([...excludedLocalIds]));
      if (source === "planilha") formData.set("mapping", spreadsheetMappingFormValue());

      const result = await commitImport(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setReport({ ...result.data, source });
      setStep("done");
    });
  }

  function handleUndo() {
    if (!report) return;
    startTransition(async () => {
      const result = report.source === "ics" ? await undoIcsImportAction(report.batchId) : await undoImportBatchAction(report.batchId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Antes dizia "desfeita" mesmo quando nada saía; itens que o dono editou ficam de propósito.
      const kept = "kept" in result.data && typeof result.data.kept === "number" ? result.data.kept : 0;
      toast.success(
        kept > 0
          ? `Importação desfeita: ${result.data.removed} item(ns) removido(s). ${kept} ficou(aram) porque você editou depois.`
          : `Importação desfeita: ${result.data.removed} item(ns) removido(s).`,
      );
      setUndone(true);
    });
  }

  function toggleExclude(localId: string) {
    setExcludedLocalIds((prev) => {
      const next = new Set(prev);
      if (next.has(localId)) next.delete(localId);
      else next.add(localId);
      return next;
    });
  }

  if (step === "source") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SOURCE_OPTIONS.map((option) => (
          <button
            key={option.source}
            type="button"
            onClick={() => handlePickSource(option.source)}
            className="flex flex-col gap-1 rounded-lg border border-black/[.08] p-4 text-left text-sm transition-colors hover:bg-black/[.04] dark:border-white/[.08] dark:hover:bg-white/[.06]"
          >
            <span className="font-medium text-black dark:text-zinc-50">{option.label}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{option.hint}</span>
          </button>
        ))}
      </div>
    );
  }

  const sourceLabel = SOURCE_OPTIONS.find((o) => o.source === source)!.label;

  if (step === "file") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Origem: <strong>{sourceLabel}</strong>
        </p>
        <input
          type="file"
          accept={SOURCE_OPTIONS.find((o) => o.source === source)!.accept}
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          disabled={pending}
          className="text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-black/[.12] file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-black/[.04] disabled:opacity-60 disabled:file:cursor-not-allowed dark:file:border-white/[.16] dark:file:text-zinc-200 dark:hover:file:bg-white/[.06]"
        />
        {pending && <p className="text-xs text-zinc-500 dark:text-zinc-400">Lendo o arquivo…</p>}
        <button type="button" onClick={reset} className={secondaryButtonClassName + " w-fit"}>
          Voltar
        </button>
      </div>
    );
  }

  if (step === "mapping" && source === "planilha") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Escolha o que cada coluna vira. <strong>Título</strong> é obrigatório — linhas sem valor nessa coluna são ignoradas. Categoria/Subcategoria viram campos do
          tipo que você escolher no próximo passo (ou tags, se ficar sem tipo/no Inbox).
        </p>

        <label className="flex flex-col gap-1 text-sm">
          Separador
          <select
            value={spreadsheetDelimiter}
            onChange={(e) => {
              const delimiter = e.target.value as SpreadsheetDelimiter;
              setSpreadsheetDelimiter(delimiter);
              // Outro separador = outras colunas; o mapeamento antigo apontaria pras colunas erradas.
              setSpreadsheetColumns(Array.from({ length: readSpreadsheetHeaders(spreadsheetText, delimiter).length }, () => "ignore"));
            }}
            className={inputClassName}
          >
            {SPREADSHEET_DELIMITERS.map((d) => (
              <option key={d} value={d}>
                {SPREADSHEET_DELIMITER_LABELS[d]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2">
          {spreadsheetHeaders.map((header, index) => (
            <label key={index} className="flex items-center gap-2 text-sm">
              <span className="w-40 shrink-0 truncate text-zinc-700 dark:text-zinc-200">{header || `Coluna ${index + 1}`}</span>
              <select
                value={spreadsheetColumns[index] ?? "ignore"}
                onChange={(e) =>
                  setSpreadsheetColumns((prev) => {
                    const next = [...prev];
                    next[index] = e.target.value as SpreadsheetColumnRole;
                    return next;
                  })
                }
                className={inputClassName + " flex-1"}
              >
                {SPREADSHEET_COLUMN_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {SPREADSHEET_COLUMN_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={reset} className={secondaryButtonClassName}>
            Voltar
          </button>
          <button
            type="button"
            onClick={handleMappingContinue}
            disabled={pending || !spreadsheetColumns.includes("title")}
            className={buttonClassName}
          >
            {pending ? "Lendo…" : "Continuar"}
          </button>
        </div>
        {!spreadsheetColumns.includes("title") && <p className="text-xs text-amber-600 dark:text-amber-400">Escolha qual coluna é o Título pra continuar.</p>}
      </div>
    );
  }

  if (step === "destination" && preview) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {preview.items.length} item(ns) encontrado(s) em <strong>{sourceLabel}</strong>.
        </p>
        {preview.warnings.map((w, i) => (
          <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
            {w}
          </p>
        ))}

        <label className="flex flex-col gap-1 text-sm">
          Espaço de destino
          <select value={spaceId} onChange={(e) => handlePickSpace(e.target.value)} className={inputClassName}>
            <option value="">Inbox (sem espaço)</option>
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        </label>

        {spaceId && (
          <label className="flex flex-col gap-1 text-sm">
            Tipo de item
            <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputClassName}>
              <option value="">Nenhum tipo</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={reset} className={secondaryButtonClassName}>
            Voltar
          </button>
          <button type="button" onClick={handleContinueToReview} disabled={pending} className={buttonClassName}>
            Continuar
          </button>
        </div>
      </div>
    );
  }

  if (step === "review" && source === "ics" && icsPreview) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{icsPreview.events.length} evento(s) encontrado(s) — vão pro calendário local &ldquo;Importado&rdquo;.</p>
        {icsPreview.warnings.map((w, i) => (
          <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
            {w}
          </p>
        ))}
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto text-sm">
          {icsPreview.events.slice(0, 50).map((event, i) => (
            <li key={i} className="border-b border-black/[.06] py-1 dark:border-white/[.08]">
              {event.title} — {new Date(event.startsAt).toLocaleDateString("pt-BR")}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button type="button" onClick={reset} className={secondaryButtonClassName}>
            Voltar
          </button>
          <button type="button" onClick={handleConfirm} disabled={pending} className={buttonClassName}>
            {pending ? "Importando…" : "Confirmar importação"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "review" && preview) {
    return (
      <div className="flex flex-col gap-4">
        {preview.distinctTags.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-black dark:text-zinc-50">Tags encontradas — renomeie pra mesclar com uma já existente</p>
            {preview.distinctTags.map((tag) => (
              <label key={tag} className="flex items-center gap-2 text-sm">
                <span className="w-32 shrink-0 text-zinc-500 dark:text-zinc-400">{tag}</span>
                <input
                  defaultValue={tag}
                  onChange={(e) => setTagRename((prev) => ({ ...prev, [tag]: e.target.value.trim().toLowerCase() || tag }))}
                  className={inputClassName + " flex-1"}
                />
              </label>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-black dark:text-zinc-50">Itens a importar ({preview.items.length - excludedLocalIds.size} de {preview.items.length})</p>
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {preview.items.map((item) => (
              <label key={item.localId} className="flex items-center gap-2 border-b border-black/[.06] py-1 text-sm dark:border-white/[.08]">
                <input type="checkbox" checked={!excludedLocalIds.has(item.localId)} onChange={() => toggleExclude(item.localId)} />
                <span className="flex-1 truncate">{item.title}</span>
                {duplicateLocalIds.has(item.localId) && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">possível duplicata</span>
                )}
                {item.attachmentCount > 0 && <span className="text-xs text-zinc-500 dark:text-zinc-400">{item.attachmentCount} anexo(s)</span>}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={() => setStep("destination")} className={secondaryButtonClassName}>
            Voltar
          </button>
          <button type="button" onClick={handleConfirm} disabled={pending} className={buttonClassName}>
            {pending ? "Importando…" : "Confirmar importação"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "done" && report) {
    const summary = report.source === "ics" ? `${report.eventsCreated} evento(s) importado(s).` : `${report.itemsCreated} item(ns) criado(s), ${report.itemsSkipped} ignorado(s).`;
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-black dark:text-zinc-50">{summary}</p>
        {undone ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Importação desfeita.</p>
        ) : (
          <button type="button" onClick={handleUndo} disabled={pending} className={secondaryButtonClassName + " w-fit"}>
            Desfazer esta importação
          </button>
        )}
        <button type="button" onClick={reset} className={buttonClassName + " w-fit"}>
          Importar outro arquivo
        </button>
      </div>
    );
  }

  return null;
}
