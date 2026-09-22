const TODAY_OFFSET_REGEX = /^\{\{today([+-]\d+)d\}\}$/;
const TODAY_FIELD_OFFSET_REGEX = /^\{\{today\+([a-zA-Z][a-zA-Z0-9_]*)d\}\}$/;
const FIELD_TOKEN_REGEX = /\{\{([a-zA-Z0-9_]+)\}\}/g;

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface TemplateItemContext {
  title: string;
  properties: Record<string, unknown>;
}

/**
 * Resolve `{{today}}`/`{{today+7d}}` (5.3: valor de `set_property`), a
 * variante `{{today+<campo>d}}` (5.10: deslocamento em dias vindo de um
 * campo numérico do próprio item — ex.: "revisar de novo daqui a
 * `review_every_days` dias") e, pra strings livres como o título de
 * `create_item`, `{{campo}}`/`{{title}}` interpolados a partir do item que
 * disparou a automação. Valores que não são string (número, boolean, array
 * de `set_property` com valor fixo) passam intactos — só texto é template.
 */
export function resolveTemplateValue(value: unknown, context: { today: Date; item?: TemplateItemContext }): unknown {
  if (typeof value !== "string") return value;

  if (value === "{{today}}") return toDateOnly(context.today);

  const offsetMatch = TODAY_OFFSET_REGEX.exec(value);
  if (offsetMatch) {
    const days = Number(offsetMatch[1]);
    const shifted = new Date(context.today);
    shifted.setDate(shifted.getDate() + days);
    return toDateOnly(shifted);
  }

  const fieldOffsetMatch = TODAY_FIELD_OFFSET_REGEX.exec(value);
  if (fieldOffsetMatch) {
    const fieldKey = fieldOffsetMatch[1]!;
    const rawDays = context.item?.properties[fieldKey];
    const days = typeof rawDays === "number" ? rawDays : Number(rawDays);
    if (!Number.isFinite(days)) return value;
    const shifted = new Date(context.today);
    shifted.setDate(shifted.getDate() + days);
    return toDateOnly(shifted);
  }

  if (!context.item) return value;

  return value.replace(FIELD_TOKEN_REGEX, (match, key: string) => {
    if (key === "title") return context.item!.title;
    const fieldValue = context.item!.properties[key];
    return fieldValue === undefined || fieldValue === null ? match : String(fieldValue);
  });
}
