/**
 * Uma linha crua extraída de um extrato (OFX ou CSV, 4.5), antes de checar
 * duplicidade contra o banco. `occurredOn`/`amountCents` nulos e `error`
 * preenchido significam que a linha não pôde ser interpretada — ainda assim
 * aparece na pré-visualização (status "Erro"), em vez de sumir em silêncio.
 */
export interface ParsedStatementRow {
  fitid: string | null;
  occurredOn: string | null; // yyyy-MM-dd
  amountCents: number | null;
  description: string;
  error: string | null;
}
