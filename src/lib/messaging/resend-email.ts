import "server-only";
import { Resend } from "resend";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderReminderEmail } from "./emails/reminder-email";
import { buildOptOutToken } from "./opt-out-token";
import type { MessageChannel, MessageChannelSendInput } from "./types";

/**
 * Canal de e-mail via Resend (3.9). Busca `contact_id` da entrega
 * (`deliveryId`) pra montar o link de opt-out assinado (3.11) no rodapé —
 * fica de fora quando o destinatário é o próprio dono. `reply_to` sempre o
 * e-mail pessoal do dono, como o enunciado pede.
 */
export class ResendEmailChannel implements MessageChannel {
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(input: MessageChannelSendInput): Promise<{ providerMessageId?: string }> {
    const admin = createAdminClient();
    const { data: delivery } = await admin.from("reminder_deliveries").select("contact_id").eq("id", input.deliveryId).maybeSingle();

    const optOutUrl = delivery?.contact_id
      ? `${serverEnv.APP_URL}/p/opt-out/${buildOptOutToken({ contactId: delivery.contact_id, channel: "email" })}`
      : null;

    const html = await renderReminderEmail({ text: input.text, optOutUrl });

    const result = await this.client.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject ?? "Lembrete",
      html,
      replyTo: serverEnv.OWNER_EMAIL,
      attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
    });

    if (result.error) throw new Error(result.error.message);
    return { providerMessageId: result.data?.id };
  }
}
