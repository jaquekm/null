import "server-only";
import webpush, { WebPushError } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MessageChannel, MessageChannelSendInput } from "./types";

/**
 * Canal de push pro dono (3.9) — `input.to` é o `owner_id` (não um endpoint
 * único: um dono pode ter várias assinaturas, um por dispositivo). Envia
 * pra todas; se algum endpoint responder 404/410 (assinatura expirada/
 * revogada pelo navegador), remove essa assinatura do banco.
 */
export class WebPushChannel implements MessageChannel {
  constructor(subject: string, publicKey: string, privateKey: string) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  }

  async send(input: MessageChannelSendInput): Promise<{ providerMessageId?: string }> {
    const admin = createAdminClient();
    const { data: subscriptions } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("owner_id", input.to);

    if (!subscriptions || subscriptions.length === 0) {
      throw new Error("Nenhum dispositivo com notificações ativadas.");
    }

    const payload = JSON.stringify({ title: input.subject ?? "Hub", body: input.text, url: "/lembretes" });

    let sentCount = 0;
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          payload,
        );
        sentCount += 1;
      } catch (err) {
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
          await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        }
        // outros erros: essa assinatura falhou, mas tenta as demais do mesmo dono
      }
    }

    if (sentCount === 0) throw new Error("Falha ao enviar para todos os dispositivos do dono.");
    return {};
  }
}
