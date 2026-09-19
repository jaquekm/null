/**
 * Conversor mínimo de Markdown para HTML, usado para "colar Markdown
 * convertendo em blocos" (1.7) e para a extração de texto (2.9: OCR e DOCX
 * produzem Markdown, "Criar nota a partir do documento" converte pra Tiptap).
 * Cobre só os atalhos usados nesses dois casos (`#`, `-`, `1.`, `[]`, `>`,
 * crases, `**negrito**`, `*itálico*`, tabelas `| a | b |`) — não é um parser
 * CommonMark completo. O HTML resultante é passado pro Tiptap (via
 * `editor.commands.insertContent` no editor, ou `generateJSON` no servidor),
 * que já sabe converter HTML em nós.
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineCode(text: string): string {
  return text.replace(/`([^`]+)`/g, (_match, code: string) => `<code>${escapeHtml(code)}</code>`);
}

function inlineEmphasis(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function renderInline(text: string): string {
  return inlineEmphasis(inlineCode(escapeHtml(text)));
}

/** `| a | b |` → células, sem as barras das pontas. */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

const TABLE_SEPARATOR_PATTERN = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

export function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let listOpen: "ul" | "ol" | "task" | null = null;

  function closeList() {
    if (listOpen === "ol") html.push("</ol>");
    else if (listOpen) html.push("</ul>");
    listOpen = null;
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const task = /^[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line);
    const bullet = !task ? /^[-*]\s+(.*)$/.exec(line) : null;
    const ordered = /^\d+\.\s+(.*)$/.exec(line);
    const quote = /^>\s?(.*)$/.exec(line);
    const tableHeader = line.includes("|") && i + 1 < lines.length && TABLE_SEPARATOR_PATTERN.test(lines[i + 1]!.trim());

    if (tableHeader) {
      closeList();
      const headerCells = splitTableRow(line);
      html.push("<table><tbody><tr>");
      for (const cell of headerCells) html.push(`<th>${renderInline(cell)}</th>`);
      html.push("</tr>");
      i += 2; // pula a linha de cabeçalho e a de separação (---)
      while (i < lines.length && lines[i]!.includes("|") && lines[i]!.trim() !== "") {
        html.push("<tr>");
        for (const cell of splitTableRow(lines[i]!)) html.push(`<td>${renderInline(cell)}</td>`);
        html.push("</tr>");
        i++;
      }
      html.push("</tbody></table>");
      continue;
    }

    if (heading) {
      closeList();
      const level = heading[1]!.length;
      html.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`);
      i++;
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
      i++;
      continue;
    }

    if (bullet) {
      if (listOpen !== "ul") {
        closeList();
        html.push("<ul>");
        listOpen = "ul";
      }
      html.push(`<li>${renderInline(bullet[1]!)}</li>`);
      i++;
      continue;
    }

    if (ordered) {
      if (listOpen !== "ol") {
        closeList();
        html.push("<ol>");
        listOpen = "ol";
      }
      html.push(`<li>${renderInline(ordered[1]!)}</li>`);
      i++;
      continue;
    }

    closeList();

    if (quote) {
      html.push(`<blockquote><p>${renderInline(quote[1]!)}</p></blockquote>`);
      i++;
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    html.push(`<p>${renderInline(line)}</p>`);
    i++;
  }
  closeList();

  return html.join("");
}
