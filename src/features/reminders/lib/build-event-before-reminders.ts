import { formatInTimeZone } from "date-fns-tz";
import { matchAttendeesToContactIds } from "@/features/events/lib/match-attendees-to-contacts";
import type { DesiredReminder } from "./reconcile-generated-reminders";

export interface EventForRule {
  id: string;
  title: string;
  starts_at: string;
  status: string;
  attendees: unknown;
  item_id: string | null;
  conference_url: string | null;
}

export interface ContactForEventRule {
  id: string;
  email: string | null;
  relationship: string;
  whatsapp_opt_in: boolean;
  email_opt_in: boolean;
}

export interface EventBeforeRuleConfig {
  /** Recipient_type "contacts" (padrão 24h). */
  hoursBefore?: number;
  /** Recipient_type "me" (padrão 30min). */
  minutesBefore?: number;
  /** Vazio/ausente = qualquer relação. */
  onlyRelationships?: string[];
}

export interface EventBeforeRule {
  id: string;
  recipientType: string;
  channel: string;
  messageTemplate: string;
  config: EventBeforeRuleConfig;
}

const DEFAULT_HOURS_BEFORE = 24;
const DEFAULT_MINUTES_BEFORE = 30;

function eventDateVars(startsAt: string, timezone: string): Record<string, string> {
  return {
    data: formatInTimeZone(new Date(startsAt), timezone, "dd/MM/yyyy"),
    hora: formatInTimeZone(new Date(startsAt), timezone, "HH:mm"),
  };
}

/**
 * Regra "Lembrete de reunião" (3.10, `kind='event_before'`) — duas variantes
 * pela mesma regra, distinguidas por `recipientType`: pros participantes
 * (contatos com opt-in, filtro opcional por relação) ou pro dono (push,
 * link pra nota da reunião se já existir). `{{data}}`/`{{hora}}` vêm
 * sobrescritas em `variables` com o horário **do evento**, não da entrega —
 * senão mostrariam a hora em que o lembrete dispara, não a da reunião.
 */
export function buildEventBeforeReminders(
  events: EventForRule[],
  contacts: ContactForEventRule[],
  rule: EventBeforeRule,
  timezone: string,
  now: Date,
  appUrl: string,
): DesiredReminder[] {
  const desired: DesiredReminder[] = [];

  for (const event of events) {
    if (event.status === "cancelled") continue;

    if (rule.recipientType === "contacts") {
      const attendees = Array.isArray(event.attendees) ? (event.attendees as { email: string }[]) : [];
      if (attendees.length === 0) continue;

      const matchedIds = matchAttendeesToContactIds(attendees, contacts);
      const contactsById = new Map(contacts.map((c) => [c.id, c]));
      const eligible = matchedIds.filter((id) => {
        const contact = contactsById.get(id);
        if (!contact) return false;
        if (!contact.whatsapp_opt_in && !contact.email_opt_in) return false;
        if (rule.config.onlyRelationships?.length && !rule.config.onlyRelationships.includes(contact.relationship)) return false;
        return true;
      });
      if (eligible.length === 0) continue;

      const hoursBefore = rule.config.hoursBefore ?? DEFAULT_HOURS_BEFORE;
      const sendAt = new Date(new Date(event.starts_at).getTime() - hoursBefore * 60 * 60 * 1000);
      if (sendAt.getTime() < now.getTime()) continue;

      desired.push({
        sourceType: "event",
        sourceId: event.id,
        sendAt: sendAt.toISOString(),
        title: event.title,
        messageTemplate: rule.messageTemplate,
        channel: rule.channel,
        recipientType: "contacts",
        contactIds: eligible,
        variables: { link: event.conference_url ?? "", ...eventDateVars(event.starts_at, timezone) },
        itemId: event.item_id,
      });
    } else {
      const minutesBefore = rule.config.minutesBefore ?? DEFAULT_MINUTES_BEFORE;
      const sendAt = new Date(new Date(event.starts_at).getTime() - minutesBefore * 60 * 1000);
      if (sendAt.getTime() < now.getTime()) continue;

      const link = event.item_id ? `${appUrl}/itens/${event.item_id}` : (event.conference_url ?? "");

      desired.push({
        sourceType: "event",
        sourceId: event.id,
        sendAt: sendAt.toISOString(),
        title: event.title,
        messageTemplate: rule.messageTemplate,
        channel: rule.channel,
        recipientType: "me",
        contactIds: [],
        variables: { link, ...eventDateVars(event.starts_at, timezone) },
        itemId: event.item_id,
      });
    }
  }

  return desired;
}
