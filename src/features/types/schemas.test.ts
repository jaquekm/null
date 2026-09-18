import { describe, expect, it } from "vitest";
import { buildPropertiesSchema, fieldDefinitionSchema, type FieldDefinition } from "./schemas";

function field(overrides: Partial<FieldDefinition> & Pick<FieldDefinition, "key" | "type">): FieldDefinition {
  return {
    label: overrides.label ?? "Campo",
    required: overrides.required ?? false,
    ...overrides,
  };
}

describe("fieldDefinitionSchema", () => {
  it("aceita uma definição de campo mínima válida", () => {
    const result = fieldDefinitionSchema.safeParse({
      key: "status",
      label: "Status",
      type: "select",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita key que não começa com letra minúscula", () => {
    const result = fieldDefinitionSchema.safeParse({
      key: "1status",
      label: "Status",
      type: "text",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita key com maiúsculas ou espaços", () => {
    expect(fieldDefinitionSchema.safeParse({ key: "Status Atual", label: "x", type: "text" }).success).toBe(false);
  });

  it("rejeita tipo fora de fieldTypes", () => {
    const result = fieldDefinitionSchema.safeParse({
      key: "status",
      label: "Status",
      type: "not_a_type",
    });
    expect(result.success).toBe(false);
  });

  it("aplica default required = false e currency = 'BRL'", () => {
    const result = fieldDefinitionSchema.parse({ key: "preco", label: "Preço", type: "money" });
    expect(result.required).toBe(false);
    expect(result.currency).toBe("BRL");
  });
});

describe("buildPropertiesSchema", () => {
  it("string simples: text, long_text, phone", () => {
    const schema = buildPropertiesSchema([
      field({ key: "nome", type: "text", required: true }),
      field({ key: "notas", type: "long_text" }),
      field({ key: "telefone", type: "phone" }),
    ]);
    expect(schema.safeParse({ nome: "Ana", notas: "texto longo", telefone: "11999999999" }).success).toBe(true);
    expect(schema.safeParse({ notas: "sem nome obrigatório" }).success).toBe(false);
    expect(schema.safeParse({ nome: 123 }).success).toBe(false);
  });

  it("url válida e inválida", () => {
    const schema = buildPropertiesSchema([field({ key: "site", type: "url", required: true })]);
    expect(schema.safeParse({ site: "https://exemplo.com" }).success).toBe(true);
    expect(schema.safeParse({ site: "não é url" }).success).toBe(false);
  });

  it("email válido e inválido", () => {
    const schema = buildPropertiesSchema([field({ key: "contato", type: "email", required: true })]);
    expect(schema.safeParse({ contato: "a@b.com" }).success).toBe(true);
    expect(schema.safeParse({ contato: "a-arroba-b" }).success).toBe(false);
  });

  it("number e percent aceitam números e respeitam min/max", () => {
    const schema = buildPropertiesSchema([
      field({ key: "quantidade", type: "number", required: true }),
      field({ key: "progresso", type: "percent", required: true, min: 0, max: 100 }),
    ]);
    expect(schema.safeParse({ quantidade: 5, progresso: 50 }).success).toBe(true);
    expect(schema.safeParse({ quantidade: "5", progresso: 50 }).success).toBe(false);
    expect(schema.safeParse({ quantidade: 5, progresso: 150 }).success).toBe(false);
  });

  it("money e duration exigem inteiro", () => {
    const schema = buildPropertiesSchema([
      field({ key: "valor", type: "money", required: true }),
      field({ key: "tempo", type: "duration", required: true }),
    ]);
    expect(schema.safeParse({ valor: 1050, tempo: 90 }).success).toBe(true);
    expect(schema.safeParse({ valor: 10.5, tempo: 90 }).success).toBe(false);
    expect(schema.safeParse({ valor: 1050, tempo: -5 }).success).toBe(false);
  });

  it("rating aceita inteiro dentro do min/max configurado", () => {
    const schema = buildPropertiesSchema([field({ key: "potencial", type: "rating", required: true, min: 1, max: 5 })]);
    expect(schema.safeParse({ potencial: 3 }).success).toBe(true);
    expect(schema.safeParse({ potencial: 6 }).success).toBe(false);
    expect(schema.safeParse({ potencial: 2.5 }).success).toBe(false);
  });

  it("date exige formato AAAA-MM-DD", () => {
    const schema = buildPropertiesSchema([field({ key: "prazo", type: "date", required: true })]);
    expect(schema.safeParse({ prazo: "2026-09-18" }).success).toBe(true);
    expect(schema.safeParse({ prazo: "18/09/2026" }).success).toBe(false);
  });

  it("datetime exige ISO 8601", () => {
    const schema = buildPropertiesSchema([field({ key: "reuniao", type: "datetime", required: true })]);
    expect(schema.safeParse({ reuniao: "2026-09-18T14:00:00Z" }).success).toBe(true);
    expect(schema.safeParse({ reuniao: "2026-09-18 14:00" }).success).toBe(false);
  });

  it("checkbox exige boolean", () => {
    const schema = buildPropertiesSchema([field({ key: "lida", type: "checkbox", required: true })]);
    expect(schema.safeParse({ lida: true }).success).toBe(true);
    expect(schema.safeParse({ lida: "true" }).success).toBe(false);
  });

  it("select só aceita o id de uma das opções", () => {
    const schema = buildPropertiesSchema([
      field({
        key: "status",
        type: "select",
        required: true,
        options: [
          { id: "todo", label: "A fazer" },
          { id: "done", label: "Feito" },
        ],
      }),
    ]);
    expect(schema.safeParse({ status: "todo" }).success).toBe(true);
    expect(schema.safeParse({ status: "cancelado" }).success).toBe(false);
  });

  it("multi_select aceita array de ids válidos e rejeita id desconhecido", () => {
    const schema = buildPropertiesSchema([
      field({
        key: "categorias",
        type: "multi_select",
        required: true,
        options: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
      }),
    ]);
    expect(schema.safeParse({ categorias: ["a", "b"] }).success).toBe(true);
    expect(schema.safeParse({ categorias: ["a", "z"] }).success).toBe(false);
  });

  it("relation aceita array de uuids e respeita multiple = false", () => {
    const schema = buildPropertiesSchema([
      field({ key: "relacionados", type: "relation", required: true, multiple: false }),
    ]);
    const uuid1 = "11111111-1111-4111-8111-111111111111";
    const uuid2 = "22222222-2222-4222-8222-222222222222";
    expect(schema.safeParse({ relacionados: [uuid1] }).success).toBe(true);
    expect(schema.safeParse({ relacionados: [uuid1, uuid2] }).success).toBe(false);
    expect(schema.safeParse({ relacionados: ["não-é-uuid"] }).success).toBe(false);
  });

  it("file aceita array de uuids de anexos", () => {
    const schema = buildPropertiesSchema([field({ key: "arquivos", type: "file" })]);
    const uuid = "33333333-3333-4333-8333-333333333333";
    expect(schema.safeParse({ arquivos: [uuid] }).success).toBe(true);
    expect(schema.safeParse({ arquivos: ["nome.pdf"] }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(true);
  });

  it("preserva chaves desconhecidas (campo removido do tipo) sem validá-las", () => {
    const schema = buildPropertiesSchema([field({ key: "titulo", type: "text", required: true })]);
    const result = schema.safeParse({ titulo: "Ok", campo_antigo: { qualquer: "coisa" } });
    expect(result.success).toBe(true);
    expect(result.success && result.data.campo_antigo).toEqual({ qualquer: "coisa" });
  });
});
