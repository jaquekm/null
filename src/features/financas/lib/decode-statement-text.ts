/**
 * Extratos de bancos brasileiros costumam vir em ISO-8859-1/Windows-1252, não
 * UTF-8 (4.5, "detectar codificação"). Tenta decodificar como UTF-8 estrito
 * primeiro; se a sequência de bytes for inválida em UTF-8 (forte indício de
 * Latin1/Windows-1252 — acentos nesses charsets viram bytes que não formam
 * UTF-8 válido), cai para `windows-1252` (superset de ISO-8859-1, cobre os
 * dois casos).
 */
export function decodeStatementText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
