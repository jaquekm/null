import { sha256Hex } from "@/lib/crypto";
import { normalizeDescription } from "./normalize-description";

export interface ImportHashInput {
  accountId: string;
  fitid: string | null;
  occurredOn: string;
  amountCents: number;
  description: string;
  /** Índice (0-based) desta linha entre as que compartilham data+valor+descrição normalizada — ver `computeOccurrenceIndexes`. */
  occurrenceIndex: number;
}

/**
 * Hash de deduplicação (4.5): `sha256(account_id|FITID)` quando há FITID —
 * é um identificador único de verdade do banco, então dispensa os outros
 * campos. Sem FITID (comum em CSV, e em alguns OFX), cai pro fallback do
 * enunciado: `sha256(account_id|data|valor|descrição normalizada|ordem)`.
 * Reimportar o mesmo arquivo reproduz os mesmos hashes (mesma ordem de
 * linhas), por isso a segunda importação bate como duplicado.
 */
export function importHash(input: ImportHashInput): string {
  if (input.fitid) {
    return sha256Hex(`${input.accountId}|fitid:${input.fitid}`);
  }
  const normalized = normalizeDescription(input.description);
  return sha256Hex(`${input.accountId}|${input.occurredOn}|${input.amountCents}|${normalized}|${input.occurrenceIndex}`);
}

export interface RowForOccurrenceIndex {
  occurredOn: string;
  amountCents: number;
  description: string;
}

/**
 * "Ordem do lançamento no mesmo dia com mesma descrição e valor" (4.5) —
 * desempata lançamentos idênticos dentro do mesmo arquivo (ex.: dois cafés
 * de R$ 8,00 no mesmo dia), na ordem em que aparecem nele.
 */
export function computeOccurrenceIndexes(rows: RowForOccurrenceIndex[]): number[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const key = `${row.occurredOn}|${row.amountCents}|${normalizeDescription(row.description)}`;
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    return count;
  });
}
