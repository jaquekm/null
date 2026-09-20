import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Normaliza um telefone digitado pelo dono pra E.164 (3.3), assumindo Brasil
 * quando o número não vem com código de país (`+55`). Devolve `null` pra
 * entrada vazia ou que não é um número válido — quem chama decide se isso é
 * erro de validação ou só "não preencheu".
 */
export function normalizePhoneToE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed = parsePhoneNumberFromString(trimmed, "BR");
  if (!parsed?.isValid()) return null;

  return parsed.number;
}
