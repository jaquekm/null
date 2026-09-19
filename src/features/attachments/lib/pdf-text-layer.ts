/** Abaixo disso (média de caracteres por página), o PDF é tratado como escaneado — precisa de OCR (2.9). */
const MIN_CHARS_PER_PAGE = 100;

export function hasSufficientTextLayer(text: string, pageCount: number): boolean {
  if (pageCount <= 0) return false;
  return text.length / pageCount >= MIN_CHARS_PER_PAGE;
}
