import "server-only";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Mention from "@tiptap/extension-mention";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Typography from "@tiptap/extension-typography";
import { generateHTML, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import DOMPurify from "isomorphic-dompurify";
import { JSDOM } from "jsdom";
import { common, createLowlight } from "lowlight";
import { injectTaskItemPaths, type JSONContentNode } from "./toggle-task-at-path";

const lowlight = createLowlight(common);

/**
 * `generateHTML` (via `prosemirror-model`) espera um `window`/`document`
 * globais — não roda em Node "puro" apesar de não precisar de um browser de
 * verdade (é só serialização, sem layout/eventos). Instala um DOM mínimo
 * (`jsdom`) nos globais uma única vez por processo — o resultado seria o
 * mesmo em qualquer chamada, então não há por que recriar a cada render.
 */
let domInstalled = false;
function ensureServerDom(): void {
  if (domInstalled) return;
  const { window } = new JSDOM("<!doctype html><html><body></body></html>");
  Object.assign(globalThis, { window, document: window.document });
  domInstalled = true;
}

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
    TaskList,
    interactiveChecklist ? InteractiveTaskItem : TaskItem.configure({ nested: true }),
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
 * Conteúdo Tiptap (JSON) → HTML sanitizado pra página pública (3.11).
 * `generateHTML` roda em Node puro (sem editor/DOM de verdade); o
 * resultado ainda passa por `DOMPurify` — defesa em profundidade contra
 * HTML malicioso que por algum motivo tenha entrado no `content` salvo
 * (ex.: colado de fora, ou um bug futuro na extensão de colar Markdown).
 */
export function renderPublicContentHtml(content: JSONContent | null, options: RenderPublicContentOptions = {}): string {
  if (!content) return "";
  ensureServerDom();

  const source = options.interactiveChecklist ? injectTaskItemPaths(content as JSONContentNode) : content;
  const html = generateHTML(source as JSONContent, buildExtensions(Boolean(options.interactiveChecklist)));
  return DOMPurify.sanitize(html, { ADD_ATTR: ["data-path", "data-share-checkbox", "data-checked", "data-type"] });
}
