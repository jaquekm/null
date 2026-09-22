import { z } from "zod";
import { viewFilterSchema, type ViewFilter } from "@/features/views/schemas";

/**
 * Gatilhos (`trigger`, 5.3). Escopo por tipo/espaço **não** entra aqui — já
 * existe como coluna (`automations.type_id`/`space_id`), então o motor usa
 * a própria automação pra isso em vez de duplicar `typeId`/`spaceId` dentro
 * do JSON (a tabela do enunciado lista esses campos pra `item_created`, mas
 * eles são exatamente as colunas — ver decisoes.md).
 */
export const automationTriggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("item_created") }),
  z.object({
    type: z.literal("property_changed"),
    field: z.string().min(1),
    to: z.unknown().optional(),
    from: z.unknown().optional(),
  }),
  z.object({ type: z.literal("status_changed"), to: z.string().min(1) }),
  z.object({ type: z.literal("date_reached"), field: z.string().min(1), offsetMinutes: z.number().default(0) }),
  z.object({ type: z.literal("no_activity"), days: z.number().positive() }),
  z.object({ type: z.literal("schedule"), rrule: z.string().min(1), timezone: z.string().min(1).default("America/Sao_Paulo") }),
  z.object({ type: z.literal("tag_added"), tag: z.string().min(1) }),
]);
export type AutomationTrigger = z.infer<typeof automationTriggerSchema>;
export const automationTriggerTypes = [
  "item_created",
  "property_changed",
  "status_changed",
  "date_reached",
  "no_activity",
  "schedule",
  "tag_added",
] as const;

/** Mesma estrutura de filtro das visões (1.15) — avaliada em memória contra o item, não vira SQL (ver `lib/evaluate-conditions.ts`). */
export const automationConditionsSchema = z.array(viewFilterSchema).default([]);
export type AutomationCondition = ViewFilter;

export const automationActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_property"), field: z.string().min(1), value: z.unknown() }),
  z.object({ type: z.literal("add_tag"), tag: z.string().min(1) }),
  z.object({ type: z.literal("remove_tag"), tag: z.string().min(1) }),
  z.object({ type: z.literal("move_to_space"), spaceId: z.string().uuid().nullable() }),
  z.object({
    type: z.literal("create_item"),
    typeId: z.string().uuid(),
    title: z.string().min(1),
    properties: z.record(z.string(), z.unknown()).default({}),
    linkToTrigger: z.boolean().default(false),
    parent: z.boolean().default(false),
  }),
  z.object({ type: z.literal("create_checklist"), items: z.array(z.string().min(1)).min(1) }),
  z.object({
    type: z.literal("create_reminder"),
    recipient: z.enum(["me", "contact_field"]),
    field: z.string().optional(),
    offsetMinutes: z.number().default(0),
    message: z.string().min(1),
  }),
  z.object({ type: z.literal("notify_me"), title: z.string().min(1), body: z.string().min(1) }),
  z.object({
    type: z.literal("create_bill"),
    direction: z.enum(["payable", "receivable"]),
    amountField: z.string().min(1),
    dueInDays: z.number().int(),
    contactField: z.string().optional(),
    description: z.string().min(1),
  }),
  z.object({ type: z.literal("create_review_cards") }),
  z.object({ type: z.literal("call_webhook"), url: z.string().url() }),
]);
export type AutomationAction = z.infer<typeof automationActionSchema>;
export const automationActionTypes = [
  "set_property",
  "add_tag",
  "remove_tag",
  "move_to_space",
  "create_item",
  "create_checklist",
  "create_reminder",
  "notify_me",
  "create_bill",
  "create_review_cards",
  "call_webhook",
] as const;

/** Entrada do editor `/configuracoes/automacoes` — não confundir com as colunas de `automations` (`toRow` faz a ponte). */
export const automationInputSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à automação.").max(120),
  description: z.string().trim().max(500).optional(),
  enabled: z.boolean().default(true),
  spaceId: z.string().uuid().nullable(),
  typeId: z.string().uuid().nullable(),
  trigger: automationTriggerSchema,
  conditions: automationConditionsSchema,
  actions: z.array(automationActionSchema).min(1, "Adicione ao menos uma ação."),
});
export type AutomationInput = z.infer<typeof automationInputSchema>;

/**
 * Eventos que o motor avalia contra `automations.trigger` (5.3). `item_created`
 * dispara uma vez por item; os demais carregam o que mudou. Gatilhos de
 * tempo (`date_reached`/`no_activity`/`schedule`) não passam por aqui — são
 * avaliados direto pelo job periódico (`evaluate_time_automations`).
 */
export const automationEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("item_created") }),
  z.object({ type: z.literal("property_changed"), field: z.string(), to: z.unknown(), from: z.unknown() }),
  z.object({ type: z.literal("status_changed"), to: z.string() }),
  z.object({ type: z.literal("tag_added"), tag: z.string() }),
]);
export type AutomationEvent = z.infer<typeof automationEventSchema>;

/** Payload do job `run_automations` (5.3), enfileirado por `emitItemEvent`/`emitTagAddedEvent`. */
export const runAutomationsPayloadSchema = z.object({
  event: automationEventSchema,
  // `min(1)`, não `.uuid()`: o payload é gerado internamente (`emitItemEvent`), não entrada de usuário —
  // exigir uuid só tornaria os testes de unidade artificialmente acoplados ao formato de id do Supabase.
  itemId: z.string().min(1),
  chainId: z.string().min(1),
  depth: z.number().int().min(0).default(0),
});
export type RunAutomationsPayload = z.infer<typeof runAutomationsPayloadSchema>;

/** Profundidade máxima de uma cadeia de automações disparando automações (5.3: "proteção contra laço"). */
export const MAX_AUTOMATION_CHAIN_DEPTH = 5;
