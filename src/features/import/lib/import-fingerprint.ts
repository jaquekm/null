import { createHash } from "node:crypto";

export interface FingerprintedItem {
  title: string;
  content_text: string | null;
  properties: unknown;
  space_id: string | null;
  type_id: string | null;
  status: string;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, v]) => `${JSON.stringify(key)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * "Desfazer importação" só remove o que o dono não mexeu. Comparar
 * `updated_at` não serve: jobs do próprio sistema (extração de texto de
 * anexo, OCR) atualizam o item depois da importação, e aí nada era removido.
 * A impressão digital cobre só o que o dono edita — título, texto,
 * propriedades, espaço, tipo e status.
 */
export function importFingerprint(item: FingerprintedItem): string {
  const payload = stableStringify([item.title, item.content_text ?? "", item.properties ?? {}, item.space_id, item.type_id, item.status]);
  return createHash("sha256").update(payload).digest("hex");
}
