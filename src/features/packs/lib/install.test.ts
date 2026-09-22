import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { packSchema, type Pack } from "../schemas";
import { FakeSupabase } from "@/lib/testing/fake-supabase";
import { installPack, type InstallPackOptions } from "./install";

const USER_ID = "user-1";

function client(fake: FakeSupabase) {
  return fake as unknown as SupabaseClient<Database>;
}

function buildPack(overrides: Record<string, unknown> = {}): Pack {
  const parsed = packSchema.safeParse({
    key: "crm",
    version: "1.0.0",
    name: "Vendas (CRM)",
    requires: [],
    types: [
      {
        ref: "opportunity",
        name: "Oportunidade",
        icon: "🎯",
        fields: [
          {
            key: "stage",
            label: "Etapa",
            type: "select",
            options: [
              { id: "novo", label: "Novo" },
              { id: "won", label: "Ganho" },
            ],
          },
        ],
      },
    ],
    views: [{ ref: "pipeline", typeRef: "opportunity", name: "Funil", kind: "kanban", isDefault: true }],
    automations: [
      {
        ref: "mover_ganho",
        typeRef: "opportunity",
        name: "Mover pra ganho",
        trigger: { type: "property_changed", field: "stage", to: "won" },
        actions: [{ type: "notify_me", title: "Ganhou!" }],
      },
    ],
    sampleItems: [{ typeRef: "opportunity", title: "Negócio exemplo", properties: { stage: "novo" } }],
    ...overrides,
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "));
  return parsed.data;
}

function newFake() {
  const fake = new FakeSupabase({ object_types: ["slug"] });
  fake.seed("user_settings", [{ owner_id: USER_ID, modules: { finance: true, ai: false, messaging: false } }]);
  return fake;
}

describe("installPack", () => {
  it("primeira instalação cria tipo, campo, visão, automação, exemplo e mapeia tudo", async () => {
    const fake = newFake();
    const options: InstallPackOptions = { spaceId: null, withSamples: true };
    const result = await installPack(client(fake), USER_ID, buildPack(), options);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({
      ok: true,
      data: { updated: false, typesCreated: 1, fieldsAdded: 1, viewsCreated: 1, automationsCreated: 1, sampleItemsCreated: 1 },
    });

    expect(fake.rowsOf("object_types")).toHaveLength(1);
    expect(fake.rowsOf("views")).toHaveLength(1);
    expect(fake.rowsOf("automations")).toHaveLength(1);
    expect(fake.rowsOf("items")).toHaveLength(1);
    expect(fake.rowsOf("packs_installed")).toHaveLength(1);

    const mapping = fake.rowsOf("packs_installed")[0]!.mapping as { types: Record<string, string> };
    expect(mapping.types.opportunity).toBe(fake.rowsOf("object_types")[0]!.id);
  });

  it("reinstalar é idempotente: não duplica tipo, visão nem automação", async () => {
    const fake = newFake();
    const options: InstallPackOptions = { spaceId: null };
    await installPack(client(fake), USER_ID, buildPack(), options);
    const second = await installPack(client(fake), USER_ID, buildPack(), options);

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data).toMatchObject({ updated: true, typesCreated: 0, fieldsAdded: 0, viewsCreated: 0, automationsCreated: 0 });

    expect(fake.rowsOf("object_types")).toHaveLength(1);
    expect(fake.rowsOf("views")).toHaveLength(1);
    expect(fake.rowsOf("automations")).toHaveLength(1);
    expect(fake.rowsOf("packs_installed")).toHaveLength(1);
  });

  it("atualização preserva renomeação do dono e só adiciona o campo novo", async () => {
    const fake = newFake();
    const options: InstallPackOptions = { spaceId: null };
    await installPack(client(fake), USER_ID, buildPack(), options);

    const typeRow = fake.rowsOf("object_types")[0]!;
    typeRow.name = "Negócio";
    const fields = typeRow.fields as { key: string; label: string }[];
    fields[0]!.label = "Fase renomeada";

    const packV2 = buildPack({
      version: "1.1.0",
      types: [
        {
          ref: "opportunity",
          name: "Oportunidade",
          icon: "🎯",
          fields: [
            { key: "stage", label: "Etapa", type: "select", options: [{ id: "novo", label: "Novo" }] },
            { key: "valor", label: "Valor", type: "money" },
          ],
        },
      ],
    });

    const result = await installPack(client(fake), USER_ID, packV2, options);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.typesCreated).toBe(0);
    expect(result.data.fieldsAdded).toBe(1);

    const updatedType = fake.rowsOf("object_types")[0]!;
    expect(updatedType.name).toBe("Negócio");
    const updatedFields = updatedType.fields as { key: string; label: string }[];
    expect(updatedFields.find((field) => field.key === "stage")!.label).toBe("Fase renomeada");
    expect(updatedFields.find((field) => field.key === "valor")).toBeTruthy();
  });

  it("instalar o mesmo pack em dois espaços cria dois tipos com slugs distintos", async () => {
    const fake = newFake();

    const first = await installPack(client(fake), USER_ID, buildPack(), { spaceId: "space-1" });
    const second = await installPack(client(fake), USER_ID, buildPack(), { spaceId: "space-2" });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(fake.rowsOf("object_types")).toHaveLength(2);
    expect(fake.rowsOf("packs_installed")).toHaveLength(2);
    const slugs = fake.rowsOf("object_types").map((row) => row.slug);
    expect(new Set(slugs).size).toBe(2);
  });

  it("personalização na instalação renomeia nome, ícone e campo", async () => {
    const fake = newFake();
    const result = await installPack(client(fake), USER_ID, buildPack(), {
      spaceId: null,
      typeOverrides: { opportunity: { name: "Negócio", icon: "💰", fields: { stage: { label: "Fase" } } } },
    });

    expect(result.ok).toBe(true);
    const type = fake.rowsOf("object_types")[0]!;
    expect(type.name).toBe("Negócio");
    expect(type.icon).toBe("💰");
    const fields = type.fields as { key: string; label: string }[];
    expect(fields.find((field) => field.key === "stage")!.label).toBe("Fase");
  });

  it("bloqueia instalação quando um módulo requerido está desligado", async () => {
    const fake = new FakeSupabase();
    fake.seed("user_settings", [{ owner_id: USER_ID, modules: { finance: false } }]);

    const result = await installPack(client(fake), USER_ID, buildPack({ requires: ["finance"] }), { spaceId: null });
    expect(result.ok).toBe(false);
    expect(fake.rowsOf("object_types")).toHaveLength(0);
  });

  it("extendsSlug (5.8/5.10): soma campos a um tipo de sistema já existente em vez de criar um novo", async () => {
    const fake = newFake();
    fake.seed("object_types", [{ id: "tarefa-1", owner_id: USER_ID, slug: "tarefa", name: "Tarefa", fields: [] }]);

    const pack = buildPack({
      key: "projetos",
      types: [{ ref: "task", name: "Tarefa", extendsSlug: "tarefa", fields: [{ key: "estimate", label: "Estimativa", type: "duration" }] }],
      views: [],
      automations: [],
      sampleItems: [],
    });

    const result = await installPack(client(fake), USER_ID, pack, { spaceId: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.typesCreated).toBe(0);
    expect(result.data.fieldsAdded).toBe(1);

    expect(fake.rowsOf("object_types")).toHaveLength(1);
    const extended = fake.rowsOf("object_types")[0]!;
    expect(extended.id).toBe("tarefa-1");
    expect((extended.fields as { key: string }[]).map((field) => field.key)).toEqual(["estimate"]);

    const mapping = fake.rowsOf("packs_installed")[0]!.mapping as { types: Record<string, string> };
    expect(mapping.types.task).toBe("tarefa-1");
  });

  it("campo rollup resolve rollupRelationTypeId a partir da ref do próprio pack", async () => {
    const fake = newFake();
    // Ids gerados pela FakeSupabase (`object_types-1`) não são uuid — pré-semeia a "task" com um uuid de
    // verdade e já mapeada, pra ensureType reaproveitar em vez de criar (fieldDefinitionSchema.rollupRelationTypeId
    // exige `.uuid()`, igual `relationTypeId`, porque em produção `object_types.id` é sempre um uuid do Postgres).
    const taskId = "11111111-1111-4111-8111-111111111111";
    fake.seed("object_types", [{ id: taskId, owner_id: USER_ID, slug: "task", name: "Tarefa", fields: [] }]);
    fake.seed("packs_installed", [
      { id: "installed-1", owner_id: USER_ID, pack_key: "projetos", version: "0.9.0", space_id: null, mapping: { types: { task: taskId }, views: {}, automations: {}, reminderRules: {} } },
    ]);

    const pack = buildPack({
      key: "projetos",
      types: [
        { ref: "task", name: "Tarefa", fields: [] },
        {
          ref: "project",
          name: "Projeto",
          fields: [
            {
              key: "progress",
              label: "Progresso",
              type: "rollup",
              rollupRelationTypeId: "task",
              rollupRelationField: "project",
              rollupOp: "percent",
            },
          ],
        },
      ],
      views: [],
      automations: [],
      sampleItems: [],
    });

    const result = await installPack(client(fake), USER_ID, pack, { spaceId: null });
    expect(result.ok).toBe(true);

    const projectType = fake.rowsOf("object_types").find((row) => row.name === "Projeto")!;
    const progressField = (projectType.fields as { key: string; rollupRelationTypeId?: string }[]).find((f) => f.key === "progress")!;
    expect(progressField.rollupRelationTypeId).toBe(taskId);
  });

  it("exemplo com content (5.9: template de lista) grava content e content_text", async () => {
    const fake = newFake();
    const pack = buildPack({
      types: [{ ref: "list", name: "Lista", fields: [] }],
      views: [],
      automations: [],
      sampleItems: [
        {
          typeRef: "list",
          title: "Compras do mês",
          properties: {},
          content: { type: "doc", content: [{ type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Leite" }] }] }] }] },
        },
      ],
    });

    const result = await installPack(client(fake), USER_ID, pack, { spaceId: null, withSamples: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sampleItemsCreated).toBe(1);

    const item = fake.rowsOf("items")[0]!;
    expect(item.content).toBeTruthy();
    expect(item.content_text).toContain("Leite");
  });
});
