/**
 * "Me avisar antes de cada evento" (9.4): um controle simples na Agenda em
 * cima da regra automática que já existe (`reminder_rules.kind='event_before'`
 * com `recipient_type='me'`, 3.10) — escolher o quanto antes e o canal cria,
 * ajusta ou desliga essa regra. WhatsApp (9.8) usa o número salvo em
 * Notificações.
 */
export const EVENT_ALERT_MINUTES = [10, 30, 60, 120, 1440] as const;
export type EventAlertMinutes = (typeof EVENT_ALERT_MINUTES)[number];

export const EVENT_ALERT_CHANNELS = ["push", "whatsapp", "email"] as const;
export type EventAlertChannel = (typeof EVENT_ALERT_CHANNELS)[number];

export const EVENT_ALERT_CHANNEL_LABELS: Record<EventAlertChannel, string> = { push: "notificação", whatsapp: "WhatsApp", email: "e-mail" };

export const EVENT_ALERT_RULE_NAME = "Aviso antes dos eventos";
export const EVENT_ALERT_MESSAGE = "⏰ {{titulo}} começa às {{hora}}\n{{link}}";

export function eventAlertLabel(minutes: number): string {
  if (minutes % 1440 === 0) return minutes === 1440 ? "1 dia antes" : `${minutes / 1440} dias antes`;
  if (minutes % 60 === 0) return minutes === 60 ? "1 hora antes" : `${minutes / 60} horas antes`;
  return `${minutes} minutos antes`;
}

export interface EventAlertRuleRow {
  id: string;
  kind: string;
  recipient_type: string;
  channel: string;
  enabled: boolean;
  config: unknown;
  created_at: string;
}

export interface EventAlertState {
  ruleId: string | null;
  /** `null` = desligado. */
  minutesBefore: number | null;
  channel: EventAlertChannel;
}

/** Estado do aviso a partir das regras da dona: a regra "evento → pra mim" mais antiga manda (é a que o controle edita). */
export function eventAlertState(rules: EventAlertRuleRow[]): EventAlertState {
  const rule = [...rules]
    .filter((r) => r.kind === "event_before" && r.recipient_type === "me")
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  if (!rule) return { ruleId: null, minutesBefore: null, channel: "push" };
  const config = (rule.config ?? {}) as { minutesBefore?: unknown };
  const minutes = typeof config.minutesBefore === "number" && config.minutesBefore > 0 ? config.minutesBefore : 30; // padrão da regra (3.10)
  const channel: EventAlertChannel = rule.channel === "email" || rule.channel === "whatsapp" ? rule.channel : "push";
  return { ruleId: rule.id, minutesBefore: rule.enabled ? minutes : null, channel };
}
