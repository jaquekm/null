import { describe, expect, it } from "vitest";
import { buildOrganizeInboxUserMessage, coerceInboxSuggestion } from "./organize-inbox";

describe("buildOrganizeInboxUserMessage", () => {
  it("lista espaços e tipos como id=\"nome\"", () => {
    const message = buildOrganizeInboxUserMessage(
      { title: "Reunião", contentText: "conteúdo da nota" },
      [{ id: "space-1", name: "Empresa X" }],
      [{ id: "type-1", name: "Reunião" }],
    );

    expect(message).toContain('space-1="Empresa X"');
    expect(message).toContain('type-1="Reunião"');
    expect(message).toContain("Título atual: Reunião");
    expect(message).toContain("Conteúdo: conteúdo da nota");
  });

  it("sem título/conteúdo: avisa em vez de deixar vazio", () => {
    const message = buildOrganizeInboxUserMessage({ title: "", contentText: "" }, [], []);

    expect(message).toContain("Título atual: (sem título)");
    expect(message).toContain("Conteúdo: (vazio)");
    expect(message).toContain("nenhum espaço criado ainda");
    expect(message).toContain("nenhum tipo criado ainda");
  });

  it("corta conteúdo muito longo em 4000 caracteres", () => {
    const message = buildOrganizeInboxUserMessage({ title: "T", contentText: "a".repeat(5000) }, [], []);

    expect(message).toContain(`Conteúdo: ${"a".repeat(4000)}`);
    expect(message).not.toContain("a".repeat(4001));
  });
});

describe("coerceInboxSuggestion", () => {
  it("mantém spaceId/typeId quando existem na lista de opções", () => {
    const result = coerceInboxSuggestion(
      { spaceId: "space-1", typeId: "type-1", tags: ["x"], title: "Novo título" },
      new Set(["space-1"]),
      new Set(["type-1"]),
    );

    expect(result).toEqual({ spaceId: "space-1", typeId: "type-1", tags: ["x"], title: "Novo título" });
  });

  it("descarta id alucinado (fora da lista de opções)", () => {
    const result = coerceInboxSuggestion({ spaceId: "space-fake", typeId: "type-fake", tags: [], title: null }, new Set(["space-1"]), new Set(["type-1"]));

    expect(result.spaceId).toBeNull();
    expect(result.typeId).toBeNull();
  });

  it("null explícito continua null", () => {
    const result = coerceInboxSuggestion({ spaceId: null, typeId: null, tags: [], title: null }, new Set(), new Set());
    expect(result).toEqual({ spaceId: null, typeId: null, tags: [], title: null });
  });
});
