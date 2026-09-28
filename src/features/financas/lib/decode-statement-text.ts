import { decodeTextBytes } from "@/lib/csv";

/**
 * Extratos de bancos brasileiros costumam vir em ISO-8859-1/Windows-1252, não
 * UTF-8 (4.5, "detectar codificação") — mesma regra de `decodeTextBytes`,
 * que os outros importadores também usam.
 */
export function decodeStatementText(bytes: Uint8Array): string {
  return decodeTextBytes(bytes);
}
