/**
 * Divide um texto grande em blocos com sobreposição (2.7: "se o texto for
 * muito grande para uma chamada, dividir em blocos com sobreposição").
 * Prefere quebrar numa fronteira de linha (`\n`) quando existir uma perto do
 * limite, pra não cortar uma fala no meio. Texto dentro do limite devolve um
 * único bloco (o caso comum — a maioria das reuniões cabe numa chamada só).
 */
export function chunkText(text: string, maxChars: number, overlapChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const lastBreak = text.lastIndexOf("\n", end);
      if (lastBreak > start) end = lastBreak;
    }
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }

  return chunks;
}
