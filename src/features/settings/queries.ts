import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/**
 * "OCR automático ligado/desligado" (2.9) — fica em `user_settings.preferences.autoOcr`,
 * não em `modules` (que liga/desliga a IA como um todo). Padrão ligado: só
 * desliga se o dono explicitamente marcar `false`.
 */
export async function isAutoOcrEnabled(supabase: Client, ownerId: string): Promise<boolean> {
  const { data } = await supabase.from("user_settings").select("preferences").eq("owner_id", ownerId).maybeSingle();
  const preferences = (data?.preferences as Record<string, unknown> | null) ?? {};
  return preferences.autoOcr !== false;
}
