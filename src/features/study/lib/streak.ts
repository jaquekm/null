import { addDays, formatISO, parseISO } from "date-fns";

/**
 * Sequência de dias estudados (5.7, painel `/estudos`) — dias consecutivos
 * com pelo menos uma `study_sessions`, contando pra trás a partir de hoje.
 * Se hoje ainda não teve sessão, não zera a sequência: conta a partir de
 * ontem (o dia só "quebra" de verdade quando um dia inteiro passa em
 * branco), mesmo espírito de apps de sequência (Duolingo etc.).
 */
export function computeStreak(activeDateKeys: string[], todayKey: string): number {
  const active = new Set(activeDateKeys);
  const today = parseISO(todayKey);
  let cursor = active.has(todayKey) ? today : addDays(today, -1);
  let streak = 0;
  while (active.has(formatISO(cursor, { representation: "date" }))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
