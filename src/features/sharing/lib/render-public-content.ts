import "server-only";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Mention from "@tiptap/extension-mention";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Typography from "@tiptap/extension-typography";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";
import { common, createLowlight } from "lowlight";
import { ScoredTaskItem } from "@/features/items/components/editor/scored-task-item";
import { expandSelfClosingTags, sanitizePublicContent } from "./public-html-safety";
import { injectTaskItemPaths, type JSONContentNode } from "./toggle-task-at-path";

const lowlight = createLowlight(common);

/**
 * Versão "texto simples" das menções (3.11: "Links internos `[[...]]`
 * aparecem como texto simples, sem URL") — diferente da extensão do editor
 * (`item-content-editor`/`extensions.ts`), que renderiza `<a href="/itens/...">`.
 * Uma página pública nunca deve vazar um link que só faz sentido dentro do
 * app (e que, de qualquer forma, o visitante anônimo não teria acesso).
 */
function plainTextMention(name: string, format: (label: string) => string) {
  return Mention.extend({ name }).configure({
    renderHTML({ node }) {
      const label = (node.attrs.label as string | null) ?? (node.attrs.id as string);
      return ["span", { class: "mention-text" }, format(label)] as const;
    },
  });
}

/**
 * Versão clicável do `taskItem` (permissão `check`, 3.11) — em vez do
 * checkbox estático (e `disabled`) do editor, sai um `<li>` marcado com
 * `data-share-checkbox`+`data-path` (o caminho de `injectTaskItemPaths`)
 * pra um script cliente (`checklist-interactivity.tsx`) delegar o clique
 * — sem hidratar um `<input type="checkbox">` de verdade sobre HTML
 * injetado por `dangerouslySetInnerHTML` (evitaria o de sempre: divergência
 * de hidratação entre o `checked` do servidor e o do cliente).
 */
const InteractiveTaskItem = TaskItem.extend({
  addAttributes() {
    return { ...this.parent?.(), path: { default: null, rendered: false } };
  },
  renderHTML({ node, HTMLAttributes }) {
    const checked = Boolean(node.attrs.checked);
    return [
      "li",
      {
        ...HTMLAttributes,
        "data-type": "taskItem",
        "data-checked": String(checked),
        "data-share-checkbox": "",
        "data-path": node.attrs.path as string,
        class: `share-check-item${checked ? " is-checked" : ""}`,
      },
      ["span", { class: "share-check-box", "aria-hidden": "true" }],
      ["div", 0],
    ];
  },
}).configure({ nested: true });

function buildExtensions(interactiveChecklist: boolean) {
  return [
    StarterKit.configure({ codeBlock: false, link: { HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } } }),
    CodeBlockLowlight.configure({ lowlight }),
    // `<details>`/`<summary>` nativos — recolhível sem JS nenhum, o navegador já cuida disso.
    Details.configure({ persist: true }),
    DetailsSummary,
    DetailsContent,
    TaskList,
    // Estático: com a nota ("Dar nota") em `data-score`, que o CSS da página pública mostra como estrelas.
    interactiveChecklist ? InteractiveTaskItem : ScoredTaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    Image,
    Highlight,
    Typography,
    plainTextMention("mention", (label) => `[[${label}]]`),
    plainTextMention("contactMention", (label) => `@${label}`),
  ];
}

export interface RenderPublicContentOptions {
  /** Permissão `check` (3.11): renderiza os `taskItem` como checkboxes clicáveis em vez de estáticos. */
  interactiveChecklist?: boolean;
}

/**
 * Conteúdo Tiptap (JSON) → HTML pra página pública (3.11), sem DOM nenhum:
 * o renderizador estático do Tiptap escapa texto e atributos, e
 * `sanitizePublicContent` tira links/imagens com URL perigosa antes. Antes
 * isto usava `generateHTML` + jsdom + DOMPurify, e o jsdom não carregava na
 * Vercel (ERR_REQUIRE_ESM numa dependência dele) — toda página `/p/…` de
 * item dava erro 500 em produção.
 */
export function renderPublicContentHtml(content: JSONContent | null, options: RenderPublicContentOptions = {}): string {
  if (!content) return "";
  const withPaths = options.interactiveChecklist ? (injectTaskItemPaths(content as JSONContentNode) as JSONContent) : content;
  const safe = sanitizePublicContent(withPaths);
  if (!safe) return "";
  const html = renderToHTMLString({ content: safe, extensions: buildExtensions(Boolean(options.interactiveChecklist)) });
  return expandSelfClosingTags(html);
}
