import "server-only";
import { hmacSha256Hex, safeEqual } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";

/** 12h (enunciado) — depois disso, o visitante digita a senha de novo. */
export const SHARE_AUTH_COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60;

/** Um cookie por link (não um só genérico) — abrir dois links com senha no mesmo navegador não mistura o acesso de um com o do outro. */
export function shareAuthCookieName(shareLinkId: string): string {
  return `share_auth_${shareLinkId}`;
}

/** Assinado (HMAC, reaproveita `ENCRYPTION_KEY` — mesma decisão de sempre nesse projeto pra segredo de cookie/token interno de vida curta) em vez de gravar a senha ou um valor adivinhável. */
export function signShareAuthCookie(shareLinkId: string): string {
  return hmacSha256Hex(serverEnv.ENCRYPTION_KEY, shareLinkId);
}

export function verifyShareAuthCookie(shareLinkId: string, cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  return safeEqual(cookieValue, signShareAuthCookie(shareLinkId));
}
