import type { JSONContent } from "@tiptap/core";

const SAFE_LINK = /^(https?:|mailto:|tel:|\/|#)/i;
const SAFE_IMAGE = /^(https?:|\/|data:image\/(png|jpe?g|gif|webp);)/i;

/**
 * Tira do conteúdo o que a página pública (sem login) não deve renderizar:
 * link com `javascript:`/esquema estranho perde o link (o texto fica) e
 * imagem com `src` fora de http(s)/caminho/data:image some. O renderizador
 * já escapa texto e atributos — isto cobre o que o escape não cobre (URL
 * perigosa bem escapada continua perigosa).
 */
export function sanitizePublicContent(node: JSONContent): JSONContent | null {
  if (node.type === "image") {
    const src = typeof node.attrs?.src === "string" ? node.attrs.src.trim() : "";
    if (!SAFE_IMAGE.test(src)) return null;
  }
  const marks = node.marks?.filter((mark) => {
    if (mark.type !== "link") return true;
    const href = typeof mark.attrs?.href === "string" ? mark.attrs.href.trim() : "";
    return SAFE_LINK.test(href);
  });
  const content = node.content?.map(sanitizePublicContent).filter((child): child is JSONContent => child !== null);
  return { ...node, ...(node.marks ? { marks } : {}), ...(node.content ? { content } : {}) };
}

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/**
 * O renderizador estático escreve elemento vazio como `<span/>`, `<p/>`,
 * `<h3/>`. Em HTML isso não fecha a tag — o navegador abre o elemento e
 * engole o que vem depois (um título vazio viraria título da página toda).
 * Só as tags void (`<img/>`, `<br/>`…) podem ficar assim.
 */
export function expandSelfClosingTags(html: string): string {
  return html.replace(/<([a-zA-Z][\w-]*)([^<>]*?)\/>/g, (whole, tag: string, attrs: string) =>
    VOID_TAGS.has(tag.toLowerCase()) ? whole : `<${tag}${attrs}></${tag}>`,
  );
}
