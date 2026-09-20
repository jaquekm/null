import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "@/lib/crypto";
import type { Database } from "@/lib/supabase/database.types";
import { refreshAccessToken } from "./oauth";

type Client = SupabaseClient<Database>;

/** Faltam menos de 5 min pro access token expirar → renova antes de usar (3.4). */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export class GoogleConnectionNotFoundError extends Error {
  constructor() {
    super("Conexão com o Google Calendar não encontrada.");
    this.name = "GoogleConnectionNotFoundError";
  }
}

export class GoogleConnectionRevokedError extends Error {
  constructor() {
    super("A conexão com o Google Calendar foi revogada. Reconecte em /configuracoes/integracoes.");
    this.name = "GoogleConnectionRevokedError";
  }
}

/**
 * TODO(3.9): quando os canais de envio existirem, chamar daqui pra avisar o
 * dono por push/e-mail ("Reconecte o Google Calendar"), como o enunciado da
 * 3.4 pede. Por enquanto só grava `last_error` — a página
 * `/configuracoes/integracoes` (3.4) já mostra conexões com `status='revoked'`
 * em destaque, então o dono não fica sem saber.
 */
async function markConnectionRevoked(supabase: Client, connectionId: string, reason: string): Promise<void> {
  await supabase.from("google_connections").update({ status: "revoked", last_error: reason }).eq("id", connectionId);
}

/**
 * `getAccessToken` (3.4, `src/lib/google/client.ts`): access token válido
 * pra chamar a API do Google Calendar, renovando com o refresh token quando
 * faltar pouco pra expirar. Se o Google responder `invalid_grant` (refresh
 * token revogado do lado do usuário, ex.: removeu o acesso do app na conta
 * Google), marca a conexão como `revoked` e lança — quem chama (3.5) decide
 * como reagir (não adianta tentar de novo).
 */
export async function getAccessToken(supabase: Client, connectionId: string): Promise<string> {
  const { data: connection, error } = await supabase
    .from("google_connections")
    .select("status, refresh_token_encrypted, access_token_encrypted, access_token_expires_at")
    .eq("id", connectionId)
    .maybeSingle();
  if (error || !connection) throw new GoogleConnectionNotFoundError();
  if (connection.status !== "active") throw new GoogleConnectionRevokedError();

  const expiresAt = connection.access_token_expires_at ? new Date(connection.access_token_expires_at).getTime() : 0;
  const needsRefresh = !connection.access_token_encrypted || expiresAt - Date.now() < REFRESH_MARGIN_MS;

  if (!needsRefresh) {
    return decrypt(connection.access_token_encrypted!);
  }

  const refreshToken = decrypt(connection.refresh_token_encrypted);
  let tokens;
  try {
    tokens = await refreshAccessToken(refreshToken);
  } catch (err) {
    if (err instanceof Error && err.name === "invalid_grant") {
      await markConnectionRevoked(supabase, connectionId, "invalid_grant ao renovar o token.");
      throw new GoogleConnectionRevokedError();
    }
    throw err;
  }

  const newExpiresAt = new Date(Date.now() + tokens.expiresInSeconds * 1000).toISOString();
  await supabase
    .from("google_connections")
    .update({ access_token_encrypted: encrypt(tokens.accessToken), access_token_expires_at: newExpiresAt })
    .eq("id", connectionId);

  return tokens.accessToken;
}
