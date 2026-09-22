import { z } from "zod";
import { viewKinds as objectTypeViewKinds } from "@/features/types/object-type-schemas";
import { fieldDefinitionSchema } from "@/features/types/schemas";
import { viewConfigSchema } from "@/features/views/schemas";

/**
 * Referência interna de um pack (5.2) — usada pra resolver `relationTypeId`,
 * `typeRef` de visões/automações etc. dentro do próprio JSON, antes de
 * existirem ids reais.
 */
export const packRefSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z][a-z0-9_-]*$/, "Referência deve começar com letra minúscula e usar apenas letras, números, `_` ou `-`.");

/**
 * Mesmo `fieldDefinitionSchema` de `features/types/schemas.ts`, mas com
 * `relationTypeId` aceitando a `ref` de outro tipo do mesmo pack (resolvida
 * pra um uuid de verdade pelo instalador) em vez de exigir um uuid já.
 */
export const packFieldDefinitionSchema = fieldDefinitionSchema
  .omit({ relationTypeId: true, rollupRelationTypeId: true })
  .extend({
    relationTypeId: z.string().trim().min(1).optional(),
    /** Mesma ideia de `relationTypeId` acima, pro tipo escaneado por um campo `rollup` (5.8). */
    rollupRelationTypeId: z.string().trim().min(1).optional(),
  });
export type PackFieldDefinition = z.infer<typeof packFieldDefinitionSchema>;

const tiptapDocSchema = z.object({ type: z.string() }).passthrough();

export const packTypeSchema = z.object({
  ref: packRefSchema,
  name: z.string().trim().min(1),
  plural: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  icon: z.string().trim().max(8).optional(),
  color: z.string().trim().max(30).optional(),
  defaultView: z.enum(objectTypeViewKinds).optional(),
  fields: z.array(packFieldDefinitionSchema).default([]),
  template: tiptapDocSchema.nullable().optional(),
  titleTemplate: z.string().trim().max(200).nullable().optional(),
  /**
   * Em vez de criar um tipo novo, anexa os `fields` deste bloco a um tipo de
   * sistema já existente com este slug (ex.: `"tarefa"`, `"documento"` — os
   * tipos globais criados no onboarding, `features/onboarding/lib/system-types.ts`).
   * "Estender o tipo básico" (5.8 Tarefa, 5.10 SOP/Documento): mesma regra de
   * só somar campos novos (`syncTypeFields`, nunca sobrescrever), e nunca
   * excluído/arquivado ao desinstalar o pack (`uninstall.ts`).
   */
  extendsSlug: z.string().trim().min(1).optional(),
});
export type PackType = z.infer<typeof packTypeSchema>;

/**
 * Espaço criado pelo pack (5.11: PARA — "cria espaços... Projetos, Áreas,
 * Recursos, Arquivo"). Idempotente por `slug` (`ensureSpace`, `install.ts`)
 * — igual `extendsSlug` de tipo, reaproveita um espaço já existente com o
 * mesmo slug em vez de duplicar.
 */
export const packSpaceSchema = z.object({
  ref: packRefSchema,
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).optional(),
  icon: z.string().trim().max(8).optional(),
  color: z.string().trim().max(30).optional(),
});
export type PackSpace = z.infer<typeof packSpaceSchema>;

export const packViewSchema = z.object({
  ref: packRefSchema,
  typeRef: packRefSchema,
  name: z.string().trim().min(1),
  kind: z.enum(objectTypeViewKinds),
  config: viewConfigSchema.default({ filters: [], sort: [] }),
  isDefault: z.boolean().default(false),
});
export type PackView = z.infer<typeof packViewSchema>;

/**
 * `trigger`/`conditions`/`actions` só são validados como JSON aqui — o
 * formato detalhado de cada gatilho/ação (tabela da 5.3) pertence ao motor
 * de automações, ainda não implementado. `features/packs` só precisa saber
 * gravar o JSON em `automations` resolvendo `typeRef` → `typeId` (ver
 * `lib/resolve-refs.ts`), em qualquer profundidade.
 */
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const packAutomationSchema = z.object({
  ref: packRefSchema.optional(),
  typeRef: packRefSchema.optional(),
  /**
   * Alternativa a `typeRef` pra mirar num tipo de **outro** pack ou de
   * sistema, pelo `slug` (5.11: "Projeto concluído → mover pra Arquivo" mira
   * o tipo Projeto do pack Projetos, 5.8 — um pack não resolve `ref` de
   * outro). Resolvido em `install.ts` por busca direta (`findTypeBySlug`);
   * se o tipo ainda não existir (pack dependente não instalado), a
   * automação **não é criada** nesta instalação — não fica órfã/sem escopo.
   */
  typeSlug: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  enabled: z.boolean().default(true),
  trigger: jsonObjectSchema,
  conditions: z.array(jsonObjectSchema).default([]),
  actions: z.array(jsonObjectSchema).min(1),
});
export type PackAutomation = z.infer<typeof packAutomationSchema>;

export const reminderRuleKinds = ["event_before", "birthday", "bill_due", "item_date_field", "split_open"] as const;

export const packReminderRuleSchema = z.object({
  ref: packRefSchema.optional(),
  name: z.string().trim().min(1),
  kind: z.enum(reminderRuleKinds),
  config: jsonObjectSchema.default({}),
  channel: z.string().trim().min(1).default("auto"),
  recipientType: z.string().trim().min(1).default("contacts"),
  messageTemplate: z.string().trim().min(1),
  enabled: z.boolean().default(true),
});
export type PackReminderRule = z.infer<typeof packReminderRuleSchema>;

export const packSampleItemSchema = z.object({
  typeRef: packRefSchema,
  title: z.string().trim().min(1),
  properties: z.record(z.string(), z.unknown()).default({}),
  /** Conteúdo Tiptap do exemplo (5.9: templates de lista com itens pré-preenchidos, ex. "Compras do mês"). */
  content: tiptapDocSchema.nullable().optional(),
});
export type PackSampleItem = z.infer<typeof packSampleItemSchema>;

export const packSchema = z
  .object({
    key: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9-]*$/, "Chave do pack deve começar com letra minúscula e usar apenas letras, números ou `-`."),
    version: z.string().trim().regex(/^\d+\.\d+\.\d+$/, "Versão deve seguir semver (ex.: 1.0.0)."),
    name: z.string().trim().min(1),
    description: z.string().trim().optional(),
    icon: z.string().trim().max(8).optional(),
    requires: z.array(z.string().trim().min(1)).default([]),
    types: z.array(packTypeSchema).min(1),
    spaces: z.array(packSpaceSchema).default([]),
    views: z.array(packViewSchema).default([]),
    automations: z.array(packAutomationSchema).default([]),
    reminderRules: z.array(packReminderRuleSchema).default([]),
    sampleItems: z.array(packSampleItemSchema).default([]),
  })
  .superRefine((pack, ctx) => {
    const typeRefs = new Set<string>();
    pack.types.forEach((type, index) => {
      if (typeRefs.has(type.ref)) {
        ctx.addIssue({ code: "custom", message: `Ref de tipo duplicada: "${type.ref}".`, path: ["types", index, "ref"] });
      }
      typeRefs.add(type.ref);
    });

    const checkTypeRef = (ref: string, path: (string | number)[]) => {
      if (!typeRefs.has(ref)) {
        ctx.addIssue({ code: "custom", message: `Tipo "${ref}" não existe neste pack.`, path });
      }
    };

    const spaceRefs = new Set<string>();
    pack.spaces.forEach((space, index) => {
      if (spaceRefs.has(space.ref)) {
        ctx.addIssue({ code: "custom", message: `Ref de espaço duplicada: "${space.ref}".`, path: ["spaces", index, "ref"] });
      }
      spaceRefs.add(space.ref);
    });

    const viewRefs = new Set<string>();
    pack.views.forEach((view, index) => {
      if (viewRefs.has(view.ref)) {
        ctx.addIssue({ code: "custom", message: `Ref de visão duplicada: "${view.ref}".`, path: ["views", index, "ref"] });
      }
      viewRefs.add(view.ref);
      checkTypeRef(view.typeRef, ["views", index, "typeRef"]);
    });

    pack.types.forEach((type, typeIndex) => {
      type.fields.forEach((field, fieldIndex) => {
        if (field.type === "relation" && field.relationTypeId && !typeRefs.has(field.relationTypeId)) {
          ctx.addIssue({
            code: "custom",
            message: `Campo de relação aponta pra um tipo "${field.relationTypeId}" que não existe neste pack.`,
            path: ["types", typeIndex, "fields", fieldIndex, "relationTypeId"],
          });
        }
        if (field.type === "rollup" && field.rollupRelationTypeId && !typeRefs.has(field.rollupRelationTypeId)) {
          ctx.addIssue({
            code: "custom",
            message: `Campo rollup aponta pra um tipo "${field.rollupRelationTypeId}" que não existe neste pack.`,
            path: ["types", typeIndex, "fields", fieldIndex, "rollupRelationTypeId"],
          });
        }
      });
    });

    pack.automations.forEach((automation, index) => {
      if (automation.typeRef) checkTypeRef(automation.typeRef, ["automations", index, "typeRef"]);
    });

    pack.sampleItems.forEach((sample, index) => {
      checkTypeRef(sample.typeRef, ["sampleItems", index, "typeRef"]);
    });
  });
export type Pack = z.infer<typeof packSchema>;

/** Chaves de `user_settings.modules` que podem estar desligadas (decisoes.md). As demais em `requires` são módulos-núcleo, sempre disponíveis. */
export const TOGGLEABLE_MODULES = ["finance", "ai", "messaging"] as const;
export type ToggleableModule = (typeof TOGGLEABLE_MODULES)[number];

function isToggleableModule(value: string): value is ToggleableModule {
  return (TOGGLEABLE_MODULES as readonly string[]).includes(value);
}

/** Módulos de `pack.requires` que estão desligados nas configurações do dono e bloqueiam a instalação. */
export function missingModules(requires: string[], modules: Record<string, unknown>): string[] {
  return requires.filter((key) => isToggleableModule(key) && modules[key] !== true);
}
