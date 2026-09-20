import { ITEM_DATE_COLOR, type AgendaEntry } from "./agenda-entry";

export interface DateFieldDef {
  key: string;
  label: string;
  type: "date" | "datetime";
}

export interface ItemForDateExtraction {
  id: string;
  title: string;
  type_id: string | null;
  properties: Record<string, unknown> | null;
}

/**
 * Itens com campo `date`/`datetime` (3.6, ex.: prazo de tarefa) → `AgendaEntry`.
 * Um item pode ter mais de um campo de data no tipo — cada valor preenchido
 * vira uma entrada própria. `date` (sem hora) vira um bloco de dia inteiro à
 * meia-noite UTC (mesma convenção do mapeamento de eventos do Google, 3.5) —
 * sem tentar converter pro fuso do dono, já que a exibição por `allDay`
 * (não pelo instante exato) resolve isso.
 */
export function extractItemDateEntries(
  items: ItemForDateExtraction[],
  dateFieldsByTypeId: Map<string, DateFieldDef[]>,
  rangeStartIso: string,
  rangeEndIso: string,
): AgendaEntry[] {
  const entries: AgendaEntry[] = [];
  const rangeStart = new Date(rangeStartIso).getTime();
  const rangeEnd = new Date(rangeEndIso).getTime();

  for (const item of items) {
    if (!item.type_id) continue;
    const fields = dateFieldsByTypeId.get(item.type_id);
    if (!fields || fields.length === 0) continue;
    const properties = item.properties ?? {};

    for (const field of fields) {
      const rawValue = properties[field.key];
      if (typeof rawValue !== "string" || !rawValue) continue;

      const allDay = field.type === "date";
      const startIso = allDay ? `${rawValue}T00:00:00.000Z` : new Date(rawValue).toISOString();
      const startMs = new Date(startIso).getTime();
      if (Number.isNaN(startMs) || startMs < rangeStart || startMs >= rangeEnd) continue;

      entries.push({
        id: `item:${item.id}:${field.key}`,
        title: `${field.label}: ${item.title}`,
        start: startIso,
        end: allDay ? new Date(startMs + 24 * 60 * 60 * 1000).toISOString() : null,
        allDay,
        color: ITEM_DATE_COLOR,
        editable: false,
        kind: "item-date",
        href: `/itens/${item.id}`,
      });
    }
  }

  return entries;
}
