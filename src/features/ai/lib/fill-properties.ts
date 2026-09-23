import type { FieldDefinition, FieldType } from "@/features/types/schemas";
import { formatBRL } from "@/lib/money";

/**
 * "Preencher propriedades" (6.8) — só os tipos que um texto gerado pela IA
 * pode produzir com segurança. `relation`/`contact`/`file` ficam de fora: o
 * valor certo é o **id** de um registro existente, que a IA não tem como
 * adivinhar de forma confiável a partir do texto; `rollup` nunca é
 * armazenado (sempre calculado, `features/types/lib/rollup-query.ts`).
 */
const SUPPORTED_TYPES = new Set<FieldType>([
  "text",
  "long_text",
  "number",
  "money",
  "percent",
  "date",
  "datetime",
  "checkbox",
  "select",
  "multi_select",
  "url",
  "email",
  "phone",
  "rating",
  "duration",
]);

export function fillableFields(fields: FieldDefinition[]): FieldDefinition[] {
  return fields.filter((field) => SUPPORTED_TYPES.has(field.type) && !field.hidden);
}

function describeField(field: FieldDefinition): string {
  switch (field.type) {
    case "select":
      return `- "${field.key}" (${field.label}): um id destas opções — ${(field.options ?? []).map((o) => `${o.id}="${o.label}"`).join(", ")}. Ou null.`;
    case "multi_select":
      return `- "${field.key}" (${field.label}): lista de ids entre estas opções — ${(field.options ?? []).map((o) => `${o.id}="${o.label}"`).join(", ")}. Ou [].`;
    case "money":
      return `- "${field.key}" (${field.label}): valor em reais, número decimal (ex.: 1234.56) — NÃO em centavos. Ou null.`;
    case "date":
      return `- "${field.key}" (${field.label}): data no formato AAAA-MM-DD. Ou null.`;
    case "datetime":
      return `- "${field.key}" (${field.label}): data e hora em ISO 8601. Ou null.`;
    case "checkbox":
      return `- "${field.key}" (${field.label}): true ou false.`;
    case "number":
    case "percent":
    case "rating":
    case "duration":
      return `- "${field.key}" (${field.label}): número. Ou null.`;
    default:
      return `- "${field.key}" (${field.label}): texto curto. Ou null.`;
  }
}

/** Descrição dos campos preenchíveis, uma linha por campo — vai no prompt junto do conteúdo do item. */
export function buildFillPropertiesPrompt(fields: FieldDefinition[]): string {
  return fillableFields(fields).map(describeField).join("\n");
}

/**
 * Valida/converte o valor bruto que o Claude devolveu pro formato real de
 * `items.properties[key]` — qualquer coisa que não bata com o tipo do campo
 * vira `null` (nunca aplica um valor que não faz sentido pro campo).
 */
export function coerceFieldValue(field: FieldDefinition, raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;

  switch (field.type) {
    case "checkbox":
      return typeof raw === "boolean" ? raw : null;
    case "number":
    case "percent":
    case "rating":
    case "duration":
      return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    case "money":
      return typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw * 100) : null;
    case "date":
      return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
    case "datetime":
      return typeof raw === "string" && !Number.isNaN(Date.parse(raw)) ? raw : null;
    case "select": {
      const validIds = new Set((field.options ?? []).map((option) => option.id));
      return typeof raw === "string" && validIds.has(raw) ? raw : null;
    }
    case "multi_select": {
      const validIds = new Set((field.options ?? []).map((option) => option.id));
      if (!Array.isArray(raw)) return null;
      const filtered = raw.filter((value): value is string => typeof value === "string" && validIds.has(value));
      return filtered.length > 0 ? filtered : null;
    }
    default:
      return typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }
}

function formatDisplayValue(field: FieldDefinition, value: unknown): string {
  if (field.type === "select") return field.options?.find((option) => option.id === value)?.label ?? String(value);
  if (field.type === "multi_select" && Array.isArray(value)) {
    return value.map((id) => field.options?.find((option) => option.id === id)?.label ?? String(id)).join(", ");
  }
  if (field.type === "money" && typeof value === "number") return formatBRL(value);
  if (field.type === "checkbox") return value ? "Sim" : "Não";
  return String(value);
}

export interface FillPropertiesSuggestion {
  key: string;
  label: string;
  value: unknown;
  /** Já pronto pra mostrar na revisão — resolve `select`/`multi_select` pro texto da opção e `money` pra `formatBRL`. */
  displayValue: string;
}

/** Sugestões prontas pra revisão (6.8, "revisável antes de aplicar") — só os campos com valor coagido válido entram na lista. */
export function buildFillPropertiesSuggestions(fields: FieldDefinition[], raw: Record<string, unknown>): FillPropertiesSuggestion[] {
  const suggestions: FillPropertiesSuggestion[] = [];
  for (const field of fillableFields(fields)) {
    const value = coerceFieldValue(field, raw[field.key]);
    if (value === null) continue;
    suggestions.push({ key: field.key, label: field.label, value, displayValue: formatDisplayValue(field, value) });
  }
  return suggestions;
}
