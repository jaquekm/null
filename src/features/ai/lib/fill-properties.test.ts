import { describe, expect, it } from "vitest";
import { buildFillPropertiesPrompt, buildFillPropertiesSuggestions, coerceFieldValue, fillableFields } from "./fill-properties";
import type { FieldDefinition } from "@/features/types/schemas";

function field(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return { key: "campo", label: "Campo", type: "text", required: false, ...overrides };
}

describe("fillableFields", () => {
  it("mantém tipos simples e descarta relation/contact/file/rollup e campos ocultos", () => {
    const fields = [
      field({ key: "valor", type: "money" }),
      field({ key: "responsavel", type: "contact" }),
      field({ key: "relacionado", type: "relation" }),
      field({ key: "anexo", type: "file" }),
      field({ key: "progresso", type: "rollup" }),
      field({ key: "escondido", type: "text", hidden: true }),
    ];

    expect(fillableFields(fields).map((f) => f.key)).toEqual(["valor"]);
  });
});

describe("buildFillPropertiesPrompt", () => {
  it("descreve select com as opções (id=label) e money em reais, não centavos", () => {
    const fields = [
      field({ key: "estagio", label: "Estágio", type: "select", options: [{ id: "s1", label: "Lead" }, { id: "s2", label: "Ganho" }] }),
      field({ key: "valor", label: "Valor", type: "money" }),
    ];

    const prompt = buildFillPropertiesPrompt(fields);

    expect(prompt).toContain('"estagio" (Estágio): um id destas opções — s1="Lead", s2="Ganho"');
    expect(prompt).toContain('"valor" (Valor): valor em reais, número decimal (ex.: 1234.56) — NÃO em centavos.');
  });
});

describe("coerceFieldValue", () => {
  it("money: converte reais em centavos, arredondando", () => {
    expect(coerceFieldValue(field({ type: "money" }), 1234.56)).toBe(123456);
  });

  it("money: valor não numérico vira null", () => {
    expect(coerceFieldValue(field({ type: "money" }), "1234.56")).toBeNull();
  });

  it("date: só aceita AAAA-MM-DD", () => {
    expect(coerceFieldValue(field({ type: "date" }), "2026-08-20")).toBe("2026-08-20");
    expect(coerceFieldValue(field({ type: "date" }), "20/08/2026")).toBeNull();
  });

  it("select: só aceita um id de opção válida", () => {
    const f = field({ type: "select", options: [{ id: "s1", label: "Lead" }] });
    expect(coerceFieldValue(f, "s1")).toBe("s1");
    expect(coerceFieldValue(f, "s9")).toBeNull();
  });

  it("multi_select: filtra só os ids válidos, null se sobrar vazio", () => {
    const f = field({ type: "multi_select", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] });
    expect(coerceFieldValue(f, ["a", "x", "b"])).toEqual(["a", "b"]);
    expect(coerceFieldValue(f, ["x", "y"])).toBeNull();
  });

  it("checkbox: só aceita boolean de verdade", () => {
    expect(coerceFieldValue(field({ type: "checkbox" }), true)).toBe(true);
    expect(coerceFieldValue(field({ type: "checkbox" }), "true")).toBeNull();
  });

  it("texto: aparado, string vazia vira null", () => {
    expect(coerceFieldValue(field({ type: "text" }), "  valor  ")).toBe("valor");
    expect(coerceFieldValue(field({ type: "text" }), "   ")).toBeNull();
  });

  it("null/undefined: sempre null, qualquer tipo", () => {
    expect(coerceFieldValue(field({ type: "number" }), null)).toBeNull();
    expect(coerceFieldValue(field({ type: "number" }), undefined)).toBeNull();
  });
});

describe("buildFillPropertiesSuggestions", () => {
  it("só inclui campos com valor válido, com displayValue resolvido", () => {
    const fields = [
      field({ key: "valor", label: "Valor", type: "money" }),
      field({ key: "estagio", label: "Estágio", type: "select", options: [{ id: "s1", label: "Lead" }] }),
      field({ key: "sem_valor", label: "Sem valor", type: "text" }),
    ];
    const raw = { valor: 500, estagio: "s1", sem_valor: null };

    const suggestions = buildFillPropertiesSuggestions(fields, raw);

    expect(suggestions).toEqual([
      { key: "valor", label: "Valor", value: 50000, displayValue: "R$ 500,00" },
      { key: "estagio", label: "Estágio", value: "s1", displayValue: "Lead" },
    ]);
  });

  it("sem nenhum valor extraído: lista vazia", () => {
    const fields = [field({ key: "valor", type: "money" })];
    expect(buildFillPropertiesSuggestions(fields, {})).toEqual([]);
  });
});
