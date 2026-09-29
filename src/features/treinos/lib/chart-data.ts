import { addDaysToDateString } from "@/lib/dates";
import { weekStartOf } from "./history";
import { parseDecimal, sessionHasExercises, type HistoryPoint, type SessionForRules } from "./rules";

export interface WeekCount {
  weekStart: string;
  /** "22/09" — rótulo curto do eixo. */
  label: string;
  count: number;
}

/** Treinos por semana (seg–dom) nas últimas `weeks` semanas, incluindo a atual; semanas sem treino aparecem com 0. */
export function weeklyCounts(sessions: { date: string }[], today: string, weeks = 8): WeekCount[] {
  const current = weekStartOf(today);
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDaysToDateString(current, -7 * (weeks - 1 - i));
    const end = addDaysToDateString(weekStart, 7);
    const [, month, day] = weekStart.split("-");
    return { weekStart, label: `${day}/${month}`, count: sessions.filter((s) => s.date >= weekStart && s.date < end).length };
  });
}

export interface TrainingStats {
  thisWeek: number;
  /** Treinos com musculação na semana atual (dias só de cardio não contam). */
  thisWeekStrength: number;
  last4Weeks: number;
  /** Média por semana nas últimas 4 semanas, com 1 casa. */
  weeklyAverage: number;
  minutesThisMonth: number;
}

export function trainingStats(
  sessions: (SessionForRules & { durationMin: number | null })[],
  today: string,
): TrainingStats {
  const weekStart = weekStartOf(today);
  const fourWeeksStart = addDaysToDateString(weekStart, -21);
  const monthPrefix = today.slice(0, 7);
  const thisWeekSessions = sessions.filter((s) => s.date >= weekStart && s.date <= today);
  const last4 = sessions.filter((s) => s.date >= fourWeeksStart && s.date <= today);
  return {
    thisWeek: thisWeekSessions.length,
    thisWeekStrength: thisWeekSessions.filter(sessionHasExercises).length,
    last4Weeks: last4.length,
    weeklyAverage: Math.round((last4.length / 4) * 10) / 10,
    minutesThisMonth: sessions.filter((s) => s.date.startsWith(monthPrefix)).reduce((sum, s) => sum + (s.durationMin ?? 0), 0),
  };
}

export interface ExerciseProgress {
  first: number;
  last: number;
  best: number;
  delta: number;
  sessions: number;
}

/** Carga do começo, da última vez e a melhor — o resumo que vai em cima do gráfico do exercício. */
export function exerciseProgress(history: HistoryPoint[]): ExerciseProgress | null {
  const loads = history.map((h) => parseDecimal(h.load)).filter((v): v is number => v !== null);
  if (loads.length === 0) return null;
  const first = loads[0]!;
  const last = loads.at(-1)!;
  return { first, last, best: Math.max(...loads), delta: Math.round((last - first) * 10) / 10, sessions: loads.length };
}

/** "2h15", "2h", "45 min" — curto pra caber no card de 3 colunas no celular. */
export function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes ? `${hours}h${String(minutes).padStart(2, "0")}` : `${hours}h`;
}
