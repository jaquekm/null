/**
 * Markdown mínimo pros lados do flashcard (5.7: "Suporta Markdown e imagens
 * nos lados do card") — `front`/`back` são `long_text` (texto puro, sem
 * editor Tiptap), então em vez de puxar uma lib de Markdown nova pra isso,
 * um subconjunto pequeno e testado resolve: **negrito**, *itálico* (ou _itálico_),
 * `código`, ![imagem](url), [link](url) e quebras de linha. Sempre escapa
 * HTML antes, e bloqueia qualquer esquema de URL que não seja http(s),
 * caminho relativo ou âncora (nunca `javascript:`).
 *
 * Limitação conhecida e aceita: a URL de imagem/link não pode conter `)`
 * literal (regex simples, não balanceia parênteses) — casos assim caem pra
 * link "#" em vez de quebrar a página.
 */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeUrl(url: string): string {
  return /^(https?:|\/|#)/i.test(url) ? url : "#";
}

export function renderSimpleMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, url: string) => `<img src="${safeUrl(url)}" alt="${alt}" class="max-w-full rounded" />`);
  html = html.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, label: string, url: string) => `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer" class="underline">${label}</a>`,
  );
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, "$1<em>$2</em>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");
  html = html.replace(/\n/g, "<br />");
  return html;
}
