import "server-only";
import { publicEnv, serverEnv } from "@/lib/env";
import { N8nWhatsAppChannel } from "./n8n-whatsapp";
import { ResendEmailChannel } from "./resend-email";
import type { MessageChannel, MessageChannelKind } from "./types";
import { WebPushChannel } from "./web-push";

const cache = new Map<MessageChannelKind, MessageChannel | null>();

function buildChannel(kind: MessageChannelKind): MessageChannel | null {
  if (kind === "email") {
    if (!serverEnv.RESEND_API_KEY || !serverEnv.EMAIL_FROM) return null;
    return new ResendEmailChannel(serverEnv.RESEND_API_KEY, serverEnv.EMAIL_FROM);
  }

  if (kind === "whatsapp") {
    if (serverEnv.MESSAGING_PROVIDER !== "n8n" || !serverEnv.N8N_WHATSAPP_WEBHOOK_URL || !serverEnv.N8N_WEBHOOK_SECRET) return null;
    return new N8nWhatsAppChannel(serverEnv.N8N_WHATSAPP_WEBHOOK_URL, serverEnv.N8N_WEBHOOK_SECRET);
  }

  if (kind === "push") {
    if (!serverEnv.VAPID_PRIVATE_KEY || !serverEnv.VAPID_SUBJECT || !publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return null;
    return new WebPushChannel(serverEnv.VAPID_SUBJECT, publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY, serverEnv.VAPID_PRIVATE_KEY);
  }

  return null;
}

/**
 * Escolhe a implementação de `MessageChannel` pra cada canal (3.9), por
 * variável de ambiente (CLAUDE.md: "implementação trocável por variável de
 * ambiente") — sem as chaves/URLs configuradas, `null` (mesmo padrão de
 * `getTranscriptionProvider`, fase 2). Uma instância por `kind`, cacheada na
 * primeira leitura.
 */
export function getMessageChannel(kind: MessageChannelKind): MessageChannel | null {
  if (!cache.has(kind)) cache.set(kind, buildChannel(kind));
  return cache.get(kind) ?? null;
}

export type { MessageChannel, MessageChannelKind, MessageChannelSendInput } from "./types";
