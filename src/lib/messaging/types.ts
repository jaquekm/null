export interface MessageChannelSendInput {
  deliveryId: string;
  to: string;
  text: string;
  subject?: string;
  template?: { name: string; language: string; variables: string[] };
}

/**
 * Canal de envio atrás de interface (CLAUDE.md: "provedores externos ficam
 * atrás de uma interface, com implementação trocável por variável de
 * ambiente"). Implementações: `resend-email.ts` (e-mail), `n8n-whatsapp.ts`
 * (WhatsApp) e `web-push.ts` (push) — escolhidas por `getMessageChannel`
 * (`index.ts`), conforme as variáveis de ambiente configuradas (3.9).
 */
export interface MessageChannel {
  send(input: MessageChannelSendInput): Promise<{ providerMessageId?: string }>;
}

export type MessageChannelKind = "whatsapp" | "email" | "push";
