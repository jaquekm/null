import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { DesiredReminder } from "./reconcile-generated-reminders";

export interface ItemForDateFieldRule {
  id: string;
  title: string;
  type_id: string | null;
  properties: Record<string, unknown> | null;
}

export interface ItemDateFieldRuleConfig {
  typeId?: string;
  fieldKey?: string;
  /** `"date"` (sem hora, ex.: `Tarefa.prazo`) ou `"datetime"`. */
  fieldType?: "date" | "datetime";
  daysBefore?: number;
}

export interface ItemDateFieldRule {
  id: string;
  channel: string;
  messageTemplate: string;
  config: ItemDateFieldRuleConfig;
}

const DEFAULT_DAYS_BEFORE = 1;
const WINDOW_DAYS = 30;
const ALL_DAY_HOUR = "09:00:00";

/**
 * Regra "Campo de data de item" (3.10, `kind='item_date_field'`) — sempre
 * `recipientType: "me"` (não existe um contato natural pra um campo de
 * data qualquer). Campo `date` (sem hora) é tratado como vencendo às 9h
 * local do dia marcado, mesma convenção usada no planejador do dia (3.6).
 */
export function buildItemDateFieldReminders(
  items: ItemForDateFieldRule[],
  rule: ItemDateFieldRule,
  timezone: string,
  now: Date,
  appUrl: string,
): DesiredReminder[] {
  const { typeId, fieldKey, fieldType } = rule.config;
  if (!typeId || !fieldKey || !fieldType) return [];

  const daysBefore = rule.config.daysBefore ?? DEFAULT_DAYS_BEFORE;
  const desired: DesiredReminder[] = [];

  for (const item of items) {
    if (item.type_id !== typeId) continue;
    const rawValue = item.properties?.[fieldKey];
    if (typeof rawValue !== "string" || !rawValue) continue;

    const dueAt = fieldType === "date" ? fromZonedTime(`${rawValue}T${ALL_DAY_HOUR}`, timezone) : new Date(rawValue);
    if (Number.isNaN(dueAt.getTime())) continue;
    if (dueAt.getTime() > now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000) continue;

    const sendAt = new Date(dueAt.getTime() - daysBefore * 24 * 60 * 60 * 1000);
    if (sendAt.getTime() < now.getTime()) continue;

    desired.push({
      sourceType: "item_date_field",
      sourceId: item.id,
      sendAt: sendAt.toISOString(),
      title: item.title,
      messageTemplate: rule.messageTemplate,
      channel: rule.channel,
      recipientType: "me",
      contactIds: [],
      variables: { link: `${appUrl}/itens/${item.id}`, data: formatInTimeZone(dueAt, timezone, "dd/MM/yyyy") },
      itemId: item.id,
    });
  }

  return desired;
}
