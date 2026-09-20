import { NextResponse } from "next/server";
import { z } from "zod";
import { hmacSha256Hex, safeEqual } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";
import { applyContactOptOut } from "@/lib/messaging/apply-contact-opt-out";
import { createAdminClient } from "@/lib/supabase/admin";

const deliveryUpdateSchema = z.object({
  deliveryId: z.string().uuid(),
  status: z.enum(["sent", "delivered", "read", "failed"]),
  providerMessageId: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
});

const optOutSchema = z.object({
  type: z.literal("opt_out"),
  phone: z.string().min(1),
});

/**
 * Callback do fluxo N8N (3.9, `docs/n8n-whatsapp.md`), assinado do mesmo
 * jeito que o app assina o `POST` de envio: `X-Hub-Signature` = HMAC-SHA256
 * do corpo cru com `N8N_WEBHOOK_SECRET`. Dois formatos de payload:
 * atualização de status de uma entrega, ou opt-out (mensagem "SAIR"/"PARE"/
 * "STOP" recebida no WhatsApp).
 */
export async function POST(request: Request) {
  const secret = serverEnv.N8N_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook de mensageria não configurado." }, { status: 401 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature") ?? "";
  if (!safeEqual(signature, hmacSha256Hex(secret, rawBody))) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const admin = createAdminClient();

  const optOut = optOutSchema.safeParse(payload);
  if (optOut.success) {
    await applyContactOptOut(admin, { phone: optOut.data.phone });
    return NextResponse.json({ ok: true });
  }

  const update = deliveryUpdateSchema.safeParse(payload);
  if (update.success) {
    await admin
      .from("reminder_deliveries")
      .update({
        status: update.data.status,
        provider_message_id: update.data.providerMessageId ?? null,
        error: update.data.error ?? null,
      })
      .eq("id", update.data.deliveryId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
}
