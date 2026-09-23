"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import type { OwnerNotificationPreferences } from "./queries";

/** "Opção nas configurações: OCR automático ligado/desligado" (2.9). Desligado, só o botão manual "Extrair novamente" roda OCR. */
export async function setAutoOcr(enabled: boolean): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { data: current } = await supabase.from("user_settings").select("preferences").eq("owner_id", user.id).maybeSingle();
  const preferences = { ...((current?.preferences as Record<string, unknown> | null) ?? {}), autoOcr: enabled };

  const { error } = await supabase
    .from("user_settings")
    .upsert({ owner_id: user.id, preferences: preferences as unknown as Json }, { onConflict: "owner_id" });
  if (error) return fail("Não foi possível salvar.");

  revalidatePath("/configuracoes/midia");
  return ok(null);
}

/** "Criar notas de reunião automaticamente X minutos antes" (3.7) — liga/desliga e ajusta o `X`. */
export async function setMeetingNotesSettings(enabled: boolean, minutesBefore: number): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  if (!Number.isFinite(minutesBefore) || minutesBefore <= 0) return fail("Informe um número de minutos válido.");

  const { data: current } = await supabase.from("user_settings").select("preferences").eq("owner_id", user.id).maybeSingle();
  const preferences = {
    ...((current?.preferences as Record<string, unknown> | null) ?? {}),
    autoCreateMeetingNotes: enabled,
    meetingNotesMinutesBefore: minutesBefore,
  };

  const { error } = await supabase
    .from("user_settings")
    .upsert({ owner_id: user.id, preferences: preferences as unknown as Json }, { onConflict: "owner_id" });
  if (error) return fail("Não foi possível salvar.");

  revalidatePath("/configuracoes/integracoes");
  return ok(null);
}

/** "Indexar finanças e contatos" (6.5, `/configuracoes/ia`) — desligado por padrão (ver `isFinanceContactsIndexingEnabled`). */
export async function setFinanceContactsIndexing(enabled: boolean): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { data: current } = await supabase.from("user_settings").select("preferences").eq("owner_id", user.id).maybeSingle();
  const preferences = { ...((current?.preferences as Record<string, unknown> | null) ?? {}), indexFinanceContacts: enabled };

  const { error } = await supabase
    .from("user_settings")
    .upsert({ owner_id: user.id, preferences: preferences as unknown as Json }, { onConflict: "owner_id" });
  if (error) return fail("Não foi possível salvar.");

  revalidatePath("/configuracoes/ia");
  return ok(null);
}

/** "Notificações para o dono (configuráveis)" (3.9) — liga/desliga cada tipo de aviso. */
export async function setOwnerNotificationPreferences(preferences: OwnerNotificationPreferences): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { data: current } = await supabase.from("user_settings").select("preferences").eq("owner_id", user.id).maybeSingle();
  const updated = { ...((current?.preferences as Record<string, unknown> | null) ?? {}), ownerNotifications: preferences };

  const { error } = await supabase
    .from("user_settings")
    .upsert({ owner_id: user.id, preferences: updated as unknown as Json }, { onConflict: "owner_id" });
  if (error) return fail("Não foi possível salvar.");

  revalidatePath("/configuracoes/notificacoes");
  return ok(null);
}
