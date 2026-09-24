import type { ParsedImportItem, ParsedImportResult } from "../types";
import { parseFrontMatter } from "./parse-front-matter";

export interface ObsidianFile {
  /** Caminho relativo dentro do vault/zip — só usado pra derivar o título quando o front matter não tem `title`. */
  path: string;
  content: string;
}

function titleFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.md$/i, "");
}

function toStringArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toIsoOrNull(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function firstString(data: Record<string, string | string[]>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

/**
 * Uma nota `.md` do Obsidian → `ParsedImportItem` (7.5). `#tags` soltas no
 * corpo (fora do front matter) também viram tags — ficam visíveis no texto,
 * mesmo comportamento do Obsidian. As chaves em português (`titulo`,
 * `criado_em`, `atualizado_em`) são as do **nosso próprio** front matter de
 * exportação (7.4, `buildItemMarkdown`) — reconhecidas como alternativa às
 * chaves em inglês (convenção comum de vault Obsidian de verdade) pra que
 * "exportar em Markdown → importar como Obsidian" (7.11) recrie título e
 * datas de verdade, não só o corpo do texto.
 */
export function parseObsidianFile(file: ObsidianFile, localId: string): ParsedImportItem {
  const { data, body } = parseFrontMatter(file.content);

  const title = firstString(data, ["title", "titulo"])?.trim() ?? titleFromPath(file.path);
  const frontMatterTags = toStringArray(data.tags);
  const inlineTags = [...body.matchAll(/(?:^|\s)#([a-zA-Z0-9_/-]+)/g)].map((m) => m[1]!);
  const tags = [...new Set([...frontMatterTags, ...inlineTags].map((t) => t.toLowerCase()))];

  const createdAt = toIsoOrNull(firstString(data, ["created", "date", "criado_em"]));
  const updatedAt = toIsoOrNull(firstString(data, ["updated", "modified", "atualizado_em"])) ?? createdAt;

  return { localId, title, bodyMarkdown: body.trim(), tags, createdAt, updatedAt, attachments: [] };
}

/** Um vault inteiro (várias notas `.md`, já extraídas de uma pasta ou `.zip`) — arquivos fora de `.md` (anexos referenciados) viram um aviso, não item (7.5 não pede anexos do Obsidian aqui; ficam de fora desta primeira versão). */
export function parseObsidianVault(files: ObsidianFile[]): ParsedImportResult {
  const markdownFiles = files.filter((f) => f.path.toLowerCase().endsWith(".md"));
  const warnings: string[] = [];
  if (markdownFiles.length < files.length) {
    warnings.push(`${files.length - markdownFiles.length} arquivo(s) que não são ".md" foram ignorados (anexos ainda não são importados do Obsidian).`);
  }

  const items = markdownFiles.map((file, index) => parseObsidianFile(file, `obsidian-${index}`));
  return { items, warnings };
}
