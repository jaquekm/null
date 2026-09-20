import "server-only";
import { hmacSha256Hex } from "@/lib/crypto";
import type { MessageChannel, MessageChannelSendInput } from "./types";

/**
 * Canal de WhatsApp via N8N (3.9, `docs/n8n-whatsapp.md`): o app só entrega
 * o `POST` assinado pro webhook do fluxo N8N — quem manda de verdade pela
 * API oficial do WhatsApp e confirma o resultado é o fluxo do dono, de
 * volta em `/api/webhooks/messaging`. Por isso `send` aqui só confirma que o
 * N8N *aceitou* a mensagem (`{}`, sem `providerMessageId` ainda); o
 * `provider_message_id`/status final chegam depois, pelo callback.
 */
export class N8nWhatsAppChannel implements MessageChannel {
  constructor(
    private readonly webhookUrl: string,
    private readonly secret: string,
  ) {}

  async send(input: MessageChannelSendInput): Promise<{ providerMessageId?: string }> {
    const body = JSON.stringify({
      deliveryId: input.deliveryId,
      to: input.to,
      text: input.text,
      template: input.template ?? null,
    });
    const signature = hmacSha256Hex(this.secret, body);

    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hub-Signature": signature },
      body,
    });

    if (!response.ok) {
      throw new Error(`N8N respondeu ${response.status} ao tentar enviar a mensagem de WhatsApp.`);
    }

    return {};
  }
}
