import "server-only";
import { randomBytes } from "node:crypto";
import { sha256Hex } from "@/lib/crypto";

export interface GeneratedShareToken {
  /** Valor completo — só existe aqui, mostrado ao dono uma única vez (a URL `APP_URL/p/<token>`). */
  token: string;
  /** Primeiros caracteres, só pra identificar o link numa lista — nunca dá pra recompor o token a partir dele. */
  prefix: string;
  /** sha256 do token completo — o que fica em `share_links.token_hash`. */
  hash: string;
}

/** Token de link de compartilhamento (3.11) — 32 bytes aleatórios em base64url, igual ao enunciado pede. */
export function generateShareToken(): GeneratedShareToken {
  const token = randomBytes(32).toString("base64url");
  return { token, prefix: token.slice(0, 8), hash: hashShareToken(token) };
}

export function hashShareToken(token: string): string {
  return sha256Hex(token);
}
