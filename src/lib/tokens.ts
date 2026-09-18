import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const TOKEN_PREFIX = "hub_";

export interface GeneratedToken {
  /** Valor completo — mostrado ao dono uma única vez, nunca guardado. */
  token: string;
  /** Primeiros caracteres, guardados para identificar o token numa lista. */
  prefix: string;
  /** sha256 do token completo — o que fica guardado em `api_tokens.token_hash`. */
  hash: string;
}

export function generateToken(): GeneratedToken {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, prefix: token.slice(0, 12), hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface VerifiedToken {
  ownerId: string;
  tokenId: string;
}

/**
 * Confere o token da rota `Authorization: Bearer <token>` (1.10/1.11):
 * hash existe, não revogado, não expirado, tem o escopo pedido. Atualiza
 * `last_used_at`. Roda com o cliente admin porque essas rotas (`/api/capture`
 * etc.) são públicas — não há sessão de usuário, `auth.uid()` é nulo.
 */
export async function verifyApiToken(request: Request, scope: string): Promise<VerifiedToken | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("api_tokens")
      .select("id, owner_id, scopes, revoked_at, expires_at")
      .eq("token_hash", hashToken(token))
      .maybeSingle();

    if (error || !data) return null;
    if (data.revoked_at) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;
    if (!data.scopes.includes(scope)) return null;

    await admin.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);

    return { ownerId: data.owner_id, tokenId: data.id };
  } catch {
    // Falha inesperada (rede, config) não deve vazar um 500 cru — trata como
    // "não autenticado", igual a um token ausente ou inválido.
    return null;
  }
}
