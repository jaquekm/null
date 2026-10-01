/**
 * Ordenação e recorte dos registros de Saúde (10.7) pro card do Hoje e pro
 * resumo pra levar ao médico — puro, sem tocar banco, pra poder testar sem
 * Supabase.
 */
export interface DatedRecord {
  id: string;
  title: string;
  date: string;
}

/** A mais próxima ocorrência de hoje em diante (consulta futura mais cedo) — `null` se não tiver nenhuma. */
export function nextUpcoming<T extends DatedRecord>(items: T[], today: string): T | null {
  const upcoming = items.filter((item) => item.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  return upcoming[0] ?? null;
}

/** Consultas futuras (mais próxima primeiro) e passadas (mais recente primeiro) — pro resumo. */
export function splitByToday<T extends DatedRecord>(items: T[], today: string): { upcoming: T[]; past: T[] } {
  const upcoming = items.filter((item) => item.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = items.filter((item) => item.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming, past };
}

/** Os `limit` mais recentes (exames, receitas, sintomas — o resumo não precisa do histórico inteiro). */
export function mostRecent<T extends DatedRecord>(items: T[], limit: number): T[] {
  return [...items].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
