import type { JSONContent } from "@tiptap/core";

/** Um anexo já resolvido de um item importado — usado só na hora de montar o `.md`/attachments, nunca persistido cru. */
export interface ParsedImportAttachment {
  fileName: string;
  mimeType: string;
  data: Uint8Array;
}

/** Forma comum que todo parser de origem (Evernote/Obsidian/Google Keep) produz — o motor de import (`features/import/actions.ts`) só entende isto, nunca o formato original. */
export interface ParsedImportItem {
  /** Id só dentro deste lote (não é uuid de banco) — usado pra resolver `[[wikilinks]]` entre itens do mesmo lote antes de existirem de verdade. */
  localId: string;
  title: string;
  bodyMarkdown: string;
  /** Corpo já no formato do editor, quando a origem tem estrutura que o Markdown perderia (tabelas do Word). Tem prioridade sobre `bodyMarkdown`. */
  bodyDoc?: JSONContent;
  tags: string[];
  /** ISO 8601, quando a origem informa; `null` quando não dá pra saber (a data de criação vira `now()` na hora de gravar). */
  createdAt: string | null;
  updatedAt: string | null;
  attachments: ParsedImportAttachment[];
  /**
   * Rótulo bruto de categoria/subcategoria, só preenchido pela origem
   * "Planilha" (o dono escolhe a coluna na hora de mapear). Resolvido pra um
   * campo `select` de verdade (criando o campo/as opções que faltarem) só no
   * `commitImport` — antes disso o tipo de destino ainda não foi escolhido.
   */
  categoryLabel?: string | null;
  subcategoryLabel?: string | null;
}

export interface ParsedImportResult {
  items: ParsedImportItem[];
  warnings: string[];
}

export type ImportSource = "evernote" | "obsidian" | "google_keep" | "documento" | "planilha";
