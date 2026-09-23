import "server-only";
import { computeShareExpiresAt } from "@/features/sharing/lib/compute-expires-at";
import { generateShareToken } from "@/features/sharing/lib/share-token";
import { serverEnv } from "@/lib/env";
import type { Client } from "../types";

/**
 * Link público de uma execução de relatório (6.4): `resource_type = 'report'`,
 * validade padrão de 30 dias, como o enunciado pede. Diferente do diálogo
 * "Compartilhar" de item (3.11, vários links por recurso), sempre chama de
 * novo cria outro — `report_runs.share_link_id` (migration 6.1) guarda só o
 * mais recente. Não dá pra "devolver o link existente" de verdade: o token
 * puro só existe uma vez, na criação (CLAUDE.md, "tokens só como hash
 * SHA-256") — não fica gravado em lugar nenhum pra reconstituir depois.
 */
export async function ensureReportShareLink(supabase: Client, ownerId: string, reportRunId: string): Promise<string> {
  const { token, prefix, hash } = generateShareToken();
  const { data: link, error } = await supabase
    .from("share_links")
    .insert({
      owner_id: ownerId,
      resource_type: "report",
      resource_id: reportRunId,
      token_hash: hash,
      token_prefix: prefix,
      permission: "view",
      include_attachments: false,
      expires_at: computeShareExpiresAt("30d"),
    })
    .select("id")
    .single();
  if (error || !link) throw error ?? new Error("Não foi possível criar o link.");

  await supabase.from("report_runs").update({ share_link_id: link.id }).eq("id", reportRunId);
  return `${serverEnv.APP_URL}/p/${token}`;
}
