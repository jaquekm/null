/**
 * Estoque de remédio (10.5): `properties.stock` (unidades) e `properties.horarios`
 * (array de "HH:mm") ficam fora do editor genérico de campos — mesmo padrão de
 * `properties.log`/`frequency` dos Hábitos (5.12) — porque não existe tipo de
 * campo "lista de horários" e o estoque precisa da lógica de desconto/previsão
 * abaixo, não só de um input de número.
 */
export const LOW_STOCK_DAYS = 5;

/** Doses por dia: um horário fixo por dose, ou 1 dose/dia se a dona não marcou horário. */
export function dosesPerDay(horarios: string[]): number {
  return horarios.length > 0 ? horarios.length : 1;
}

/** Dias até o estoque acabar, arredondando pra baixo (dose parcial no último dia não conta). */
export function daysUntilEmpty(stock: number, doses: number): number {
  if (doses <= 0) return Infinity;
  return Math.floor(stock / doses);
}

/** "Acaba em 5 dias" (10.5): a partir de quantos dias restantes o aviso dispara. */
export function isLowStock(daysLeft: number): boolean {
  return daysLeft <= LOW_STOCK_DAYS;
}

/** Horários ordenados e formatados pro card ("08:00, 20:00") — vazio = sem horário fixo. */
export function formatHorarios(horarios: string[]): string {
  if (horarios.length === 0) return "sem horário fixo";
  return [...horarios].sort().join(", ");
}
