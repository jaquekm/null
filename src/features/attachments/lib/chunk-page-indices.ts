/**
 * Agrupa os índices de página (0-based) em blocos de até `pagesPerChunk` —
 * usado pra dividir um PDF escaneado grande antes de mandar pro OCR (2.9:
 * "PDFs grandes: dividir em partes por páginas"), respeitando o limite de
 * páginas por requisição da API do Claude.
 */
export function chunkPageIndices(totalPages: number, pagesPerChunk: number): number[][] {
  const chunks: number[][] = [];
  for (let start = 0; start < totalPages; start += pagesPerChunk) {
    const end = Math.min(start + pagesPerChunk, totalPages);
    chunks.push(Array.from({ length: end - start }, (_, i) => start + i));
  }
  return chunks;
}
