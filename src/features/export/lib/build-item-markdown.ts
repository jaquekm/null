import { slugify } from "@/lib/slugify";

/** Nome de arquivo do item exportado (7.4): `<titulo-slug>--<id-curto>.md`, curto = 8 primeiros caracteres do uuid. */
export function itemFileSlug(title: string, id: string): string {
  const titleSlug = slugify(title) || "sem-titulo";
  return `${titleSlug}--${id.slice(0, 8)}.md`;
}

function needsYamlQuoting(value: string): boolean {
  return value === "" || /^[\s\-?:,[\]{}#&*!|>'"%@`]/.test(value) || /[:#]\s|\s$/.test(value) || value.includes("\n");
}

function yamlScalar(value: string): string {
  if (!needsYamlQuoting(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

function yamlList(values: string[]): string {
  if (values.length === 0) return " []";
  return "\n" + values.map((v) => `  - ${yamlScalar(v)}`).join("\n");
}

export interface ItemMarkdownInput {
  id: string;
  title: string;
  typeName: string | null;
  spaceName: string | null;
  tags: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  /** Linhas "Campo: valor" já resolvidas (mesmo formato de `chunkProperties`/`formatFieldValue`, 6.5). */
  propertyLines: string[];
  /** Títulos dos itens ligados (tabela `links`, saída) — viram `[[titulo]]`, convenção Obsidian. */
  outgoingLinkTitles: string[];
  bodyMarkdown: string;
}

/**
 * Markdown de um item pro export completo (7.4) — front matter YAML
 * (compatível com Obsidian: `tags` como lista, sem tipos especiais) + corpo
 * + seção de links de saída como `[[titulo]]`. `bodyMarkdown` já vem de
 * `tiptapDocToMarkdown` (que agora também converte menções pra `[[label]]`).
 */
export function buildItemMarkdown(input: ItemMarkdownInput): string {
  const frontMatter = [
    "---",
    `id: ${input.id}`,
    `titulo: ${yamlScalar(input.title)}`,
    `tipo: ${yamlScalar(input.typeName ?? "")}`,
    `espaco: ${yamlScalar(input.spaceName ?? "")}`,
    `status: ${input.status}`,
    `criado_em: ${input.createdAt}`,
    `atualizado_em: ${input.updatedAt}`,
    `tags:${yamlList(input.tags)}`,
  ];

  if (input.propertyLines.length > 0) {
    frontMatter.push("propriedades:");
    for (const line of input.propertyLines) frontMatter.push(`  - ${yamlScalar(line)}`);
  }
  frontMatter.push("---");

  const linksSection = input.outgoingLinkTitles.length > 0 ? `\n\n## Links\n\n${input.outgoingLinkTitles.map((t) => `- [[${t}]]`).join("\n")}` : "";

  return `${frontMatter.join("\n")}\n\n${input.bodyMarkdown}${linksSection}\n`;
}
