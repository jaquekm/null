import { addDaysToDateString } from "@/lib/dates";

/** Saudação pela hora local (0–23): madrugada conta como "Boa noite". */
export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** "terça-feira, 29 de setembro" a partir de "2026-09-29" (data pura, sem fuso). */
export function formatDayHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
  return date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

/** "09:30" no fuso da dona. */
export function formatTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

export interface BillForToday {
  id: string;
  description: string;
  amountCents: number;
  paidCents: number;
  dueOn: string;
  direction: string;
  status: string;
}

export interface DueBill extends BillForToday {
  /** Quanto falta pagar (valor − já pago). */
  remainingCents: number;
  /** "vence hoje", "venceu há 3 dias", "vence amanhã", "vence em 5 dias". */
  dueLabel: string;
  overdue: boolean;
}

export function dueLabel(dueOn: string, today: string): string {
  const days = daysBetween(today, dueOn);
  if (days === 0) return "vence hoje";
  if (days === 1) return "vence amanhã";
  if (days === -1) return "venceu ontem";
  if (days < 0) return `venceu há ${-days} dias`;
  return `vence em ${days} dias`;
}

/** Contas a pagar em aberto que já venceram ou vencem nos próximos `days` dias, da mais urgente pra menos. */
export function billsDueSoon(bills: BillForToday[], today: string, days = 7): DueBill[] {
  const limit = addDaysToDateString(today, days);
  return bills
    .filter((bill) => bill.direction === "payable" && (bill.status === "open" || bill.status === "partial") && bill.dueOn <= limit)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
    .map((bill) => ({
      ...bill,
      remainingCents: Math.max(bill.amountCents - bill.paidCents, 0),
      dueLabel: dueLabel(bill.dueOn, today),
      overdue: bill.dueOn < today,
    }));
}

/** Resumo de uma linha pro topo: "3 compromissos, 2 lembretes e 1 conta vencendo". */
export function daySummary(counts: { events: number; reminders: number; tasks: number; bills: number }): string {
  const parts = [
    counts.events ? `${counts.events} ${counts.events === 1 ? "compromisso" : "compromissos"}` : "",
    counts.reminders ? `${counts.reminders} ${counts.reminders === 1 ? "lembrete" : "lembretes"}` : "",
    counts.tasks ? `${counts.tasks} ${counts.tasks === 1 ? "prazo" : "prazos"}` : "",
    counts.bills ? `${counts.bills} ${counts.bills === 1 ? "conta vencendo" : "contas vencendo"}` : "",
  ].filter(Boolean);
  if (parts.length === 0) return "Dia livre por aqui — nada marcado pra hoje.";
  const last = parts.pop();
  return `Hoje: ${parts.length ? `${parts.join(", ")} e ${last}` : last}.`;
}
