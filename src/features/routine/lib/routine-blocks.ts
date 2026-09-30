import { z } from "zod";
import { addDaysToDateString, dateInTimezone, wallClockToIso } from "@/lib/dates";
import { WEEKDAYS, weekdayOf, type Weekday } from "@/features/habits/lib/habit-week";
import type { AgendaEntry } from "@/features/agenda/lib/agenda-entry";

/**
 * Rotina por horário (10.2): blocos fixos da semana ("6h acordar", "8h–9h
 * academia seg/qua/sex"). Ficam em `user_settings.preferences.routineBlocks`
 * — são poucos, só da dona, e não viram evento do Google. Horas são de relógio
 * (`HH:mm`) no fuso da dona.
 */

export const MAX_ROUTINE_BLOCKS = 60;
export const ROUTINE_COLOR = "#0d9488";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const routineBlockFields = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1, "Dê um nome ao bloco.").max(80),
  start: z.string().regex(TIME, "Horário inválido."),
  /** `null` = só um horário (ex.: "6h acordar"). */
  end: z.string().regex(TIME, "Horário inválido.").nullable(),
  /** Vazio = todo dia. */
  days: z.array(z.enum(WEEKDAYS)).max(7),
});

export const routineBlockSchema = routineBlockFields.refine((b) => b.end === null || b.end > b.start, { message: "O fim precisa ser depois do começo.", path: ["end"] });

export type RoutineBlock = z.infer<typeof routineBlockSchema>;

/** Lê o que está salvo; bloco estragado é ignorado (não derruba a página). */
export function parseRoutineBlocks(value: unknown): RoutineBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const parsed = routineBlockSchema.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });
}

export function sortBlocks(blocks: RoutineBlock[]): RoutineBlock[] {
  return [...blocks].sort((a, b) => a.start.localeCompare(b.start) || (a.end ?? a.start).localeCompare(b.end ?? b.start) || a.title.localeCompare(b.title));
}

export function blockRunsOn(block: Pick<RoutineBlock, "days">, weekday: Weekday): boolean {
  return block.days.length === 0 || block.days.includes(weekday);
}

export function blocksForDate(blocks: RoutineBlock[], dateStr: string): RoutineBlock[] {
  const weekday = weekdayOf(dateStr);
  return sortBlocks(blocks.filter((b) => blockRunsOn(b, weekday)));
}

/** Cria ou troca (pelo id), mantendo a ordem por horário. */
export function upsertBlock(blocks: RoutineBlock[], block: RoutineBlock): RoutineBlock[] {
  const exists = blocks.some((b) => b.id === block.id);
  return sortBlocks(exists ? blocks.map((b) => (b.id === block.id ? block : b)) : [...blocks, block]);
}

export function removeBlock(blocks: RoutineBlock[], id: string): RoutineBlock[] {
  return blocks.filter((b) => b.id !== id);
}

/** "08:00" → "8h", "08:30" → "8h30". */
export function formatHour(time: string): string {
  const [h, m] = time.split(":");
  return `${Number(h)}h${m === "00" ? "" : m}`;
}

export function describeBlockTime(block: Pick<RoutineBlock, "start" | "end">): string {
  return block.end ? `${formatHour(block.start)}–${formatHour(block.end)}` : formatHour(block.start);
}

export interface RoutineNow {
  /** Bloco em andamento (com fim) ou o horário pontual dos últimos 30 min. */
  current: RoutineBlock | null;
  next: RoutineBlock | null;
}

const POINT_WINDOW_MINUTES = 30;

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h! * 60 + m!;
}

/** "Agora: Academia · Depois: Almoço 13h" no Hoje. `time` = `HH:mm` de agora no fuso da dona. */
export function routineNow(blocks: RoutineBlock[], dateStr: string, time: string): RoutineNow {
  const today = blocksForDate(blocks, dateStr);
  const now = toMinutes(time);
  let current: RoutineBlock | null = null;
  for (const block of today) {
    const start = toMinutes(block.start);
    const end = block.end ? toMinutes(block.end) : start + POINT_WINDOW_MINUTES;
    if (start <= now && now < end) current = block; // o que começou por último vence
  }
  const next = today.find((b) => toMinutes(b.start) > now && b !== current) ?? null;
  return { current, next };
}

/**
 * Ocorrências dos blocos no intervalo da Agenda (`[startIso, endIso)`), como
 * entradas só de leitura (clique leva pra Rotina).
 */
export function buildRoutineEntries(blocks: RoutineBlock[], startIso: string, endIso: string, timezone: string): AgendaEntry[] {
  if (blocks.length === 0) return [];
  const firstDay = dateInTimezone(new Date(startIso), timezone);
  const lastDay = dateInTimezone(new Date(endIso), timezone);
  const entries: AgendaEntry[] = [];
  for (let day = firstDay; day <= lastDay; day = addDaysToDateString(day, 1)) {
    for (const block of blocksForDate(blocks, day)) {
      const start = wallClockToIso(`${day}T${block.start}`, timezone);
      if (start < startIso || start >= endIso) continue;
      entries.push({
        id: `routine:${block.id}:${day}`,
        title: block.title,
        start,
        end: block.end ? wallClockToIso(`${day}T${block.end}`, timezone) : null,
        allDay: false,
        color: ROUTINE_COLOR,
        editable: false,
        kind: "routine",
        href: "/rotina",
      });
    }
  }
  return entries;
}
