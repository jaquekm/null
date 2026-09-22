import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fieldKeyFromLabel } from "@/features/types/lib/field-key";
import type { FieldDefinition } from "@/features/types/schemas";
import { parseViewConfig } from "@/features/views/schemas";
import { fail, ok, type Result } from "@/lib/result";
import type { Database } from "@/lib/supabase/database.types";
import { packSchema, type Pack, type PackAutomation, type PackType, type PackView } from "../schemas";
import { invertTypeRefs } from "./resolve-refs";

type Client = SupabaseClient<Database>;

export interface ExportPackInput {
  key: string;
  version: string;
  name: string;
  description?: string;
  icon?: string;
  typeIds: string[];
  viewIds: string[];
  automationIds: string[];
}

function uniqueRef(base: string, taken: Set<string>): string {
  const safeBase = base || "ref";
  if (!taken.has(safeBase)) return safeBase;
  let suffix = 2;
  while (taken.has(`${safeBase}_${suffix}`)) suffix += 1;
  return `${safeBase}_${suffix}`;
}

/**
 * "Exportar como pack" (5.2, `/configuracoes/tipos`): monta um `Pack` a
 * partir de tipos/visões/automações já existentes, trocando ids reais por
 * `ref`s internas (inverso da instalação — ver `resolve-refs.ts`).
 */
export async function buildPackExport(supabase: Client, userId: string, input: ExportPackInput): Promise<Result<Pack>> {
  if (input.typeIds.length === 0) return fail("Selecione ao menos um tipo pra exportar.");

  const { data: types, error: typesError } = await supabase
    .from("object_types")
    .select("id, name, plural_name, slug, icon, color, default_view, title_template, template, fields")
    .eq("owner_id", userId)
    .in("id", input.typeIds);
  if (typesError || !types || types.length !== input.typeIds.length) {
    return fail("Não foi possível carregar os tipos selecionados.");
  }

  const refById: Record<string, string> = {};
  const takenTypeRefs = new Set<string>();
  for (const type of types) {
    const ref = uniqueRef(fieldKeyFromLabel(type.name), takenTypeRefs);
    takenTypeRefs.add(ref);
    refById[type.id] = ref;
  }

  const packTypes: PackType[] = types.map((type) => ({
    ref: refById[type.id]!,
    name: type.name,
    plural: type.plural_name ?? undefined,
    slug: type.slug,
    icon: type.icon ?? undefined,
    color: type.color ?? undefined,
    defaultView: (type.default_view as PackType["defaultView"]) ?? undefined,
    fields: (((type.fields as unknown as FieldDefinition[] | null) ?? []) as FieldDefinition[]).map((field) => ({
      ...field,
      relationTypeId: field.relationTypeId ? (refById[field.relationTypeId] ?? field.relationTypeId) : undefined,
    })),
    template: (type.template ?? undefined) as PackType["template"],
    titleTemplate: type.title_template ?? undefined,
  }));

  const packViews: PackView[] = [];
  if (input.viewIds.length > 0) {
    const { data: views, error: viewsError } = await supabase
      .from("views")
      .select("id, name, kind, type_id, config, is_default")
      .eq("owner_id", userId)
      .in("id", input.viewIds);
    if (viewsError || !views) return fail("Não foi possível carregar as visões selecionadas.");

    const takenViewRefs = new Set<string>();
    for (const view of views) {
      const typeRef = view.type_id ? refById[view.type_id] : undefined;
      if (!typeRef) continue;
      const ref = uniqueRef(fieldKeyFromLabel(view.name), takenViewRefs);
      takenViewRefs.add(ref);
      packViews.push({
        ref,
        typeRef,
        name: view.name,
        kind: view.kind as PackView["kind"],
        config: parseViewConfig(view.config),
        isDefault: view.is_default,
      });
    }
  }

  const packAutomations: PackAutomation[] = [];
  if (input.automationIds.length > 0) {
    const { data: automations, error: automationsError } = await supabase
      .from("automations")
      .select("id, name, description, enabled, trigger, conditions, actions, type_id")
      .eq("owner_id", userId)
      .in("id", input.automationIds);
    if (automationsError || !automations) return fail("Não foi possível carregar as automações selecionadas.");

    const takenAutomationRefs = new Set<string>();
    for (const automation of automations) {
      const ref = uniqueRef(fieldKeyFromLabel(automation.name), takenAutomationRefs);
      takenAutomationRefs.add(ref);
      packAutomations.push({
        ref,
        typeRef: automation.type_id ? refById[automation.type_id] : undefined,
        name: automation.name,
        description: automation.description ?? undefined,
        enabled: automation.enabled,
        trigger: invertTypeRefs((automation.trigger as Record<string, unknown>) ?? {}, refById),
        conditions: invertTypeRefs(((automation.conditions as Record<string, unknown>[] | null) ?? []), refById),
        actions: invertTypeRefs(((automation.actions as Record<string, unknown>[] | null) ?? []), refById),
      });
    }
  }

  const candidate = packSchema.safeParse({
    key: input.key,
    version: input.version,
    name: input.name,
    description: input.description,
    icon: input.icon,
    requires: [],
    types: packTypes,
    views: packViews,
    automations: packAutomations,
    reminderRules: [],
    sampleItems: [],
  });
  if (!candidate.success) return fail(candidate.error.issues[0]?.message ?? "Não foi possível montar o pack.");

  return ok(candidate.data);
}
