import { isWithinQuietHours } from "./quiet-hours";
import { formatInTimeZone } from "date-fns-tz";

export type SkipReason = "opt_out" | "quiet_hours" | "no_destination" | "rate_limit" | "too_late";

/** Mensagem pra terceiro atrasada mais que isto (ex.: cron parado) não sai — parabéns de aniversário três dias depois é pior que nada. */
export const MAX_LATENESS_THIRD_PARTY_MS = 24 * 60 * 60 * 1000;

/** Limite de mensagens por contato (3.8) — janela rolante de 24h, não "dia do calendário" (evita ambiguidade de fuso). */
export const DAILY_LIMIT_PER_CONTACT = 3;

export interface DeliveryDecisionInput {
  /** `true` quando o destinatário é um contato ("terceiro"); `false` quando é o próprio dono. */
  isThirdParty: boolean;
  optedOutAt: string | null;
  /** Opt-in do canal específico (`whatsapp_opt_in`/`email_opt_in`) — `true` pra canais sem esse conceito (push, e o próprio dono). */
  channelOptIn: boolean;
  destination: string | null;
  occurrenceAt: Date;
  /** Momento real do envio — o horário silencioso vale pra ele, não pra ocorrência (um job atrasado não pode mandar às 23h). Padrão: `occurrenceAt`. */
  sendAt?: Date;
  timezone: string;
  /** Quantas mensagens esse contato já recebeu nas últimas 24h (todos os lembretes). */
  deliveriesLast24h: number;
  /** "Enviar agora" (manual) ignora o horário silencioso — as outras verificações continuam valendo. */
  bypassQuietHours?: boolean;
}

export type DeliveryDecision = { allowed: true } | { allowed: false; reason: SkipReason };

/** Decide se uma entrega pode ser enviada (3.8) — ordem: opt-out → destino → atraso → horário silencioso → limite diário. */
export function decideDelivery(input: DeliveryDecisionInput): DeliveryDecision {
  if (input.isThirdParty && (input.optedOutAt || !input.channelOptIn)) {
    return { allowed: false, reason: "opt_out" };
  }

  if (!input.destination) {
    return { allowed: false, reason: "no_destination" };
  }

  const sendAt = input.sendAt ?? input.occurrenceAt;
  if (input.isThirdParty && !input.bypassQuietHours && sendAt.getTime() - input.occurrenceAt.getTime() > MAX_LATENESS_THIRD_PARTY_MS) {
    return { allowed: false, reason: "too_late" };
  }

  if (input.isThirdParty && !input.bypassQuietHours) {
    const hour = Number(formatInTimeZone(sendAt, input.timezone, "H"));
    if (isWithinQuietHours(hour)) return { allowed: false, reason: "quiet_hours" };
  }

  if (input.isThirdParty && input.deliveriesLast24h >= DAILY_LIMIT_PER_CONTACT) {
    return { allowed: false, reason: "rate_limit" };
  }

  return { allowed: true };
}
