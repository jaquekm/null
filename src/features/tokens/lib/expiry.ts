import type { TokenValidity } from "../schemas";

/** `validity` em dias a partir de `now`, ou `null` (sem validade) para "never". */
export function computeExpiresAt(validity: TokenValidity, now: Date = new Date()): string | null {
  if (validity === "never") return null;

  const expires = new Date(now);
  expires.setDate(expires.getDate() + Number(validity));
  return expires.toISOString();
}
