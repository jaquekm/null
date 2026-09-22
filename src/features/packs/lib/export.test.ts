import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { buildPackExport } from "./export";
import { FakeSupabase } from "@/lib/testing/fake-supabase";

const USER_ID = "user-1";

function client(fake: FakeSupabase) {
  return fake as unknown as SupabaseClient<Database>;
}

describe("buildPackExport (5.2, /configuracoes/tipos → Exportar como pack)", () => {
  it("monta um pack válido a partir de tipo, visão e automação existentes, sem vazar ids reais", async () => {
    const fake = new FakeSupabase();
    fake.seed("object_types", [
      {
        id: "type-1",
        owner_id: USER_ID,
        name: "Oportunidade",
        plural_name: "Oportunidades",
        slug: "oportunidade",
        icon: "🎯",
        color: null,
        default_view: "kanban",
        title_template: null,
        template: null,
        fields: [{ key: "stage", label: "Etapa", type: "select", required: false, options: [{ id: "novo", label: "Novo" }] }],
      },
    ]);
    fake.seed("views", [{ id: "view-1", owner_id: USER_ID, name: "Funil", kind: "kanban", type_id: "type-1", config: {}, is_default: true }]);
    fake.seed("automations", [
      {
        id: "auto-1",
        owner_id: USER_ID,
        name: "Mover pra ganho",
        description: null,
        enabled: true,
        trigger: { type: "property_changed", field: "stage", to: "won" },
        conditions: [],
        actions: [{ type: "create_item", typeId: "type-1", title: "Follow-up" }],
        type_id: "type-1",
      },
    ]);

    const result = await buildPackExport(client(fake), USER_ID, {
      key: "meu-pack",
      version: "1.0.0",
      name: "Meu pack",
      typeIds: ["type-1"],
      viewIds: ["view-1"],
      automationIds: ["auto-1"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.types).toHaveLength(1);
    expect(result.data.types[0]!.ref).toBe("oportunidade");
    expect(result.data.views[0]!.typeRef).toBe("oportunidade");
    expect(result.data.automations[0]!.typeRef).toBe("oportunidade");
    expect(JSON.stringify(result.data.automations[0]!.actions)).toContain("oportunidade");
    expect(JSON.stringify(result.data.automations[0]!.actions)).not.toContain("type-1");
  });

  it("sem tipo selecionado: erro", async () => {
    const fake = new FakeSupabase();
    const result = await buildPackExport(client(fake), USER_ID, { key: "x", version: "1.0.0", name: "X", typeIds: [], viewIds: [], automationIds: [] });
    expect(result.ok).toBe(false);
  });

  it("visão de um tipo fora da seleção não é exportada", async () => {
    const fake = new FakeSupabase();
    fake.seed("object_types", [
      {
        id: "type-1",
        owner_id: USER_ID,
        name: "Oportunidade",
        plural_name: null,
        slug: "oportunidade",
        icon: null,
        color: null,
        default_view: "list",
        title_template: null,
        template: null,
        fields: [],
      },
    ]);
    fake.seed("views", [{ id: "view-1", owner_id: USER_ID, name: "Fora", kind: "list", type_id: "type-outro", config: {}, is_default: false }]);

    const result = await buildPackExport(client(fake), USER_ID, {
      key: "meu-pack",
      version: "1.0.0",
      name: "Meu pack",
      typeIds: ["type-1"],
      viewIds: ["view-1"],
      automationIds: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.views).toEqual([]);
  });
});
