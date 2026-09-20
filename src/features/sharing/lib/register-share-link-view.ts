import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex } from "@/lib/crypto";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/**
 * Registra uma visualização (3.11) — só chamado depois que o acesso já foi
 * concedido (sem senha pendente), não no carregamento da tela de senha.
 * `view_count`/`last_viewed_at` em `share_links` via leitura+escrita (sem
 * incremento atômico no PostgREST) — aceitável pra um link de um app de
 * dono único, tráfego baixo o bastante pra a corrida entre duas
 * visualizações simultâneas não importar de verdade.
 */
export async function registerShareLinkView(admin: Client, ownerId: string, shareLinkId: string, ip: string, userAgent: string | null): Promise<void> {
  const { data } = await admin.from("share_links").select("view_count").eq("id", shareLinkId).maybeSingle();
  const nextCount = (data?.view_count ?? 0) + 1;

  await admin.from("share_links").update({ view_count: nextCount, last_viewed_at: new Date().toISOString() }).eq("id", shareLinkId);
  await admin.from("share_link_views").insert({ owner_id: ownerId, share_link_id: shareLinkId, ip_hash: sha256Hex(ip), user_agent: userAgent });
}
