import type { AutomationEvent, AutomationTrigger } from "../schemas";

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * O evento (`emitItemEvent`) bate com o gatilho declarado (5.3)? Só compara
 * o formato do gatilho — escopo por tipo/espaço é responsabilidade de quem
 * chama (`automations.type_id`/`space_id`, ver schemas.ts).
 */
export function matchesTrigger(trigger: AutomationTrigger, event: AutomationEvent): boolean {
  if (trigger.type !== event.type) return false;

  switch (event.type) {
    case "item_created":
      return true;
    case "property_changed": {
      const t = trigger as Extract<AutomationTrigger, { type: "property_changed" }>;
      if (t.field !== event.field) return false;
      if (t.to !== undefined && !valuesEqual(t.to, event.to)) return false;
      if (t.from !== undefined && !valuesEqual(t.from, event.from)) return false;
      return true;
    }
    case "status_changed": {
      const t = trigger as Extract<AutomationTrigger, { type: "status_changed" }>;
      return t.to === event.to;
    }
    case "tag_added": {
      const t = trigger as Extract<AutomationTrigger, { type: "tag_added" }>;
      return t.tag === event.tag;
    }
    default: {
      const exhaustive: never = event;
      throw new Error(`Evento desconhecido: ${String(exhaustive)}`);
    }
  }
}

export interface AutomationScope {
  typeId: string | null;
  spaceId: string | null;
}

/** `automations.type_id`/`space_id` nulos = "qualquer" (sem escopo); preenchidos precisam bater com o item. */
export function scopeMatches(automation: AutomationScope, item: AutomationScope): boolean {
  if (automation.typeId && automation.typeId !== item.typeId) return false;
  if (automation.spaceId && automation.spaceId !== item.spaceId) return false;
  return true;
}
