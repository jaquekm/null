/**
 * Registro diário de um Hábito (5.12, opcional): em vez de uma tabela
 * `habit_logs` nova (avaliada e descartada — ver `decisoes.md`), guardado
 * como `{ "AAAA-MM-DD": true }` na própria `properties.log` do item Hábito
 * — não é um campo declarado no tipo (fica fora de `buildPropertiesSchema`,
 * só passa pelo `.passthrough()`), então não aparece no editor genérico de
 * propriedades, só no `HabitTracker` dedicado.
 */
export type HabitLog = Record<string, boolean>;

export function isHabitLogged(log: HabitLog | undefined, dateStr: string): boolean {
  return log?.[dateStr] === true;
}

/** Alterna um dia — marca se estava desmarcado, remove a chave se estava marcado (mantém o objeto pequeno). */
export function toggleHabitDay(log: HabitLog | undefined, dateStr: string): HabitLog {
  const next = { ...(log ?? {}) };
  if (next[dateStr]) delete next[dateStr];
  else next[dateStr] = true;
  return next;
}

/** Quantos dias entre `fromStr`/`toStr` (inclusive, `AAAA-MM-DD`) estão marcados — pra comparar com `target_per_period`. */
export function countLoggedInRange(log: HabitLog | undefined, fromStr: string, toStr: string): number {
  if (!log) return 0;
  return Object.keys(log).filter((dateStr) => log[dateStr] === true && dateStr >= fromStr && dateStr <= toStr).length;
}
