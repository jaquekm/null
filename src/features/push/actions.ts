"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import { pushSubscriptionInputSchema } from "./schemas";

const NOTIFICATIONS_PATH = "/configuracoes/notificacoes";
const GENERIC_ERROR = "Não foi possível ativar as notificações. Tente de novo.";

/** "Ativar notificações neste dispositivo" (3.9) — `endpoint` é único por dispositivo/navegador, upsert idempotente. */
export async function subscribeToPush(input: z.input<typeof pushSubscriptionInputSchema>, userAgent?: string): Promise<Result<{ id: string }>> {
  const parsed = pushSubscriptionInputSchema.safeParse(input);
  if (!parsed.success) return fail("Assinatura de notificações inválida.");

  const { supabase, user } = await requireOwner();

  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        owner_id: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        user_agent: userAgent?.trim() ? userAgent.trim() : null,
      },
      { onConflict: "endpoint" },
    )
    .select("id")
    .single();
  if (error || !data) return fail(GENERIC_ERROR);

  revalidatePath(NOTIFICATIONS_PATH);
  return ok({ id: data.id });
}

export async function removePushSubscription(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error } = await supabase.from("push_subscriptions").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return fail("Não foi possível remover o dispositivo. Tente de novo.");

  revalidatePath(NOTIFICATIONS_PATH);
  return ok(null);
}
