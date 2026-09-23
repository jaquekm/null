import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "@/features/types/schemas";
import type { Segment } from "@/lib/transcription/types";
import { chunkAttachmentText, chunkItemContent, chunkProperties, chunkTranscript, contentHash, estimateTokens, type PropertyResolutionMaps } from "./chunking";

describe("estimateTokens", () => {
  it("caracteres ÷ 4, arredondado pra cima", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("")).toBe(0);
  });
});

describe("contentHash", () => {
  it("mesmo texto sempre gera o mesmo hash", () => {
    expect(contentHash("olá mundo")).toBe(contentHash("olá mundo"));
  });

  it("textos diferentes geram hashes diferentes", () => {
    expect(contentHash("a")).not.toBe(contentHash("b"));
  });
});

function heading(level: number, text: string): JSONContent {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}
function paragraph(text: string): JSONContent {
  return { type: "paragraph", content: [{ type: "text", text }] };
}
function doc(...content: JSONContent[]): JSONContent {
  return { type: "doc", content };
}

describe("chunkItemContent", () => {
  it("sem conteúdo: nenhum trecho", () => {
    expect(chunkItemContent("Título", null)).toEqual([]);
  });

  it("conteúdo antes do primeiro heading vira seção sem título (só 'Título do item')", () => {
    const chunks = chunkItemContent("Reunião de terça", doc(paragraph("Intro sem seção.")));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text.startsWith("Reunião de terça\n\n")).toBe(true);
    expect(chunks[0]!.metadata.section).toBeNull();
  });

  it("prefixa cada trecho com 'Título do item › Seção'", () => {
    const chunks = chunkItemContent("Reunião de terça", doc(heading(2, "Decisões"), paragraph("Aprovamos o orçamento.")));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text.startsWith("Reunião de terça › Decisões\n\n")).toBe(true);
    expect(chunks[0]!.metadata.section).toBe("Decisões");
  });

  it("cada heading inicia uma seção nova, cada uma com seu próprio prefixo", () => {
    const chunks = chunkItemContent(
      "Nota",
      doc(heading(1, "Resumo"), paragraph("Texto do resumo."), heading(1, "Próximos passos"), paragraph("Fazer X.")),
    );
    expect(chunks.map((c) => c.metadata.section)).toEqual(["Resumo", "Próximos passos"]);
  });

  it("seção grande vira mais de um trecho, com sobreposição (~500 tokens, chunkText por trás)", () => {
    const longParagraph = paragraph("frase razoavelmente longa para forçar quebra. ".repeat(120));
    const chunks = chunkItemContent("Nota grande", doc(heading(1, "Só uma seção"), longParagraph));
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.metadata.section).toBe("Só uma seção");
  });

  it("heading sem nenhum parágrafo depois não vira trecho vazio", () => {
    const chunks = chunkItemContent("Nota", doc(heading(1, "Vazia"), heading(1, "Com conteúdo"), paragraph("Aqui tem.")));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.metadata.section).toBe("Com conteúdo");
  });
});

describe("chunkTranscript", () => {
  function segment(overrides: Partial<Segment>): Segment {
    return { speaker: "A", start: 0, end: 1, text: "...", ...overrides };
  }

  it("sem segmentos: nenhum trecho", () => {
    expect(chunkTranscript([], {})).toEqual([]);
  });

  it("agrupa segmentos numa janela só quando cabem em ~2-3 min", () => {
    const segments = [segment({ speaker: "A", start: 0, text: "Oi" }), segment({ speaker: "B", start: 30, text: "Tudo bem" })];
    const chunks = chunkTranscript(segments, { A: "João", B: "Maria" });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.metadata.start).toBe(0);
    expect(chunks[0]!.text).toBe("[00:00:00] João: Oi\n[00:00:30] Maria: Tudo bem");
  });

  it("resolve locutor pelo código quando não há nome em speaker_names", () => {
    const chunks = chunkTranscript([segment({ speaker: "C", start: 0, text: "..." })], {});
    expect(chunks[0]!.text).toContain("C: ...");
  });

  it("passar de ~2-3 min inicia uma nova janela", () => {
    const segments = [segment({ speaker: "A", start: 0, text: "Início" }), segment({ speaker: "A", start: 200, text: "Bem depois" })];
    const chunks = chunkTranscript(segments, { A: "João" });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.metadata.start).toBe(0);
    expect(chunks[1]!.metadata.start).toBe(200);
  });
});

describe("chunkAttachmentText", () => {
  it("texto vazio: nenhum trecho", () => {
    expect(chunkAttachmentText("   ", 3)).toEqual([]);
  });

  it("com page_count > 1, divide em partes aproximadamente iguais, uma por página", () => {
    const text = "0123456789".repeat(30); // 300 chars
    const chunks = chunkAttachmentText(text, 3);

    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => c.metadata.page)).toEqual([1, 2, 3]);
    expect(chunks.map((c) => c.text).join("")).toBe(text);
  });

  it("sem page_count, cai no chunking genérico por tamanho (sem metadata.page)", () => {
    const chunks = chunkAttachmentText("texto corrido pequeno", null);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.metadata.page).toBeUndefined();
  });

  it("page_count = 1 também cai no chunking genérico (não faz sentido 'dividir em 1 página')", () => {
    const chunks = chunkAttachmentText("texto de uma página só", 1);
    expect(chunks[0]!.metadata.page).toBeUndefined();
  });
});

describe("chunkProperties", () => {
  const emptyMaps: PropertyResolutionMaps = { contactNames: new Map(), itemTitles: new Map() };

  function field(overrides: Partial<FieldDefinition>): FieldDefinition {
    return { key: "campo", label: "Campo", type: "text", required: false, ...overrides } as FieldDefinition;
  }

  it("sem nenhuma propriedade preenchida: null", () => {
    expect(chunkProperties([field({ key: "a", label: "A" })], {}, emptyMaps, { includeFinanceContacts: false })).toBeNull();
  });

  it("resolve select pro rótulo da opção", () => {
    const f = field({ key: "status", label: "Status", type: "select", options: [{ id: "done", label: "Concluído" }] });
    const chunk = chunkProperties([f], { status: "done" }, emptyMaps, { includeFinanceContacts: false });
    expect(chunk!.text).toBe("Status: Concluído");
  });

  it("resolve multi_select juntando os rótulos", () => {
    const f = field({
      key: "tags",
      label: "Tags",
      type: "multi_select",
      options: [{ id: "a", label: "Urgente" }, { id: "b", label: "Cliente" }],
    });
    const chunk = chunkProperties([f], { tags: ["a", "b"] }, emptyMaps, { includeFinanceContacts: false });
    expect(chunk!.text).toBe("Tags: Urgente, Cliente");
  });

  it("resolve contact/relation pelo nome/título carregado nos mapas", () => {
    const maps: PropertyResolutionMaps = {
      contactNames: new Map([["c1", "Ana Souza"]]),
      itemTitles: new Map([["i1", "Projeto X"]]),
    };
    const fields = [field({ key: "responsavel", label: "Responsável", type: "contact" }), field({ key: "projeto", label: "Projeto", type: "relation" })];
    const chunk = chunkProperties(fields, { responsavel: "c1", projeto: "i1" }, maps, { includeFinanceContacts: true });
    expect(chunk!.text).toBe("Responsável: Ana Souza\nProjeto: Projeto X");
  });

  it("por padrão (includeFinanceContacts: false) pula campos contact e money", () => {
    const fields = [
      field({ key: "responsavel", label: "Responsável", type: "contact" }),
      field({ key: "valor", label: "Valor", type: "money" }),
      field({ key: "titulo", label: "Título", type: "text" }),
    ];
    const chunk = chunkProperties(fields, { responsavel: "c1", valor: 100, titulo: "Algo" }, emptyMaps, { includeFinanceContacts: false });
    expect(chunk!.text).toBe("Título: Algo");
  });

  it("includeFinanceContacts: true inclui contact e money", () => {
    const maps: PropertyResolutionMaps = { contactNames: new Map([["c1", "Ana"]]), itemTitles: new Map() };
    const fields = [field({ key: "responsavel", label: "Responsável", type: "contact" }), field({ key: "valor", label: "Valor", type: "money" })];
    const chunk = chunkProperties(fields, { responsavel: "c1", valor: 5000 }, maps, { includeFinanceContacts: true });
    expect(chunk!.text).toBe("Responsável: Ana\nValor: 5000");
  });

  it("pula campos escondidos (hidden)", () => {
    const fields = [field({ key: "a", label: "A", hidden: true }), field({ key: "b", label: "B" })];
    const chunk = chunkProperties(fields, { a: "x", b: "y" }, emptyMaps, { includeFinanceContacts: false });
    expect(chunk!.text).toBe("B: y");
  });
});
