import "server-only";
import { hmacSha256Hex, safeEqual } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";

export const OAUTH_STATE_COOKIE = "google_oauth_state";
export const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

interface OAuthStatePayload {
  state: string;
  codeVerifier: string;
}

/**
 * Valor do cookie httpOnly do fluxo OAuth (3.4): `base64url(payload).hmac`.
 * Assinado com `ENCRYPTION_KEY` (reaproveitada — não há motivo pra mais um
 * segredo só pra isso) pra garantir que ninguém forje um `code_verifier`
 * arbitrário. Não precisa ser reversível pelo lado errado, só à prova de
 * adulteração — por isso HMAC, não `encrypt`.
 */
export function signOAuthStateCookie(payload: OAuthStatePayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = hmacSha256Hex(serverEnv.ENCRYPTION_KEY, encoded);
  return `${encoded}.${signature}`;
}

/** `null` se o cookie faltar, estiver corrompido, com assinatura inválida ou `state` diferente do devolvido pelo Google. */
export function verifyOAuthStateCookie(cookieValue: string | undefined, expectedState: string): { codeVerifier: string } | null {
  if (!cookieValue) return null;
  const [encoded, signature] = cookieValue.split(".");
  if (!encoded || !signature) return null;

  const expectedSignature = hmacSha256Hex(serverEnv.ENCRYPTION_KEY, encoded);
  if (!safeEqual(signature, expectedSignature)) return null;

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthStatePayload;
  } catch {
    return null;
  }
  if (typeof payload.state !== "string" || typeof payload.codeVerifier !== "string") return null;
  if (!safeEqual(payload.state, expectedState)) return null;

  return { codeVerifier: payload.codeVerifier };
}
