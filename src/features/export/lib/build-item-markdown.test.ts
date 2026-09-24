import { describe, expect, it } from "vitest";
import { buildItemMarkdown, itemFileSlug } from "./build-item-markdown";

describe("itemFileSlug", () => {
  it("monta <titulo-slug>--<id-curto>.md", () => {
    expect(itemFileSlug("Reunião de Terça", "12345678-aaaa-bbbb-cccc-000000000000")).toBe("reuniao-de-terca--12345678.md");
  });

  it("título vazio vira sem-titulo", () => {
    expect(itemFileSlug("", "12345678-0000-0000-0000-000000000000")).toBe("sem-titulo--12345678.md");
  });
});

describe("buildItemMarkdown", () => {
  it("monta front matter YAML + corpo, sem tags/propriedades/links", () => {
    const markdown = buildItemMarkdown({
      id: "item-1",
      title: "Nota simples",
      typeName: "Nota",
      spaceName: "Pessoal",
      tags: [],
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      propertyLines: [],
      outgoingLinkTitles: [],
      bodyMarkdown: "Corpo do item.",
    });

    expect(markdown).toBe(
      [
        "---",
        "id: item-1",
        "titulo: Nota simples",
        "tipo: Nota",
        "espaco: Pessoal",
        "status: active",
        "criado_em: 2026-01-01T00:00:00.000Z",
        "atualizado_em: 2026-01-02T00:00:00.000Z",
        "tags: []",
        "---",
        "",
        "Corpo do item.",
        "",
      ].join("\n"),
    );
  });

  it("inclui tags, propriedades legíveis e seção de links [[titulo]]", () => {
    const markdown = buildItemMarkdown({
      id: "item-2",
      title: "Com tudo",
      typeName: "Reunião",
      spaceName: "Trabalho",
      tags: ["urgente", "cliente-x"],
      status: "inbox",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      propertyLines: ["Status: Em andamento", "Responsável: Ana"],
      outgoingLinkTitles: ["Projeto Alfa", "Maria"],
      bodyMarkdown: "Pauta da reunião.",
    });

    expect(markdown).toContain("tags:\n  - urgente\n  - cliente-x");
    // Valores com ": " precisam de aspas em YAML (senão o "Em andamento" viraria outro par chave/valor).
    expect(markdown).toContain('propriedades:\n  - "Status: Em andamento"\n  - "Responsável: Ana"');
    expect(markdown).toContain("## Links\n\n- [[Projeto Alfa]]\n- [[Maria]]");
  });

  it("escapa título com caracteres especiais de YAML", () => {
    const markdown = buildItemMarkdown({
      id: "item-3",
      title: "Título: com dois pontos",
      typeName: null,
      spaceName: null,
      tags: [],
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      propertyLines: [],
      outgoingLinkTitles: [],
      bodyMarkdown: "",
    });
    expect(markdown).toContain('titulo: "Título: com dois pontos"');
  });
});
