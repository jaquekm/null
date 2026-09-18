/**
 * Conversor mínimo de Markdown para HTML, usado só para "colar Markdown
 * convertendo em blocos" (1.7). Cobre exatamente os atalhos citados no
 * enunciado (`#`, `-`, `[]`, `>`, crases) — não é um parser CommonMark
 * completo. O HTML resultante é passado para `editor.commands.insertContent`,
 * que já sabe converter HTML em nós do Tiptap.
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineCode(text: string): string {
  return text.replace(/`([^`]+)`/g, (_match, code: string) => `<code>${escapeHtml(code)}</code>`);
}

function renderInline(text: string): string {
  return inlineCode(escapeHtml(text));
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let listOpen: "ul" | "task" | null = null;

  function closeList() {
    if (listOpen) html.push("</ul>");
    listOpen = null;
  }

  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const task = /^[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line);
    const bullet = !task ? /^[-*]\s+(.*)$/.exec(line) : null;
    const quote = /^>\s?(.*)$/.exec(line);

    if (heading) {
      closeList();
      const level = heading[1]!.length;
      html.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`);
      continue;
    }

    if (task) {
      if (listOpen !== "task") {
        closeList();
        html.push('<ul data-type="taskList">');
        listOpen = "task";
      }
      const checked = task[1]!.toLowerCase() === "x";
      html.push(
        `<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox"${
          checked ? " checked" : ""
        }><span></span></label><div>${renderInline(task[2]!)}</div></li>`,
      );
      continue;
    }

    if (bullet) {
      if (listOpen !== "ul") {
        closeList();
        html.push("<ul>");
        listOpen = "ul";
      }
      html.push(`<li>${renderInline(bullet[1]!)}</li>`);
      continue;
    }

    closeList();

    if (quote) {
      html.push(`<blockquote><p>${renderInline(quote[1]!)}</p></blockquote>`);
      continue;
    }

    if (line.trim() === "") continue;

    html.push(`<p>${renderInline(line)}</p>`);
  }
  closeList();

  return html.join("");
}
