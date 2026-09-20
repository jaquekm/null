import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** `code_verifier` do PKCE (RFC 7636) — 32 bytes aleatórios em base64url (43 caracteres, dentro da faixa 43-128 exigida). */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

/** `code_challenge` (método `S256`): base64url do SHA-256 do `code_verifier`. */
export function computeCodeChallengeS256(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

/** `state` do fluxo OAuth (3.4) — protege contra CSRF, comparado com `safeEqual` no callback. */
export function generateState(): string {
  return randomBytes(32).toString("base64url");
}
