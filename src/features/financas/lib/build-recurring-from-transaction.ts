import { getDay } from "date-fns";
import type { RecurrencePreset, Weekday } from "@/features/reminders/lib/recurrence";
import type { TransactionRepeatOption, TransactionType } from "../schemas";

const WEEKDAY_CODES: Weekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/**
 * "Repetir" (4.4) oferece só semana/mês/ano, sem pedir dia da semana ou dia
 * do mês de novo — deriva da própria data do lançamento (ex.: lançou numa
 * quinta e marcou "toda semana" → repete toda quinta). Reaproveita o preset
 * de recorrência já usado pelos lembretes (`reminders/lib/recurrence.ts`,
 * 3.8), que por sua vez alimenta `buildRRuleString`/`nextOccurrence`.
 */
export function recurrencePresetForRepeat(repeat: TransactionRepeatOption, occurredOn: string): RecurrencePreset | null {
  if (repeat === "none") return null;

  const date = new Date(`${occurredOn}T00:00:00`);
  switch (repeat) {
    case "weekly":
      return { kind: "weekly", days: [WEEKDAY_CODES[getDay(date)]!] };
    case "monthly":
      return { kind: "monthly_day", day: date.getDate() };
    case "yearly":
      return { kind: "yearly" };
  }
}

/** `fin_recurring.direction` (4.2): despesa gera conta a pagar, receita gera conta a receber. */
export function recurringDirectionForType(type: Exclude<TransactionType, "transfer">): "payable" | "receivable" {
  return type === "expense" ? "payable" : "receivable";
}
