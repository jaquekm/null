"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";

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
