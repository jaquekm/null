import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { formatBRL } from "@/lib/money";
import type { DesiredReminder } from "./reconcile-generated-reminders";

export interface BillForDueRule {
  id: string;
  description: string;
  direction: "payable" | "receivable";
  amount_cents: number;
  due_on: string;
  status: string;
  contact_id: string | null;
  recurring_id: string | null;
}

export interface ContactForBillDueRule {
  id: string;
  whatsapp_opt_in: boolean;
  email_opt_in: boolean;
}

export interface BillDueRuleConfig {
  /** Padrão 3 — mesmo default de `fin_recurring.remind_days_before` (4.8). */
  daysBefore?: number;
}

export interface BillDueRule {
  id: string;
  recipientType: string;
  channel: string;
  messageTemplate: string;
  config: BillDueRuleConfig;
}

const DEFAULT_DAYS_BEFORE = 3;
const ALL_DAY_HOUR = "09:00:00";

function billVars(bill: BillForDueRule, dueAt: Date, timezone: string): Record<string, string> {
  return { data: formatInTimeZone(dueAt, timezone, "dd/MM/yyyy"), valor: formatBRL(bill.amount_cents) };
}

/**
 * Regra "Conta a vencer" (4.8, `kind='bill_due'`) — igual `event_before`,
 * uma regra só com duas variantes por `recipientType`:
 * - "me": só contas **a pagar** ainda abertas/parciais — dois lembretes,
 *   `daysBefore` dias antes e no próprio dia do vencimento (9h local).
 * - "contacts": só contas **a receber** com contato vinculado e opt-in
 *   (WhatsApp ou e-mail) — cobrança amigável `daysBefore` dias antes e no
 *   dia seguinte ao vencimento. `{{link}}` (link de pagamento) fica vazio
 *   até a 4.10 existir — o template pode usá-lo desde já, só não resolve
 *   nada ainda.
 * `daysBefore` é o de `rule.config`, a menos que a conta venha de uma
 * recorrência com o próprio `remind_days_before` preenchido (4.8) — nesse
 * caso a recorrência manda.
 */
export function buildBillDueReminders(
  bills: BillForDueRule[],
  contacts: ContactForBillDueRule[],
  remindDaysBeforeByRecurringId: Map<string, number>,
  rule: BillDueRule,
  timezone: string,
  now: Date,
): DesiredReminder[] {
  const desired: DesiredReminder[] = [];
  const contactsById = new Map(contacts.map((c) => [c.id, c]));
  const defaultDaysBefore = rule.config.daysBefore ?? DEFAULT_DAYS_BEFORE;

  for (const bill of bills) {
    if (bill.status !== "open" && bill.status !== "partial") continue;

    const daysBefore = (bill.recurring_id ? remindDaysBeforeByRecurringId.get(bill.recurring_id) : undefined) ?? defaultDaysBefore;
    const dueAt = fromZonedTime(`${bill.due_on}T${ALL_DAY_HOUR}`, timezone);
    const vars = billVars(bill, dueAt, timezone);

    if (rule.recipientType === "me") {
      if (bill.direction !== "payable") continue;

      const beforeAt = new Date(dueAt.getTime() - daysBefore * 24 * 60 * 60 * 1000);
      if (beforeAt.getTime() >= now.getTime()) {
        desired.push({
          sourceType: "bill_due",
          sourceId: `${bill.id}:before`,
          sendAt: beforeAt.toISOString(),
          title: bill.description,
          messageTemplate: rule.messageTemplate,
          channel: rule.channel,
          recipientType: "me",
          contactIds: [],
          variables: vars,
          itemId: null,
        });
      }
      if (dueAt.getTime() >= now.getTime()) {
        desired.push({
          sourceType: "bill_due",
          sourceId: `${bill.id}:due`,
          sendAt: dueAt.toISOString(),
          title: bill.description,
          messageTemplate: rule.messageTemplate,
          channel: rule.channel,
          recipientType: "me",
          contactIds: [],
          variables: vars,
          itemId: null,
        });
      }
    } else {
      if (bill.direction !== "receivable" || !bill.contact_id) continue;
      const contact = contactsById.get(bill.contact_id);
      if (!contact || (!contact.whatsapp_opt_in && !contact.email_opt_in)) continue;

      const beforeAt = new Date(dueAt.getTime() - daysBefore * 24 * 60 * 60 * 1000);
      if (beforeAt.getTime() >= now.getTime()) {
        desired.push({
          sourceType: "bill_due",
          sourceId: `${bill.id}:before`,
          sendAt: beforeAt.toISOString(),
          title: bill.description,
          messageTemplate: rule.messageTemplate,
          channel: rule.channel,
          recipientType: "contacts",
          contactIds: [bill.contact_id],
          variables: vars,
          itemId: null,
        });
      }

      const afterAt = new Date(dueAt.getTime() + 24 * 60 * 60 * 1000);
      if (afterAt.getTime() >= now.getTime()) {
        desired.push({
          sourceType: "bill_due",
          sourceId: `${bill.id}:after`,
          sendAt: afterAt.toISOString(),
          title: bill.description,
          messageTemplate: rule.messageTemplate,
          channel: rule.channel,
          recipientType: "contacts",
          contactIds: [bill.contact_id],
          variables: vars,
          itemId: null,
        });
      }
    }
  }

  return desired;
}
