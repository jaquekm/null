import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fieldDefinitionSchema, type FieldDefinition } from "@/features/types/schemas";
import { fieldKeyFromLabel } from "@/features/types/lib/field-key";
import { fail, ok, type Result } from "@/lib/result";
import { slugify } from "@/lib/slugify";
import type { Database, Json } from "@/lib/supabase/database.types";
import { missingModules, type Pack, type PackAutomation, type PackFieldDefinition, type PackReminderRule, type PackSampleItem, type PackType, type PackView } from "../schemas";
import { resolveTypeRefs } from "./resolve-refs";

type Client = SupabaseClient<Database>;

const UNIQUE_VIOLATION = "23505";

export interface PackMapping {
  types: Record<string, string>;
  views: Record<string, string>;
  automations: Record<string, string>;
  reminderRules: Record<string, string>;
}

export function emptyPackMapping(): PackMapping {
  return { types: {}, views: {}, automations: {}, reminderRules: {} };
}

export interface InstallPackTypeOverride {
  name?: string;
  plural?: string;
  icon?: string;
  fields?: Record<string, { label?: string; options?: Record<string, string> }>;
}

export interface InstallPackOptions {
  spaceId: string | null;
  withSamples?: boolean;
  typeOverrides?: Record<string, InstallPackTypeOverride>;
}

export interface InstallPackSummary {
  updated: boolean;
  version: string;
  typesCreated: number;
  fieldsAdded: number;
  viewsCreated: number;
  automationsCreated: number;
  reminderRulesCreated: number;
  sampleItemsCreated: number;
}

function* slugCandidates(base: string) {
  yield base;
  for (let attempt = 2; attempt <= 5; attempt += 1) yield `${base}-${attempt}`;
  yield `${base}-${Date.now().toString(36)}`;
}

async function ensureType(
  supabase: Client,
  userId: string,
  packType: PackType,
  packKey: string,
  spaceId: string | null,
  existingId: string | undefined,
  override: InstallPackTypeOverride | undefined,
  position: number,
): Promise<{ id: string; created: boolean } | null> {
  if (existingId) return { id: existingId, created: false };

  const name = override?.name?.trim() || packType.name;
  const baseSlug = slugify(packType.slug || name) || `tipo-${Date.now().toString(36)}`;

  for (const slug of slugCandidates(baseSlug)) {
    const { data, error } = await supabase
      .from("object_types")
      .insert({
        owner_id: userId,
        space_id: spaceId,
        name,
        plural_name: override?.plural?.trim() || packType.plural || null,
        slug,
        icon: override?.icon?.trim() || packType.icon || null,
        color: packType.color || null,
        fields: [] as unknown as Json,
        template: (packType.template ?? null) as unknown as Json | null,
        title_template: packType.titleTemplate ?? null,
        default_view: packType.defaultView ?? "list",
        is_system: true,
        pack_key: packKey,
        position,
      })
      .select("id")
      .single();

    if (!error && data) return { id: data.id, created: true };
    if (error && error.code !== UNIQUE_VIOLATION) return null;
  }
  return null;
}

function resolveField(
  field: PackFieldDefinition,
  typeIdByRef: Record<string, string>,
  override: { label?: string; options?: Record<string, string> } | undefined,
): FieldDefinition | null {
  const relationTypeId =
    field.type === "relation" && field.relationTypeId ? (typeIdByRef[field.relationTypeId] ?? undefined) : undefined;
  if (field.type === "relation" && field.relationTypeId && !relationTypeId) return null;

  const options = field.options?.map((option) => ({
    ...option,
    label: override?.options?.[option.id]?.trim() || option.label,
  }));

  const candidate = fieldDefinitionSchema.safeParse({
    ...field,
    label: override?.label?.trim() || field.label,
    options,
    relationTypeId,
  });
  return candidate.success ? candidate.data : null;
}

/** Só adiciona campos novos (por `key`) — nunca sobrescreve um campo já instalado (5.2: preservar renomeações). */
async function syncTypeFields(supabase: Client, userId: string, typeId: string, resolvedFields: FieldDefinition[]): Promise<number> {
  const { data } = await supabase.from("object_types").select("fields").eq("id", typeId).maybeSingle();
  const existing = (data?.fields as unknown as FieldDefinition[] | null) ?? [];
  const existingKeys = new Set(existing.map((field) => field.key));
  const newFields = resolvedFields.filter((field) => !existingKeys.has(field.key));
  if (newFields.length === 0) return 0;

  const { error } = await supabase
    .from("object_types")
    .update({ fields: [...existing, ...newFields] as unknown as Json })
    .eq("id", typeId)
    .eq("owner_id", userId);
  if (error) return 0;
  return newFields.length;
}

async function ensureView(
  supabase: Client,
  userId: string,
  packView: PackView,
  spaceId: string | null,
  typeIdByRef: Record<string, string>,
  existingId: string | undefined,
): Promise<{ id: string; created: boolean } | null> {
  if (existingId) return { id: existingId, created: false };
  const typeId = typeIdByRef[packView.typeRef];
  if (!typeId) return null;

  if (packView.isDefault) {
    let unset = supabase.from("views").update({ is_default: false }).eq("owner_id", userId).eq("type_id", typeId);
    unset = spaceId ? unset.eq("space_id", spaceId) : unset.is("space_id", null);
    await unset;
  }

  const { data, error } = await supabase
    .from("views")
    .insert({
      owner_id: userId,
      space_id: spaceId,
      type_id: typeId,
      name: packView.name,
      kind: packView.kind,
      config: packView.config as unknown as Json,
      is_default: packView.isDefault,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return { id: data.id, created: true };
}

async function ensureAutomation(
  supabase: Client,
  userId: string,
  packKey: string,
  automation: PackAutomation,
  spaceId: string | null,
  typeIdByRef: Record<string, string>,
  existingId: string | undefined,
): Promise<{ id: string; created: boolean } | null> {
  if (existingId) return { id: existingId, created: false };

  const { data, error } = await supabase
    .from("automations")
    .insert({
      owner_id: userId,
      name: automation.name,
      description: automation.description ?? null,
      enabled: automation.enabled,
      trigger: resolveTypeRefs(automation.trigger, typeIdByRef) as unknown as Json,
      conditions: resolveTypeRefs(automation.conditions, typeIdByRef) as unknown as Json,
      actions: resolveTypeRefs(automation.actions, typeIdByRef) as unknown as Json,
      space_id: spaceId,
      type_id: automation.typeRef ? (typeIdByRef[automation.typeRef] ?? null) : null,
      pack_key: packKey,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return { id: data.id, created: true };
}

async function ensureReminderRule(
  supabase: Client,
  userId: string,
  rule: PackReminderRule,
  typeIdByRef: Record<string, string>,
  existingId: string | undefined,
): Promise<{ id: string; created: boolean } | null> {
  if (existingId) return { id: existingId, created: false };

  const { data, error } = await supabase
    .from("reminder_rules")
    .insert({
      owner_id: userId,
      name: rule.name,
      kind: rule.kind,
      config: resolveTypeRefs(rule.config, typeIdByRef) as unknown as Json,
      channel: rule.channel,
      recipient_type: rule.recipientType,
      message_template: rule.messageTemplate,
      enabled: rule.enabled,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return { id: data.id, created: true };
}

async function createSampleItems(
  supabase: Client,
  userId: string,
  spaceId: string | null,
  samples: PackSampleItem[],
  typeIdByRef: Record<string, string>,
): Promise<number> {
  let created = 0;
  for (const sample of samples) {
    const typeId = typeIdByRef[sample.typeRef];
    if (!typeId) continue;
    const { error } = await supabase.from("items").insert({
      owner_id: userId,
      space_id: spaceId,
      type_id: typeId,
      title: sample.title,
      status: "active",
      properties: sample.properties as unknown as Json,
    });
    if (!error) created += 1;
  }
  return created;
}

/**
 * Instalador de packs (5.2), idempotente: reinstalar/atualizar não recria o
 * que já existe (mapeado em `packs_installed.mapping` por `ref`) nem
 * sobrescreve personalizações — só adiciona o que falta (tipos, campos,
 * visões, automações e regras de lembrete novos na versão instalada).
 */
export async function installPack(supabase: Client, userId: string, pack: Pack, options: InstallPackOptions): Promise<Result<InstallPackSummary>> {
  const { data: settings } = await supabase.from("user_settings").select("modules").eq("owner_id", userId).maybeSingle();
  const modules = (settings?.modules as Record<string, unknown> | null) ?? {};
  const missing = missingModules(pack.requires, modules);
  if (missing.length > 0) {
    return fail(`Ative primeiro em Configurações: ${missing.join(", ")}.`);
  }

  let existingQuery = supabase.from("packs_installed").select("id, mapping, version").eq("owner_id", userId).eq("pack_key", pack.key);
  existingQuery = options.spaceId ? existingQuery.eq("space_id", options.spaceId) : existingQuery.is("space_id", null);
  const { data: existingRow } = await existingQuery.maybeSingle();

  const mapping: PackMapping = (existingRow?.mapping as unknown as PackMapping | null) ?? emptyPackMapping();

  const { data: lastType } = await supabase
    .from("object_types")
    .select("position")
    .eq("owner_id", userId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextPosition = (lastType?.position ?? -1) + 1;

  let typesCreated = 0;
  const typeIdByRef: Record<string, string> = {};
  for (const packType of pack.types) {
    const result = await ensureType(
      supabase,
      userId,
      packType,
      pack.key,
      options.spaceId,
      mapping.types[packType.ref],
      options.typeOverrides?.[packType.ref],
      nextPosition,
    );
    if (!result) return fail(`Não foi possível criar o tipo "${packType.name}".`);
    typeIdByRef[packType.ref] = result.id;
    mapping.types[packType.ref] = result.id;
    if (result.created) {
      typesCreated += 1;
      nextPosition += 1;
    }
  }

  let fieldsAdded = 0;
  for (const packType of pack.types) {
    const typeId = typeIdByRef[packType.ref]!;
    const fieldOverrides = options.typeOverrides?.[packType.ref]?.fields;
    const resolvedFields: FieldDefinition[] = [];
    for (const field of packType.fields) {
      const resolved = resolveField(field, typeIdByRef, fieldOverrides?.[field.key]);
      if (resolved) resolvedFields.push(resolved);
    }
    fieldsAdded += await syncTypeFields(supabase, userId, typeId, resolvedFields);
  }

  let viewsCreated = 0;
  for (const packView of pack.views) {
    const result = await ensureView(supabase, userId, packView, options.spaceId, typeIdByRef, mapping.views[packView.ref]);
    if (result) {
      mapping.views[packView.ref] = result.id;
      if (result.created) viewsCreated += 1;
    }
  }

  let automationsCreated = 0;
  for (const [index, automation] of pack.automations.entries()) {
    const ref = automation.ref ?? (fieldKeyFromLabel(automation.name) || `automacao_${index}`);
    const result = await ensureAutomation(supabase, userId, pack.key, automation, options.spaceId, typeIdByRef, mapping.automations[ref]);
    if (result) {
      mapping.automations[ref] = result.id;
      if (result.created) automationsCreated += 1;
    }
  }

  let reminderRulesCreated = 0;
  for (const [index, rule] of pack.reminderRules.entries()) {
    const ref = rule.ref ?? (fieldKeyFromLabel(rule.name) || `lembrete_${index}`);
    const result = await ensureReminderRule(supabase, userId, rule, typeIdByRef, mapping.reminderRules[ref]);
    if (result) {
      mapping.reminderRules[ref] = result.id;
      if (result.created) reminderRulesCreated += 1;
    }
  }

  const sampleItemsCreated = options.withSamples ? await createSampleItems(supabase, userId, options.spaceId, pack.sampleItems, typeIdByRef) : 0;

  if (existingRow) {
    const { error } = await supabase
      .from("packs_installed")
      .update({ version: pack.version, mapping: mapping as unknown as Json, installed_at: new Date().toISOString() })
      .eq("id", existingRow.id)
      .eq("owner_id", userId);
    if (error) return fail("Pack instalado, mas não foi possível atualizar o registro de instalação.");
  } else {
    const { error } = await supabase.from("packs_installed").insert({
      owner_id: userId,
      pack_key: pack.key,
      version: pack.version,
      space_id: options.spaceId,
      mapping: mapping as unknown as Json,
    });
    if (error) return fail("Pack instalado, mas não foi possível salvar o registro de instalação.");
  }

  return ok({
    updated: Boolean(existingRow),
    version: pack.version,
    typesCreated,
    fieldsAdded,
    viewsCreated,
    automationsCreated,
    reminderRulesCreated,
    sampleItemsCreated,
  });
}
