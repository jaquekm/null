const VALIDITY_DAYS = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 } as const;

export type ShareValidityOption = keyof typeof VALIDITY_DAYS | "none";

/** `null` = "sem validade" (o enunciado pede um aviso na UI nesse caso, não bloqueio). */
export function computeShareExpiresAt(validity: ShareValidityOption, now: Date = new Date()): string | null {
  if (validity === "none") return null;
  return new Date(now.getTime() + VALIDITY_DAYS[validity] * 24 * 60 * 60 * 1000).toISOString();
}
