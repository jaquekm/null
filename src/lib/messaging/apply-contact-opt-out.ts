import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type AdminClient = SupabaseClient<Database>;

/**
 * Opt-out de um contato (3.9 webhook N8N "SAIR"/"PARE"/"STOP", 3.11
 * `/p/opt-out/[token]`) — desliga os dois canais e grava `opted_out_at`.
 * Único ponto que faz isso, reaproveitado pelos dois fluxos.
 */
export async function applyContactOptOut(admin: AdminClient, filter: { contactId: string } | { phone: string }): Promise<void> {
  const query = admin
    .from("contacts")
    .update({ opted_out_at: new Date().toISOString(), whatsapp_opt_in: false, email_opt_in: false });

  if ("contactId" in filter) {
    await query.eq("id", filter.contactId);
  } else {
    await query.eq("phone_e164", filter.phone);
  }
}
