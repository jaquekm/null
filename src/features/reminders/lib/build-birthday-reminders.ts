import { formatInTimeZone } from "date-fns-tz";
import { nextBirthdayOccurrence } from "./next-birthday";
import type { DesiredReminder } from "./reconcile-generated-reminders";

export interface ContactForBirthdayRule {
  id: string;
  name: string;
  nickname: string | null;
  birthday: string | null;
}

export interface BirthdayRuleConfig {
  /** "opcionalmente envio direto ao contato" (enunciado) — desligado por padrão. */
  sendToContact?: boolean;
}

export interface BirthdayRule {
  id: string;
  channel: string;
  messageTemplate: string;
  config: BirthdayRuleConfig;
}

const WINDOW_DAYS = 30;

/**
 * Regra "Aniversários" (3.10, `kind='birthday'`) — sempre gera um push **pro
 * dono** (`source_type='birthday'`) com uma sugestão de mensagem pra ele
 * mesmo mandar; com `config.sendToContact`, gera **também** um segundo
 * lembrete (`source_type='birthday_contact'` — tipo diferente, mesmo
 * `source_id`, pra não colidir com o primeiro no índice único de
 * `reminders`) que manda direto pro contato. O lembrete "pro dono" usa
 * `{{contato}}` (não `{{nome}}`, que ficaria vazio — destinatário é o
 * dono) e sobrescreve `nome`/`nome_completo`/`data` em `variables` pra a
 * sugestão embutida (o texto de `rule.messageTemplate`) sair personalizada
 * mesmo sem um `recipient` de verdade (3.8: `{{nome}}` só vem de `recipient`,
 * que é `null` pra lembretes `recipientType: "me"`).
 */
export function buildBirthdayReminders(contacts: ContactForBirthdayRule[], rule: BirthdayRule, timezone: string, now: Date): DesiredReminder[] {
  const desired: DesiredReminder[] = [];

  for (const contact of contacts) {
    if (!contact.birthday) continue;
    const next = nextBirthdayOccurrence(contact.birthday, timezone, now);
    if (!next) continue;
    if (next.getTime() > now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000) continue;

    const displayName = contact.nickname?.trim() || contact.name;
    const dataFormatted = formatInTimeZone(next, timezone, "dd/MM/yyyy");

    desired.push({
      sourceType: "birthday",
      sourceId: contact.id,
      sendAt: next.toISOString(),
      title: `Aniversário de ${contact.name}`,
      messageTemplate: `Hoje é aniversário de {{contato}}! Sugestão de mensagem: "${rule.messageTemplate}"`,
      channel: "push",
      recipientType: "me",
      contactIds: [],
      variables: { contato: displayName, nome: displayName, nome_completo: contact.name, data: dataFormatted },
      itemId: null,
    });

    if (rule.config.sendToContact) {
      desired.push({
        sourceType: "birthday_contact",
        sourceId: contact.id,
        sendAt: next.toISOString(),
        title: `Aniversário de ${contact.name}`,
        messageTemplate: rule.messageTemplate,
        channel: rule.channel,
        recipientType: "contacts",
        contactIds: [contact.id],
        variables: {},
        itemId: null,
      });
    }
  }

  return desired;
}
