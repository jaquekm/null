import "server-only";
import { serverEnv } from "@/lib/env";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

/**
 * Escopos do Google Calendar (3.4) — conferidos contra a documentação atual
 * do Google, não assumidos: `calendar.events` (ler/criar/editar eventos) e
 * `calendar.calendarlist.readonly` (listar os calendários do usuário, sem
 * poder editá-los) são escopos reais e são exatamente os dois que o
 * enunciado pede, mais `openid`/`email` (OIDC) pra identificar a conta.
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "openid",
  "email",
];

function requireClientCredentials(): { clientId: string; clientSecret: string } {
  if (!serverEnv.GOOGLE_CLIENT_ID || !serverEnv.GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados.");
  }
  return { clientId: serverEnv.GOOGLE_CLIENT_ID, clientSecret: serverEnv.GOOGLE_CLIENT_SECRET };
}

/** URL de redirecionamento fixa da app — mesma usada na credencial OAuth do Google Cloud (3.4, passo [HUMANO]). */
export function getGoogleRedirectUri(): string {
  return `${serverEnv.APP_URL}/api/google/callback`;
}

/**
 * Monta a URL de consentimento do Google (`GET /api/google/connect`, 3.4):
 * `access_type=offline` (pra ganhar `refresh_token`) e `prompt=consent`
 * (senão o Google só devolve um novo `refresh_token` na primeira autorização
 * de cada usuário — `prompt=consent` força ele a aparecer sempre, útil pra
 * reconectar depois de uma revogação).
 */
export function buildAuthorizationUrl(input: { state: string; codeChallenge: string }): string {
  const { clientId } = requireClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

async function requestTokens(body: Record<string, string>): Promise<GoogleTokens> {
  const { clientId, clientSecret } = requireClientCredentials();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }).toString(),
  });
  const data = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !data.access_token) {
    const error = new Error(data.error_description ?? data.error ?? `HTTP ${res.status}`);
    error.name = data.error ?? "GoogleTokenError";
    throw error;
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null, expiresInSeconds: data.expires_in };
}

/** Troca o `code` do callback pelo primeiro par de tokens (3.4). */
export function exchangeAuthorizationCode(input: { code: string; codeVerifier: string }): Promise<GoogleTokens> {
  return requestTokens({
    code: input.code,
    code_verifier: input.codeVerifier,
    redirect_uri: getGoogleRedirectUri(),
    grant_type: "authorization_code",
  });
}

/** Renova o access token com o refresh token (`getAccessToken`, `src/lib/google/client.ts`). */
export function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  return requestTokens({ refresh_token: refreshToken, grant_type: "refresh_token" });
}

/** Revoga um token (access ou refresh) — "desconectar" apaga a autorização do lado do Google também (3.4). */
export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch(`${REVOKE_ENDPOINT}?${new URLSearchParams({ token }).toString()}`, { method: "POST" });
  // O revoke do Google devolve 200 mesmo pra um token já inválido/expirado — não há erro útil a tratar aqui.
}

/** E-mail da conta Google conectada, via UserInfo (OIDC) — não decodifica o `id_token` à toa, evita lidar com verificação de assinatura JWT. */
export async function fetchGoogleUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_ENDPOINT, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Não foi possível obter o e-mail da conta Google (HTTP ${res.status}).`);
  const data = (await res.json()) as { email?: string };
  if (!data.email) throw new Error("A conta Google não devolveu um e-mail.");
  return data.email;
}
