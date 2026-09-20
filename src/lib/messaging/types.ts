import "server-only";

export interface MessageChannelSendInput {
  deliveryId: string;
  to: string;
  text: string;
  subject?: string;
  template?: { name: string; language: string; variables: string[] };
}

export interface MessageChannel {
  send(input: MessageChannelSendInput): Promise<{ providerMessageId?: string }>;
}

export type MessageChannelKind = "whatsapp" | "email" | "push";

/**
 * Provedor de cada canal — Resend (e-mail), N8N/WhatsApp Cloud API e
 * web-push são implementados na 3.9 (`docs/fase-03-...md`). Até lá,
 * `dispatch_reminders` (3.8) sempre recebe `null` daqui e marca a entrega
 * como `failed` ("canal não configurado"), no mesmo padrão de
 * `getTranscriptionProvider` (fase 2) pra provedor ainda sem chave.
 */
export function getMessageChannel(_kind: MessageChannelKind): MessageChannel | null {
  return null;
}
