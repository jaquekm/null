"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatBRL } from "@/lib/money";
import { confirmImport, fetchLastCsvMapping, previewImport, undoImport, type ImportPreviewRow } from "../actions";
import { decodeStatementText } from "../lib/decode-statement-text";
import { detectStatementFormat } from "../lib/detect-statement-format";
import { parseOfx } from "../lib/ofx";
import {
  CSV_COLUMN_ROLES,
  CSV_DATE_FORMATS,
  CSV_DECIMAL_SEPARATORS,
  CSV_DELIMITERS,
  parseStatementCsv,
  splitCsvLine,
  type CsvColumnRole,
  type CsvDateFormat,
  type CsvDecimalSeparator,
  type CsvDelimiter,
  type CsvImportMapping,
} from "../lib/parse-statement-csv";
import type { ParsedStatementRow } from "../lib/statement-row";
import type { AccountRow, CategoryRow, ImportSummaryRow } from "../queries";
import { CSV_COLUMN_ROLE_LABELS, CSV_DECIMAL_LABELS, CSV_DELIMITER_LABELS, type ImportFormat } from "../schemas";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

type Step = "pick" | "mapping" | "preview" | "done";

interface EditableRow extends ImportPreviewRow {
  include: boolean;
  categoryId: string;
  linkBill: boolean;
}

function toEditableRow(row: ImportPreviewRow): EditableRow {
  return { ...row, include: row.status === "new", categoryId: "", linkBill: row.matchedBill !== null };
}

function negate(rows: ParsedStatementRow[]): ParsedStatementRow[] {
  return rows.map((row) => ({ ...row, amountCents: row.amountCents === null ? null : -row.amountCents }));
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Fluxo de `/financas/importar` (4.5): escolher conta + arquivo → (CSV) mapear colunas → pré-visualizar → confirmar. */
export function ImportWorkspace({ accounts, categories, imports }: { accounts: AccountRow[]; categories: CategoryRow[]; imports: ImportSummaryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>("pick");
  const [accountId, setAccountId] = useState("");
  const [fileName, setFileName] = useState("");
  const [format, setFormat] = useState<ImportFormat>("csv");
  const [rawText, setRawText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedStatementRow[]>([]);
  const [invertSigns, setInvertSigns] = useState(false);

  const [delimiter, setDelimiter] = useState<CsvDelimiter>(";");
  const [decimalSeparator, setDecimalSeparator] = useState<CsvDecimalSeparator>(",");
  const [dateFormat, setDateFormat] = useState<CsvDateFormat>("dd/MM/yyyy");
  const [headerRowsToSkip, setHeaderRowsToSkip] = useState(1);
  const [columnOverrides, setColumnOverrides] = useState<Record<number, CsvColumnRole>>({});
  const [csvMapping, setCsvMapping] = useState<CsvImportMapping | null>(null);

  const [rows, setRows] = useState<EditableRow[]>([]);
  const [summary, setSummary] = useState<{ importId: string; imported: number; duplicate: number } | null>(null);
  const [now] = useState(() => Date.now());

  const expenseCategories = useMemo(() => categories.filter((c) => c.kind === "expense"), [categories]);
  const incomeCategories = useMemo(() => categories.filter((c) => c.kind === "income"), [categories]);
  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const dataLines = useMemo(() => rawText.split(/\r\n|\r|\n/).filter((line) => line.trim() !== ""), [rawText]);
  const sampleRows = useMemo(() => dataLines.slice(headerRowsToSkip, headerRowsToSkip + 3).map((line) => splitCsvLine(line, delimiter)), [dataLines, headerRowsToSkip, delimiter]);
  const columnCount = useMemo(() => sampleRows.reduce((max, r) => Math.max(max, r.length), 0), [sampleRows]);
  const columns = useMemo(() => Array.from({ length: columnCount }, (_, i) => columnOverrides[i] ?? "ignore"), [columnCount, columnOverrides]);

  function resetForNewImport() {
    setStep("pick");
    setFileName("");
    setRawText("");
    setParsedRows([]);
    setInvertSigns(false);
    setRows([]);
    setCsvMapping(null);
    setSummary(null);
    setColumnOverrides({});
  }

  function runPreview(sourceRows: ParsedStatementRow[], invert: boolean, mapping: CsvImportMapping | null) {
    const signed = invert ? negate(sourceRows) : sourceRows;
    startTransition(async () => {
      const result = await previewImport({
        accountId,
        format,
        csvMapping: mapping ?? undefined,
        rows: signed,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRows(result.data.rows.map(toEditableRow));
    });
  }

  async function handleFile(file: File) {
    const buffer = await file.arrayBuffer();
    const text = decodeStatementText(new Uint8Array(buffer));
    const fmt = detectStatementFormat(file.name, text);

    setFileName(file.name);
    setFormat(fmt);
    setRawText(text);
    setInvertSigns(false);

    if (fmt === "ofx") {
      const parsed = parseOfx(text);
      setParsedRows(parsed);
      setCsvMapping(null);
      setStep("preview");
      runPreview(parsed, false, null);
      return;
    }

    const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim() !== "");
    const last = accountId ? await fetchLastCsvMapping(accountId) : null;
    const skip = last?.headerRowsToSkip ?? 1;
    const delim = last?.delimiter ?? ";";
    const sampleLine = lines[skip] ?? lines[0] ?? "";
    const detectedColumnCount = splitCsvLine(sampleLine, delim).length;

    setDelimiter(delim);
    setDecimalSeparator(last?.decimalSeparator ?? ",");
    setDateFormat(last?.dateFormat ?? "dd/MM/yyyy");
    setHeaderRowsToSkip(skip);
    setColumnOverrides(last && last.columns.length === detectedColumnCount ? Object.fromEntries(last.columns.map((role, i) => [i, role])) : {});
    setStep("mapping");
  }

  function handleMappingContinue() {
    const mapping: CsvImportMapping = { delimiter, decimalSeparator, dateFormat, headerRowsToSkip, columns };
    const parsed = parseStatementCsv(rawText, mapping);
    setParsedRows(parsed);
    setCsvMapping(mapping);
    setStep("preview");
    runPreview(parsed, invertSigns, mapping);
  }

  function handleToggleInvert(checked: boolean) {
    setInvertSigns(checked);
    runPreview(parsedRows, checked, csvMapping);
  }

  function handleConfirm() {
    const toSend = rows.filter((row): row is EditableRow & { occurredOn: string; amountCents: number; hash: string } => row.include && row.status !== "error" && row.occurredOn != null && row.amountCents != null && row.hash != null);
    if (toSend.length === 0) {
      toast.error("Nenhuma linha selecionada.");
      return;
    }
    startTransition(async () => {
      const result = await confirmImport({
        accountId,
        format,
        csvMapping: csvMapping ?? undefined,
        rows: toSend.map((row) => ({
          fitid: row.fitid,
          occurredOn: row.occurredOn,
          amountCents: row.amountCents,
          description: row.description,
          hash: row.hash,
          categoryId: row.categoryId || undefined,
          linkBillId: row.linkBill && row.matchedBill ? row.matchedBill.billId : undefined,
        })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSummary(result.data);
      setStep("done");
      router.refresh();
    });
  }

  function handleUndo(id: string) {
    if (!window.confirm("Desfazer esta importação? Os lançamentos que não foram editados depois serão removidos.")) return;
    startTransition(async () => {
      const result = await undoImport(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Importação desfeita: ${result.data.removed} removido(s)${result.data.kept > 0 ? `, ${result.data.kept} mantido(s) (editado(s) depois)` : ""}.`);
      router.refresh();
    });
  }

  const counts = useMemo(() => {
    const novo = rows.filter((r) => r.status === "new").length;
    const duplicado = rows.filter((r) => r.status === "duplicate").length;
    const erro = rows.filter((r) => r.status === "error").length;
    return { novo, duplicado, erro };
  }, [rows]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Importar extrato</h1>
        <p className="text-sm text-black/60 dark:text-white/60">OFX ou CSV do seu banco.</p>
      </div>

      {step === "pick" && (
        <div className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
          {accounts.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nenhuma conta cadastrada.{" "}
              <Link href="/financas/configurar" className="underline">
                Cadastre uma conta
              </Link>{" "}
              antes de importar.
            </p>
          ) : (
            <>
              <label className={labelClassName}>
                Conta
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClassName}>
                  <option value="">Selecione</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClassName}>
                Arquivo (.ofx, .qfx ou .csv)
                <input
                  type="file"
                  accept=".ofx,.qfx,.csv,.txt"
                  disabled={!accountId || pending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
              </label>
            </>
          )}
        </div>
      )}

      {step === "mapping" && (
        <div className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            <strong>{fileName}</strong> — confira o mapeamento de colunas ({dataLines.length - headerRowsToSkip} linha(s) de dados detectada(s)).
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className={labelClassName}>
              Separador
              <select value={delimiter} onChange={(e) => setDelimiter(e.target.value as CsvDelimiter)} className={inputClassName}>
                {CSV_DELIMITERS.map((d) => (
                  <option key={d} value={d}>
                    {CSV_DELIMITER_LABELS[d]}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Decimal
              <select value={decimalSeparator} onChange={(e) => setDecimalSeparator(e.target.value as CsvDecimalSeparator)} className={inputClassName}>
                {CSV_DECIMAL_SEPARATORS.map((d) => (
                  <option key={d} value={d}>
                    {CSV_DECIMAL_LABELS[d]}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Formato da data
              <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as CsvDateFormat)} className={inputClassName}>
                {CSV_DATE_FORMATS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Linhas de cabeçalho
              <input
                type="number"
                min={0}
                max={20}
                value={headerRowsToSkip}
                onChange={(e) => setHeaderRowsToSkip(Math.max(0, Number(e.target.value) || 0))}
                className={inputClassName}
              />
            </label>
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(columnCount, 1)}, minmax(120px, 1fr))` }}>
            {Array.from({ length: columnCount }).map((_, index) => (
              <div key={index} className="flex flex-col gap-1">
                <select
                  value={columns[index] ?? "ignore"}
                  onChange={(e) => setColumnOverrides((prev) => ({ ...prev, [index]: e.target.value as CsvColumnRole }))}
                  className={inputClassName}
                >
                  {CSV_COLUMN_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {CSV_COLUMN_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
                <span className="truncate text-xs text-zinc-400 dark:text-zinc-500" title={sampleRows.map((r) => r[index] ?? "").join(" · ")}>
                  {sampleRows.map((r) => r[index] ?? "").join(" · ") || "—"}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleMappingContinue}
              disabled={
                pending ||
                !columns.includes("date") ||
                !columns.includes("description") ||
                (!columns.includes("amount") && !columns.includes("debit") && !columns.includes("credit"))
              }
              className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
            >
              Continuar
            </button>
            <button type="button" onClick={resetForNewImport} disabled={pending} className="self-start rounded-full px-5 py-2 text-sm text-zinc-500 hover:underline">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.08]">
            <span>
              <strong>{fileName}</strong> · {counts.novo} novo(s), {counts.duplicado} duplicado(s), {counts.erro} com erro
            </span>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={invertSigns} onChange={(e) => handleToggleInvert(e.target.checked)} disabled={pending} />
              Inverter sinais (fatura de cartão às vezes vem invertida)
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {["", "Data", "Descrição", "Valor", "Status", "Categoria", "Conciliação"].map((label) => (
                    <th key={label} className="border-b border-black/[.08] px-2 py-2 text-left text-xs font-medium text-zinc-500 dark:border-white/[.08] dark:text-zinc-400">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const rowCategories = row.amountCents != null && row.amountCents >= 0 ? incomeCategories : expenseCategories;
                  return (
                    <tr key={index} className="hover:bg-black/[.02] dark:hover:bg-white/[.03]">
                      <td className="border-b border-black/[.06] px-2 py-1.5 align-top dark:border-white/[.06]">
                        <input
                          type="checkbox"
                          checked={row.include}
                          disabled={row.status !== "new"}
                          title={row.status === "duplicate" ? "Já foi importado antes (mesmo hash) — não pode ser reimportado." : undefined}
                          onChange={(e) =>
                            setRows((prev) => prev.map((r, i) => (i === index ? { ...r, include: e.target.checked } : r)))
                          }
                        />
                      </td>
                      <td className="border-b border-black/[.06] px-2 py-1.5 align-top whitespace-nowrap text-zinc-600 dark:border-white/[.06] dark:text-zinc-300">
                        {row.occurredOn ? row.occurredOn.split("-").reverse().join("/") : "—"}
                      </td>
                      <td className="border-b border-black/[.06] px-2 py-1.5 align-top dark:border-white/[.06]">{row.description || "—"}</td>
                      <td
                        className={`border-b border-black/[.06] px-2 py-1.5 align-top font-medium whitespace-nowrap dark:border-white/[.06] ${
                          row.amountCents != null && row.amountCents >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {row.amountCents != null ? formatBRL(row.amountCents, { sign: true }) : "—"}
                      </td>
                      <td className="border-b border-black/[.06] px-2 py-1.5 align-top whitespace-nowrap dark:border-white/[.06]">
                        {row.status === "new" && <span className="text-emerald-600 dark:text-emerald-400">Novo</span>}
                        {row.status === "duplicate" && <span className="text-amber-600 dark:text-amber-400">Duplicado</span>}
                        {row.status === "error" && <span className="text-red-600 dark:text-red-400" title={row.error ?? ""}>Erro</span>}
                      </td>
                      <td className="border-b border-black/[.06] px-2 py-1.5 align-top dark:border-white/[.06]">
                        {row.status !== "error" && (
                          <select
                            value={row.categoryId}
                            onChange={(e) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, categoryId: e.target.value } : r)))}
                            className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-black/[.12] focus:border-black/[.2] focus:outline-none dark:hover:border-white/[.16] dark:focus:border-white/[.3]"
                          >
                            <option value="">Sem categoria</option>
                            {rowCategories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="border-b border-black/[.06] px-2 py-1.5 align-top text-xs whitespace-nowrap dark:border-white/[.06]">
                        {row.matchedBill && (
                          <label className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
                            <input
                              type="checkbox"
                              checked={row.linkBill}
                              onChange={(e) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, linkBill: e.target.checked } : r)))}
                            />
                            Parece: {row.matchedBill.description}
                          </label>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={handleConfirm} disabled={pending} className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60">
              {pending ? "Importando..." : "Confirmar importação"}
            </button>
            <button type="button" onClick={resetForNewImport} disabled={pending} className="self-start rounded-full px-5 py-2 text-sm text-zinc-500 hover:underline">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {step === "done" && summary && (
        <div className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-4 text-sm dark:border-white/[.08]">
          <p>
            {summary.imported} lançamento(s) importado(s), {summary.duplicate} duplicado(s) ignorado(s).
          </p>
          <div className="flex gap-2">
            <Link href="/financas/lancamentos" className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium">
              Ver lançamentos
            </Link>
            <button type="button" onClick={resetForNewImport} className="self-start rounded-full border border-black/[.12] px-5 py-2 text-sm dark:border-white/[.16]">
              Nova importação
            </button>
          </div>
        </div>
      )}

      {imports.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Importações recentes</h2>
          <ul className="flex flex-col gap-1">
            {imports.map((imp) => {
              const canUndo = imp.status === "imported" && now - new Date(imp.createdAt).getTime() <= SEVEN_DAYS_MS;
              return (
                <li key={imp.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
                  <span className="text-zinc-600 dark:text-zinc-300">
                    {accountNameById.get(imp.accountId) ?? "Conta removida"} · {imp.format.toUpperCase()} · {imp.rowsImported} importado(s), {imp.rowsDuplicate} duplicado(s)
                    {imp.status === "undone" && " · desfeita"}
                  </span>
                  {canUndo && (
                    <button type="button" onClick={() => handleUndo(imp.id)} disabled={pending} className="text-xs text-red-500 hover:underline disabled:opacity-60">
                      Desfazer
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
