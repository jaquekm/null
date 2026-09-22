import "server-only";
import { randomUUID } from "node:crypto";
import { enqueueJob } from "@/lib/jobs/enqueue";
import type { AutomationEvent } from "../schemas";

export interface ItemEventSnapshot {
  status: string;
  properties: Record<string, unknown>;
}

export interface EmitItemEventInput {
  ownerId: string;
  itemId: string;
  /** `null` = item recém-criado. */
  before: ItemEventSnapshot | null;
  after: ItemEventSnapshot;
  /** Presentes quando este evento foi causado por uma ação de automação (proteção contra laço, 5.3). */
  chainId?: string;
  depth?: number;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function diffEvents(before: ItemEventSnapshot | null, after: ItemEventSnapshot): AutomationEvent[] {
  if (!before) return [{ type: "item_created" }];

  const events: AutomationEvent[] = [];
  if (before.status !== after.status) {
    events.push({ type: "status_changed", to: after.status });
  }

  const keys = new Set([...Object.keys(before.properties ?? {}), ...Object.keys(after.properties ?? {})]);
  for (const key of keys) {
    const from = before.properties?.[key];
    const to = after.properties?.[key];
    if (!valuesEqual(from, to)) {
      events.push({ type: "property_changed", field: key, to, from });
    }
  }

  return events;
}

/**
 * Detecta eventos de item (5.3: `item_created`/`property_changed`/
 * `status_changed`) comparando antes/depois e enfileira um job
 * `run_automations` por evento — a camada de server actions chama isto
 * depois de gravar a mudança; a execução em si acontece depois, no job (não
 * bloqueia quem chamou).
 */
export async function emitItemEvent(input: EmitItemEventInput): Promise<void> {
  const events = diffEvents(input.before, input.after);
  if (events.length === 0) return;

  const chainId = input.chainId ?? randomUUID();
  const depth = input.depth ?? 0;

  for (const event of events) {
    await enqueueJob({
      ownerId: input.ownerId,
      kind: "run_automations",
      payload: { event, itemId: input.itemId, chainId, depth },
    });
  }
}

/** `tag_added` (5.3) não é um diff de propriedades — a tag some do item mudando linha em `item_tags`, não em `items`. */
export async function emitTagAddedEvent(input: {
  ownerId: string;
  itemId: string;
  tag: string;
  chainId?: string;
  depth?: number;
}): Promise<void> {
  await enqueueJob({
    ownerId: input.ownerId,
    kind: "run_automations",
    payload: {
      event: { type: "tag_added", tag: input.tag },
      itemId: input.itemId,
      chainId: input.chainId ?? randomUUID(),
      depth: input.depth ?? 0,
    },
  });
}
