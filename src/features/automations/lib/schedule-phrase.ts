import { describeRecurrence, parseReminderPhrase } from "@/features/reminders/lib/parse-reminder-phrase";
import { buildRRuleString, parseRecurrencePreset } from "@/features/reminders/lib/recurrence";

export type SchedulePhraseResult = { ok: true; rrule: string; description: string } | { ok: false; error: string };

/**
 * Gatilho "em um horário que se repete" escrito do jeito que se fala (9.8):
 * "toda sexta às 17h", "todo dia 10", "de segunda a sexta às 7h". Usa o
 * mesmo parser dos lembretes (9.4) e grava um RRULE com `DTSTART` na
 * primeira ocorrência — assim o job de automações de horário não dispara
 * nada no passado. "Amanhã às 9h" (uma vez só) não vale: automação de
 * horário é sempre repetição.
 */
export function scheduleFromPhrase(text: string, now: Date, timezone: string): SchedulePhraseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Escreva quando repete — ex.: toda segunda às 8h." };

  const parsed = parseReminderPhrase(trimmed, now, timezone);
  if (!parsed) return { ok: false, error: "Não entendi quando. Tente: toda segunda às 8h, todo dia 10, de segunda a sexta às 7h." };
  if (parsed.recurrence.kind === "once") return { ok: false, error: "Diga quando repete — ex.: toda sexta às 17h (não só uma vez)." };

  const rrule = buildRRuleString(parsed.recurrence, parsed.sendAt, timezone);
  if (!rrule) return { ok: false, error: "Não entendi quando repete." };
  return { ok: true, rrule, description: describeRecurrence(parsed.recurrence, parsed.time, parsed.date) };
}

/** `DTSTART:20261002T170000Z` (hora de parede, truque do `rrule`) → "17:00" e "2026-10-02". */
function dtstartParts(rrule: string): { time: string; date: string } | null {
  const match = /DTSTART(?:;[^:]*)?:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(rrule);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  return { time: `${hh}:${mm}`, date: `${y}-${m}-${d}` };
}

/**
 * O RRULE de um gatilho de horário em português ("toda sexta às 17:00").
 * Regras sem `DTSTART` (as dos packs, ex.: `FREQ=WEEKLY;BYDAY=MO`) saem sem
 * hora; formas que a interface não monta viram `null` (quem chama mostra o
 * texto técnico).
 */
export function describeScheduleRrule(rrule: string): string | null {
  const normalized = rrule.includes("RRULE:") ? rrule : `RRULE:${rrule.replace(/^RRULE:/, "")}`;
  const preset = parseRecurrencePreset(normalized);
  if (preset.kind === "custom" || preset.kind === "once") return null;
  const start = dtstartParts(rrule);
  return describeRecurrence(preset, start?.time ?? null, start?.date);
}
