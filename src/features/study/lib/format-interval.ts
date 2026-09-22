/**
 * Rótulo compacto do próximo intervalo (botões Errei/Difícil/Bom/Fácil da
 * revisão, 5.7) a partir de uma data futura — `dueAt` nunca é anterior a
 * `now` na prévia do FSRS (`previewGrades`), mas negativo é travado em 0
 * por segurança caso a função seja reaproveitada noutro contexto.
 */
export function formatFsrsInterval(dueAt: string | Date, now: string | Date): string {
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  const start = typeof now === "string" ? new Date(now) : now;
  const minutes = Math.max(0, (due.getTime() - start.getTime()) / 60_000);

  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)} ${Math.round(days) === 1 ? "dia" : "dias"}`;
  const months = days / 30;
  if (months < 12) return `${Math.round(months)} ${Math.round(months) === 1 ? "mês" : "meses"}`;
  const years = days / 365;
  return Math.round(years) === 1 ? "1 ano" : `${Math.round(years)} anos`;
}
