/**
 * Parser de exportação do Anki (5.7: "CSV/TXT exportado (frente;verso)").
 * Aceita `;` (como o enunciado descreve) ou tab (formato real do "Notes in
 * Plain Text" do Anki) como separador — detectado por linha. Uma
 * linha-cabeçalho ("Frente;Verso"/"Front;Back") é ignorada se existir.
 * Campos do Anki costumam vir com HTML simples (`<br>`, `<div>`) — convertido
 * pra quebra de linha, o resto das tags é removido, ficando texto/Markdown
 * puro (mesmo formato de `front`/`back` de um flashcard criado a mão).
 */
export interface ParsedAnkiCard {
  front: string;
  back: string;
}

function stripAnkiHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?div[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

function isHeaderRow(front: string, back: string): boolean {
  const f = front.trim().toLowerCase();
  const b = back.trim().toLowerCase();
  return (f === "frente" || f === "front") && (b === "verso" || b === "back");
}

export function parseAnkiExport(text: string): ParsedAnkiCard[] {
  const cards: ParsedAnkiCard[] = [];
  for (const rawLine of text.split(/\r\n|\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const separator = line.includes("\t") ? "\t" : ";";
    const sepIndex = line.indexOf(separator);
    if (sepIndex === -1) continue;

    const rawFront = line.slice(0, sepIndex);
    const rawBack = line.slice(sepIndex + 1);
    if (isHeaderRow(rawFront, rawBack)) continue;

    const front = stripAnkiHtml(rawFront);
    const back = stripAnkiHtml(rawBack);
    if (!front || !back) continue;

    cards.push({ front, back });
  }
  return cards;
}
