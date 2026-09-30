import { addDaysToDateString } from "@/lib/dates";
import { isHabitLogged, type HabitLog } from "./habit-log";

/**
 * Rotina (10.1): grade da semana de hábitos, dias seguidos e mapa de
 * consistência. Tudo em cima do registro que já existe em cada item Hábito
 * (`properties.log`, 5.12) — sem tabela nova. Datas são `yyyy-MM-dd` no fuso
 * da dona (quem chama resolve o "hoje").
 */

export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_SHORT: Record<Weekday, string> = { MO: "Seg", TU: "Ter", WE: "Qua", TH: "Qui", FR: "Sex", SA: "Sáb", SU: "Dom" };
export const WEEKDAY_LONG: Record<Weekday, string> = { MO: "Segunda", TU: "Terça", WE: "Quarta", TH: "Quinta", FR: "Sexta", SA: "Sábado", SU: "Domingo" };

export interface HabitForWeek {
  id: string;
  title: string;
  log: HabitLog;
  /** `properties.frequency` (texto livre do pack: "FREQ=DAILY", "FREQ=WEEKLY;BYDAY=MO,WE"). */
  frequency: unknown;
  /** Dia em que o hábito começou — antes disso não conta como falta. */
  since: string;
}

export function weekdayOf(dateStr: string): Weekday {
  const [y, m, d] = dateStr.split("-").map(Number);
  const js = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay(); // 0 = domingo
  return WEEKDAYS[(js + 6) % 7]!;
}

/** Segunda-feira da semana de `dateStr`. */
export function startOfWeek(dateStr: string): string {
  return addDaysToDateString(dateStr, -WEEKDAYS.indexOf(weekdayOf(dateStr)));
}

export function weekDates(dateStr: string): string[] {
  const monday = startOfWeek(dateStr);
  return WEEKDAYS.map((_, i) => addDaysToDateString(monday, i));
}

const PT_DAYS: Record<string, Weekday> = { seg: "MO", ter: "TU", qua: "WE", qui: "TH", sex: "FR", sab: "SA", sáb: "SA", dom: "SU" };

/**
 * Dias da semana em que o hábito vale. `null` = todo dia (sem frequência,
 * "FREQ=DAILY" ou algo que não dá pra ler — melhor contar todo dia do que
 * esconder o hábito).
 */
export function scheduledWeekdays(frequency: unknown): Set<Weekday> | null {
  if (typeof frequency !== "string" || !frequency.trim()) return null;
  const text = frequency.trim();
  const byday = /BYDAY=([A-Z,]+)/i.exec(text);
  if (byday) {
    const days = byday[1]!
      .toUpperCase()
      .split(",")
      .filter((d): d is Weekday => (WEEKDAYS as readonly string[]).includes(d));
    return days.length > 0 ? new Set(days) : null;
  }
  if (/FREQ=/i.test(text)) return null;
  // Texto em português: "seg, qua e sex".
  // Abreviação ou nome inteiro ("qua", "quarta", "quarta-feira") — mas não "qualquer".
  const pattern = /\b(seg|ter|qua|qui|sex|s[aá]b|dom)(?:unda|ça|rta|nta|ta|ado|ingo)?(?:-feira)?s?(?![a-zà-ú])/g;
  const found = [...text.toLowerCase().matchAll(pattern)].map((m) => PT_DAYS[m[1]!.replace("á", "a")] ?? PT_DAYS[m[1]!]);
  const days = found.filter((d): d is Weekday => Boolean(d));
  return days.length > 0 ? new Set(days) : null;
}

export function frequencyFromWeekdays(days: Weekday[]): string {
  const unique = WEEKDAYS.filter((d) => days.includes(d));
  return unique.length === 0 || unique.length === 7 ? "FREQ=DAILY" : `FREQ=WEEKLY;BYDAY=${unique.join(",")}`;
}

export function describeFrequency(frequency: unknown): string {
  const days = scheduledWeekdays(frequency);
  if (!days) return "todo dia";
  const list = WEEKDAYS.filter((d) => days.has(d));
  if (list.join(",") === "MO,TU,WE,TH,FR") return "dias úteis";
  if (list.join(",") === "SA,SU") return "fins de semana";
  return list.map((d) => WEEKDAY_SHORT[d].toLowerCase()).join(", ");
}

export function isScheduled(habit: Pick<HabitForWeek, "frequency" | "since">, dateStr: string): boolean {
  if (dateStr < habit.since) return false;
  const days = scheduledWeekdays(habit.frequency);
  return days === null || days.has(weekdayOf(dateStr));
}

const MAX_LOOKBACK_DAYS = 800;

/**
 * Dias seguidos do hábito até hoje. Dia fora da frequência não quebra a
 * sequência; hoje ainda sem marcar também não (o dia não acabou).
 */
export function habitStreak(habit: HabitForWeek, today: string): number {
  let streak = 0;
  for (let i = 0; i < MAX_LOOKBACK_DAYS; i += 1) {
    const day = addDaysToDateString(today, -i);
    if (day < habit.since) break;
    if (!isScheduled(habit, day)) continue;
    if (isHabitLogged(habit.log, day)) streak += 1;
    else if (i === 0) continue;
    else break;
  }
  return streak;
}

export interface DayCompletion {
  done: number;
  scheduled: number;
}

export function dayCompletion(habits: HabitForWeek[], dateStr: string): DayCompletion {
  let done = 0;
  let scheduled = 0;
  for (const habit of habits) {
    if (!isScheduled(habit, dateStr)) continue;
    scheduled += 1;
    if (isHabitLogged(habit.log, dateStr)) done += 1;
  }
  return { done, scheduled };
}

/** Dias seguidos em que tudo que estava marcado pro dia foi feito (dia sem hábito não conta nem quebra; hoje pendente não quebra). */
export function perfectDaysStreak(habits: HabitForWeek[], today: string): number {
  if (habits.length === 0) return 0;
  const earliest = habits.reduce((min, h) => (h.since < min ? h.since : min), today);
  let streak = 0;
  for (let i = 0; i < MAX_LOOKBACK_DAYS; i += 1) {
    const day = addDaysToDateString(today, -i);
    if (day < earliest) break;
    const { done, scheduled } = dayCompletion(habits, day);
    if (scheduled === 0) continue;
    if (done === scheduled) streak += 1;
    else if (i === 0) continue;
    else break;
  }
  return streak;
}

export interface HeatDay {
  date: string;
  /** 0 = nada (ou sem hábito no dia), 1–4 = quanto do dia foi feito, -1 = futuro. */
  level: number;
  done: number;
  scheduled: number;
}

export function completionLevel({ done, scheduled }: DayCompletion): number {
  if (scheduled === 0 || done === 0) return 0;
  const ratio = done / scheduled;
  if (ratio >= 1) return 4;
  if (ratio >= 0.67) return 3;
  if (ratio >= 0.34) return 2;
  return 1;
}

/** Mapa de consistência: `weeks` colunas (semana, de segunda a domingo), a última é a semana de hoje. */
export function consistencyHeatmap(habits: HabitForWeek[], today: string, weeks = 16): HeatDay[][] {
  const lastMonday = startOfWeek(today);
  const columns: HeatDay[][] = [];
  for (let w = weeks - 1; w >= 0; w -= 1) {
    const monday = addDaysToDateString(lastMonday, -7 * w);
    columns.push(
      WEEKDAYS.map((_, i) => {
        const date = addDaysToDateString(monday, i);
        if (date > today) return { date, level: -1, done: 0, scheduled: 0 };
        const completion = dayCompletion(habits, date);
        return { date, level: completionLevel(completion), ...completion };
      }),
    );
  }
  return columns;
}
