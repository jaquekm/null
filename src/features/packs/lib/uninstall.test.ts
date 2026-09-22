import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { FakeSupabase } from "./fake-supabase";
import type { PackMapping } from "./install";
import { getPackUninstallPreview, uninstallPack } from "./uninstall";

const USER_ID = "user-1";

function client(fake: FakeSupabase) {
  return fake as unknown as SupabaseClient<Database>;
}

function seedInstalledPack(fake: FakeSupabase, mapping: PackMapping) {
  fake.seed("packs_installed", [{ id: "installed-1", owner_id: USER_ID, pack_key: "crm", version: "1.0.0", space_id: null, mapping }]);
}

describe("uninstallPack (5.2, passo 7)", () => {
  it("remove automações, visões e regras de lembrete; exclui tipo sem itens", async () => {
    const fake = new FakeSupabase();
    fake.seed("object_types", [{ id: "type-1", owner_id: USER_ID, name: "Oportunidade" }]);
    fake.seed("views", [{ id: "view-1", owner_id: USER_ID }]);
    fake.seed("automations", [{ id: "auto-1", owner_id: USER_ID }]);
    fake.seed("reminder_rules", [{ id: "rule-1", owner_id: USER_ID }]);
    seedInstalledPack(fake, {
      types: { opportunity: "type-1" },
      views: { pipeline: "view-1" },
      automations: { mover_ganho: "auto-1" },
      reminderRules: { follow_up: "rule-1" },
    });

    const preview = await getPackUninstallPreview(client(fake), USER_ID, "installed-1");
    expect(preview).not.toBeNull();
    expect(preview!.typesWithoutItems).toEqual([{ id: "type-1", name: "Oportunidade" }]);
    expect(preview!.typesWithItems).toEqual([]);
    expect(preview!.automationsCount).toBe(1);
    expect(preview!.viewsCount).toBe(1);
    expect(preview!.reminderRulesCount).toBe(1);

    const result = await uninstallPack(client(fake), USER_ID, "installed-1", false);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ typesDeleted: 1, typesArchived: 0, typesKept: 0 });

    expect(fake.rowsOf("automations")).toHaveLength(0);
    expect(fake.rowsOf("views")).toHaveLength(0);
    expect(fake.rowsOf("reminder_rules")).toHaveLength(0);
    expect(fake.rowsOf("object_types")).toHaveLength(0);
    expect(fake.rowsOf("packs_installed")).toHaveLength(0);
  });

  it("tipo com itens: fica como está por padrão, só arquiva se o dono pedir", async () => {
    const fake = new FakeSupabase();
    fake.seed("object_types", [{ id: "type-1", owner_id: USER_ID, name: "Oportunidade", archived_at: null }]);
    fake.seed("items", [{ id: "item-1", type_id: "type-1", deleted_at: null }]);
    seedInstalledPack(fake, { types: { opportunity: "type-1" }, views: {}, automations: {}, reminderRules: {} });

    const preview = await getPackUninstallPreview(client(fake), USER_ID, "installed-1");
    expect(preview!.typesWithItems).toEqual([{ id: "type-1", name: "Oportunidade", itemCount: 1 }]);

    const kept = await uninstallPack(client(fake), USER_ID, "installed-1", false);
    expect(kept.ok).toBe(true);
    if (kept.ok) expect(kept.data).toEqual({ typesDeleted: 0, typesArchived: 0, typesKept: 1 });
    expect(fake.rowsOf("object_types")).toHaveLength(1);
    expect(fake.rowsOf("object_types")[0]!.archived_at).toBeNull();

    seedInstalledPack(fake, { types: { opportunity: "type-1" }, views: {}, automations: {}, reminderRules: {} });
    const archived = await uninstallPack(client(fake), USER_ID, "installed-1", true);
    expect(archived.ok).toBe(true);
    if (archived.ok) expect(archived.data).toEqual({ typesDeleted: 0, typesArchived: 1, typesKept: 0 });
    expect(fake.rowsOf("object_types")[0]!.archived_at).not.toBeNull();
  });

  it("pack instalado inexistente: erro", async () => {
    const fake = new FakeSupabase();
    const result = await uninstallPack(client(fake), USER_ID, "nao-existe", false);
    expect(result.ok).toBe(false);
  });
});
