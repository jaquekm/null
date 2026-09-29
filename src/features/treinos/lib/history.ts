import { addDaysToDateString } from "@/lib/dates";
import { parseDecimal, sortSessions, validReps, type ExerciseEntry } from "./rules";

/** Segunda-feira da semana de `date` (yyyy-MM-dd), como calendário puro. */
export function weekStartOf(date: string): string {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = domingo
  return addDaysToDateString(date, -((weekday + 6) % 7));
}

const WEEKDAY = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });

/** "Ter, 29/09" — dia da semana ajuda a ler o histórico mais que a data sozinha. */
export function formatSessionDay(date: string): string {
  const weekday = WEEKDAY.format(new Date(`${date}T12:00:00Z`)).replace(".", "");
  const [, month, day] = date.split("-");
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day}/${month}`;
}

export function weekLabel(weekStart: string, today: string): string {
  const current = weekStartOf(today);
  if (weekStart === current) return "Esta semana";
  if (weekStart === addDaysToDateString(current, -7)) return "Semana passada";
  const [, month, day] = weekStart.split("-");
  return `Semana de ${day}/${month}`;
}

/** Sessões agrupadas por semana (seg–dom), da mais recente pra mais antiga; dentro da semana, o treino mais recente primeiro. */
export function groupByWeek<T extends { id: string; date: string; createdAt?: string }>(sessions: T[]): { weekStart: string; sessions: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const s of sortSessions(sessions).reverse()) {
    const key = weekStartOf(s.date);
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.entries()].map(([weekStart, list]) => ({ weekStart, sessions: list }));
}

export interface SessionSummary {
  exercisesDone: number;
  sets: number;
  /** kg × reps somado nos exercícios com carga. */
  volumeKg: number;
}

export function summarizeSession(exercises: Record<string, ExerciseEntry>): SessionSummary {
  let exercisesDone = 0;
  let sets = 0;
  let volumeKg = 0;
  for (const e of Object.values(exercises)) {
    const reps = validReps(e.reps);
    if (e.skipped || reps.length === 0) continue;
    exercisesDone += 1;
    sets += reps.length;
    volumeKg += (parseDecimal(e.load) ?? 0) * reps.reduce((a, b) => a + b, 0);
  }
  return { exercisesDone, sets, volumeKg: Math.round(volumeKg) };
}
