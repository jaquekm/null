export interface UpdatedRange {
  after: string | null;
  before: string | null;
}

/**
 * Converte os dois `<input type="date">` do filtro "período de atualização"
 * (1.14, formato `YYYY-MM-DD`) pros limites ISO que `search_items` espera —
 * início do dia pro "de" e fim do dia pro "até", no fuso local do navegador.
 */
export function dateRangeToIso(from: string, to: string): UpdatedRange {
  return {
    after: from ? new Date(`${from}T00:00:00`).toISOString() : null,
    before: to ? new Date(`${to}T23:59:59.999`).toISOString() : null,
  };
}
