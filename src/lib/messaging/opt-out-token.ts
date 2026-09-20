import "server-only";
import { hmacSha256Hex, safeEqual } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";

export interface OptOutTokenPayload {
  contactId: string;
  channel: "whatsapp" | "email";
}

/**
 * Token assinado (HMAC) de opt-out público — `APP_URL/p/opt-out/<token>`
 * (3.11, ainda não construído; usado desde já no rodapé dos e-mails, 3.9).
 * Reaproveita `ENCRYPTION_KEY` como segredo, mesma decisão do cookie
 * assinado do fluxo OAuth (3.4): não vale criar uma variável de ambiente
 * nova só pra assinar um token público de vida longa.
 */
export function buildOptOutToken(payload: OptOutTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = hmacSha256Hex(serverEnv.ENCRYPTION_KEY, encoded);
  return `${encoded}.${signature}`;
}

/** Confere a assinatura (tempo constante) e decodifica — `null` se inválido, adulterado ou malformado. */
export function verifyOptOutToken(token: string): OptOutTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts as [string, string];

  const expected = hmacSha256Hex(serverEnv.ENCRYPTION_KEY, encoded);
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<OptOutTokenPayload>;
    if (typeof payload.contactId !== "string" || (payload.channel !== "whatsapp" && payload.channel !== "email")) return null;
    return { contactId: payload.contactId, channel: payload.channel };
  } catch {
    return null;
  }
}
