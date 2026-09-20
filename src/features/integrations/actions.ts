"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { revokeGoogleToken } from "@/lib/google/oauth";
import { fail, ok, type Result } from "@/lib/result";
import type { Database } from "@/lib/supabase/database.types";

type CalendarUpdate = Database["public"]["Tables"]["calendars"]["Update"];

const INTEGRATIONS_PATH = "/configuracoes/integracoes";

/**
 * Desconecta uma conta Google (3.4): revoga o refresh token no Google (ele
 * para de valer mesmo se alguém tivesse uma cópia) e apaga a conexão — o
 * `on delete cascade` (3.1) já leva `calendars` e zera `events.calendar_id`
 * junto.
 */
export async function disconnectGoogle(connectionId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { data: connection } = await supabase
    .from("google_connections")
    .select("id, refresh_token_encrypted")
    .eq("id", connectionId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!connection) return fail("Conexão não encontrada.");

  try {
    await revokeGoogleToken(decrypt(connection.refresh_token_encrypted));
  } catch {
    // Mesmo se a revogação no Google falhar (token já inválido, rede fora),
    // seguimos apagando localmente — o dono pediu pra desconectar.
  }

  const { error } = await supabase.from("google_connections").delete().eq("id", connectionId);
  if (error) return fail("Não foi possível desconectar.");

  revalidatePath(INTEGRATIONS_PATH);
  return ok(null);
}

const updateCalendarSchema = z.object({
  calendarId: z.string().uuid(),
  syncEnabled: z.boolean().optional(),
  spaceId: z.string().uuid().nullable().optional(),
});

/** Liga/desliga a sincronização de um calendário e/ou muda o espaço em que os eventos dele caem (3.4). */
export async function updateCalendarSync(input: z.infer<typeof updateCalendarSchema>): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const parsed = updateCalendarSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");

  const updates: CalendarUpdate = {};
  if (parsed.data.syncEnabled !== undefined) updates.sync_enabled = parsed.data.syncEnabled;
  if (parsed.data.spaceId !== undefined) updates.space_id = parsed.data.spaceId;
  if (Object.keys(updates).length === 0) return ok(null);

  const { error } = await supabase
    .from("calendars")
    .update(updates)
    .eq("id", parsed.data.calendarId)
    .eq("owner_id", user.id);
  if (error) return fail("Não foi possível salvar.");

  revalidatePath(INTEGRATIONS_PATH);
  return ok(null);
}
