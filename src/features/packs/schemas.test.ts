import { describe, expect, it } from "vitest";
import { missingModules, packSchema } from "./schemas";

function basePack(overrides: Record<string, unknown> = {}) {
  return {
    key: "crm",
    version: "1.0.0",
    name: "Vendas (CRM)",
    description: "Oportunidades e follow-ups",
    icon: "💼",
    requires: ["contacts"],
    types: [
      {
        ref: "opportunity",
        name: "Oportunidade",
        plural: "Oportunidades",
        icon: "🎯",
        fields: [
          { key: "stage", label: "Etapa", type: "select", options: [{ id: "novo", label: "Novo" }] },
          { key: "contact", label: "Contato", type: "relation", relationTypeId: "opportunity", multiple: false },
        ],
      },
    ],
    views: [{ ref: "pipeline", typeRef: "opportunity", name: "Funil", kind: "kanban", isDefault: true }],
    automations: [
      {
        typeRef: "opportunity",
        name: "Mover pra ganho",
        trigger: { type: "property_changed", field: "stage", to: "won" },
        actions: [{ type: "notify_me", title: "Ganhou!", body: "{{title}}" }],
      },
    ],
    ...overrides,
  };
}

describe("packSchema", () => {
  it("aceita um pack completo e válido", () => {
    const result = packSchema.safeParse(basePack());
    expect(result.success).toBe(true);
  });

  it("rejeita chave do pack com maiúscula", () => {
    expect(packSchema.safeParse(basePack({ key: "CRM" })).success).toBe(false);
  });

  it("rejeita versão fora do formato semver", () => {
    expect(packSchema.safeParse(basePack({ version: "1.0" })).success).toBe(false);
  });

  it("rejeita ref de tipo duplicada", () => {
    const pack = basePack();
    pack.types = [...pack.types, { ...pack.types[0]! }];
    expect(packSchema.safeParse(pack).success).toBe(false);
  });

  it("rejeita view apontando pra typeRef que não existe no pack", () => {
    const pack = basePack();
    pack.views = [{ ref: "pipeline", typeRef: "nao-existe", name: "Funil", kind: "kanban", isDefault: true }];
    expect(packSchema.safeParse(pack).success).toBe(false);
  });

  it("rejeita campo de relação apontando pra tipo fora do pack", () => {
    const pack = basePack();
    pack.types[0]!.fields[1]!.relationTypeId = "tipo-fantasma";
    expect(packSchema.safeParse(pack).success).toBe(false);
  });

  it("rejeita sampleItem apontando pra typeRef inexistente", () => {
    const pack = basePack({ sampleItems: [{ typeRef: "nao-existe", title: "Exemplo", properties: {} }] });
    expect(packSchema.safeParse(pack).success).toBe(false);
  });

  it("exige ao menos um tipo", () => {
    const pack = basePack({ types: [] });
    expect(packSchema.safeParse(pack).success).toBe(false);
  });
});

describe("missingModules", () => {
  it("módulo núcleo (ex.: contacts) nunca é considerado faltando", () => {
    expect(missingModules(["contacts"], {})).toEqual([]);
  });

  it("módulo togglável desligado entra na lista de faltando", () => {
    expect(missingModules(["finance"], { finance: false })).toEqual(["finance"]);
  });

  it("módulo togglável ausente do objeto (nunca configurado) conta como desligado", () => {
    expect(missingModules(["ai"], {})).toEqual(["ai"]);
  });

  it("módulo togglável ligado não entra na lista", () => {
    expect(missingModules(["finance", "ai"], { finance: true, ai: false })).toEqual(["ai"]);
  });
});
