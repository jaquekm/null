import type { ParsedImportItem, ParsedImportResult } from "../types";

export interface GoogleKeepNoteJson {
  title?: string;
  textContent?: string;
  listContent?: { text: string; isChecked?: boolean }[];
  labels?: { name: string }[];
  color?: string;
  isTrashed?: boolean;
  isArchived?: boolean;
  createdTimestampUsec?: number;
  userEditedTimestampUsec?: number;
}

function usecToIso(usec: number | undefined): string | null {
  if (!usec) return null;
  const date = new Date(usec / 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function colorTag(color: string | undefined): string | null {
  if (!color || color === "DEFAULT") return null;
  return `cor-${color.toLowerCase().replace(/_/g, "-")}`;
}

/** Uma nota do Google Takeout (Keep) → `ParsedImportItem` (7.5: "notas e checklists, cores → tags, anexos"). Checklist (`listContent`) vira lista de tarefas em Markdown; cor vira tag `cor-<nome>`. */
export function parseGoogleKeepNote(json: GoogleKeepNoteJson, localId: string): ParsedImportItem {
  const title = json.title?.trim() || "Sem título";
  const bodyMarkdown = json.listContent
    ? json.listContent.map((item) => `- [${item.isChecked ? "x" : " "}] ${item.text}`).join("\n")
    : (json.textContent ?? "").trim();

  const labelTags = (json.labels ?? []).map((l) => l.name.toLowerCase());
  const color = colorTag(json.color);
  const tags = [...new Set([...labelTags, ...(color ? [color] : [])])];

  const createdAt = usecToIso(json.createdTimestampUsec);
  const updatedAt = usecToIso(json.userEditedTimestampUsec) ?? createdAt;

  return { localId, title, bodyMarkdown, tags, createdAt, updatedAt, attachments: [] };
}

export interface KeepExportFile {
  path: string;
  content: string;
}

/**
 * Export inteiro do Google Takeout (Keep) — um `.json` por nota (dentro de
 * um `.zip`) ou um `.json` só (uma nota exportada à mão). Notas na lixeira
 * (`isTrashed`) são ignoradas — não faz sentido reimportar algo que o dono
 * já apagou no Keep. Fotos/desenhos anexados (`attachments` no JSON do
 * Takeout) ficam de fora desta primeira versão — registrado em
 * `docs/decisoes.md`.
 */
export function parseGoogleKeepExport(files: KeepExportFile[]): ParsedImportResult {
  const warnings: string[] = [];
  const items: ParsedImportItem[] = [];
  let index = 0;
  let trashedCount = 0;

  for (const file of files) {
    if (!file.path.toLowerCase().endsWith(".json")) continue;

    let json: GoogleKeepNoteJson;
    try {
      json = JSON.parse(file.content);
    } catch {
      warnings.push(`Não consegui ler "${file.path}" como JSON.`);
      continue;
    }

    if (json.isTrashed) {
      trashedCount += 1;
      continue;
    }

    items.push(parseGoogleKeepNote(json, `keep-${index++}`));
  }

  if (trashedCount > 0) warnings.push(`${trashedCount} nota(s) na lixeira do Keep foram ignoradas.`);
  return { items, warnings };
}
