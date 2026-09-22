import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, ok, type Result } from "@/lib/result";
import type { Database } from "@/lib/supabase/database.types";
import type { PackMapping } from "./install";

type Client = SupabaseClient<Database>;

export interface PackUninstallPreview {
  installedId: string;
  packKey: string;
  version: string;
  spaceId: string | null;
  automationsCount: number;
  viewsCount: number;
  reminderRulesCount: number;
  typesWithItems: { id: string; name: string; itemCount: number }[];
  typesWithoutItems: { id: string; name: string }[];
}

async function loadInstalledPack(supabase: Client, userId: string, installedId: string) {
  const { data } = await supabase
    .from("packs_installed")
    .select("id, pack_key, version, space_id, mapping")
    .eq("id", installedId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!data) return null;
  return { ...data, mapping: (data.mapping as unknown as PackMapping) ?? { types: {}, views: {}, automations: {}, reminderRules: {} } };
}

/** Prévia do que a desinstalação (5.2, passo 7) vai remover — usada pra decidir se arquiva tipos com itens. */
export async function getPackUninstallPreview(supabase: Client, userId: string, installedId: string): Promise<PackUninstallPreview | null> {
  const row = await loadInstalledPack(supabase, userId, installedId);
  if (!row) return null;

  const typeIds = Object.values(row.mapping.types);
  const typesWithItems: PackUninstallPreview["typesWithItems"] = [];
  const typesWithoutItems: PackUninstallPreview["typesWithoutItems"] = [];

  if (typeIds.length > 0) {
    const { data: types } = await supabase.from("object_types").select("id, name").in("id", typeIds);
    for (const type of types ?? []) {
      const { count } = await supabase
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("type_id", type.id)
        .is("deleted_at", null);
      if (count && count > 0) typesWithItems.push({ id: type.id, name: type.name, itemCount: count });
      else typesWithoutItems.push({ id: type.id, name: type.name });
    }
  }

  return {
    installedId: row.id,
    packKey: row.pack_key,
    version: row.version,
    spaceId: row.space_id,
    automationsCount: Object.keys(row.mapping.automations).length,
    viewsCount: Object.keys(row.mapping.views).length,
    reminderRulesCount: Object.keys(row.mapping.reminderRules).length,
    typesWithItems,
    typesWithoutItems,
  };
}

export interface UninstallPackSummary {
  typesDeleted: number;
  typesArchived: number;
  typesKept: number;
}

/**
 * Desinstala um pack (5.2, passo 7): remove automações, visões e regras de
 * lembrete criadas por ele; tipos sem itens são excluídos, tipos com itens
 * são arquivados só se `archiveTypesWithItems` (o dono decidiu isso a
 * partir da prévia) — senão ficam como estão, sem o vínculo de instalação.
 */
export async function uninstallPack(
  supabase: Client,
  userId: string,
  installedId: string,
  archiveTypesWithItems: boolean,
): Promise<Result<UninstallPackSummary>> {
  const row = await loadInstalledPack(supabase, userId, installedId);
  if (!row) return fail("Pack instalado não encontrado.");

  const automationIds = Object.values(row.mapping.automations);
  if (automationIds.length > 0) {
    await supabase.from("automations").delete().eq("owner_id", userId).in("id", automationIds);
  }

  const reminderRuleIds = Object.values(row.mapping.reminderRules);
  if (reminderRuleIds.length > 0) {
    await supabase.from("reminder_rules").delete().eq("owner_id", userId).in("id", reminderRuleIds);
  }

  const viewIds = Object.values(row.mapping.views);
  if (viewIds.length > 0) {
    await supabase.from("views").delete().eq("owner_id", userId).in("id", viewIds);
  }

  let typesDeleted = 0;
  let typesArchived = 0;
  let typesKept = 0;
  const typeIds = Object.values(row.mapping.types);
  for (const typeId of typeIds) {
    const { count } = await supabase.from("items").select("id", { count: "exact", head: true }).eq("type_id", typeId).is("deleted_at", null);
    if (!count || count === 0) {
      const { error } = await supabase.from("object_types").delete().eq("id", typeId).eq("owner_id", userId);
      if (!error) typesDeleted += 1;
    } else if (archiveTypesWithItems) {
      const { error } = await supabase
        .from("object_types")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", typeId)
        .eq("owner_id", userId);
      if (!error) typesArchived += 1;
      else typesKept += 1;
    } else {
      typesKept += 1;
    }
  }

  const { error: deleteInstalledError } = await supabase.from("packs_installed").delete().eq("id", row.id).eq("owner_id", userId);
  if (deleteInstalledError) return fail("Não foi possível concluir a desinstalação.");

  return ok({ typesDeleted, typesArchived, typesKept });
}
