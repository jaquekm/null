import { notifyOwner } from "@/lib/messaging/notify-owner";
import type { JobHandler } from "../types";

const WARNING_WINDOW_DAYS = 7;

/**
 * Job `check_mcp_token_expiry` (6.9, "aviso de expiração por push"): tokens
 * de escopo MCP são obrigados a ter validade (`createTokenSchema`, máx. 90
 * dias) — sem aviso, o dono só descobre que expirou quando o cliente MCP
 * parar de funcionar. Roda diário; avisa uma vez por token
 * (`expiry_warned_at`, mesmo espírito do carimbo "já enviado hoje" de
 * `check_reviews_due`, 5.7).
 */
export const checkMcpTokenExpiry: JobHandler = async (job, { supabase }) => {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + WARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const { data: tokens, error } = await supabase
    .from("api_tokens")
    .select("id, name, expires_at")
    .eq("owner_id", job.owner_id)
    .is("revoked_at", null)
    .is("expiry_warned_at", null)
    .not("expires_at", "is", null)
    .lte("expires_at", windowEnd.toISOString())
    .overlaps("scopes", ["mcp:read", "mcp:write", "finance:read"]);
  if (error) return { status: "retry", error: error.message };

  let warned = 0;
  for (const token of tokens ?? []) {
    if (!token.expires_at || new Date(token.expires_at).getTime() < now.getTime()) continue;

    const daysLeft = Math.ceil((new Date(token.expires_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    await notifyOwner(job.owner_id, {
      title: "Token MCP expirando",
      text: `O token "${token.name}" expira em ${daysLeft} dia${daysLeft === 1 ? "" : "s"} — crie um novo em /configuracoes/tokens antes que os clientes MCP parem de funcionar.`,
    });
    await supabase.from("api_tokens").update({ expiry_warned_at: now.toISOString() }).eq("id", token.id);
    warned++;
  }

  return { status: "done", result: { warned } };
};
