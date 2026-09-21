/**
 * Detecta OFX vs. CSV (4.5, "detectar formato") pela extensão do arquivo
 * primeiro (mais confiável e barato); se a extensão não ajudar, cai pra
 * farejar o conteúdo — arquivo OFX sempre tem `<OFX` ou `<STMTTRN>` (SGML ou
 * XML), CSV não.
 */
export function detectStatementFormat(fileName: string, content: string): "ofx" | "csv" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".ofx") || lower.endsWith(".qfx")) return "ofx";
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) return "csv";
  return /<ofx[\s>]|<stmttrn>/i.test(content) ? "ofx" : "csv";
}
