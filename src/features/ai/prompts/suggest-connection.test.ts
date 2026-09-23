import { describe, expect, it } from "vitest";
import { buildSuggestConnectionMessage } from "./suggest-connection";

describe("buildSuggestConnectionMessage", () => {
  it("identifica os dois itens como A e B, com título e conteúdo", () => {
    const message = buildSuggestConnectionMessage({ title: "Reunião com Acme", contentText: "Discutimos o contrato." }, { title: "Proposta Acme", contentText: "Valor de R$ 5.000." });

    expect(message).toContain('Item A: "Reunião com Acme"');
    expect(message).toContain("Discutimos o contrato.");
    expect(message).toContain('Item B: "Proposta Acme"');
    expect(message).toContain("Valor de R$ 5.000.");
  });

  it("sem título/conteúdo: usa marcadores em vez de string vazia", () => {
    const message = buildSuggestConnectionMessage({ title: "", contentText: "" }, { title: "", contentText: "" });

    expect(message).toContain('Item A: "Sem título"');
    expect(message).toContain("(sem conteúdo)");
  });

  it("corta conteúdo muito longo em 1500 caracteres por item", () => {
    const message = buildSuggestConnectionMessage({ title: "A", contentText: "x".repeat(2000) }, { title: "B", contentText: "y".repeat(2000) });

    expect(message).toContain("x".repeat(1500));
    expect(message).not.toContain("x".repeat(1501));
    expect(message).toContain("y".repeat(1500));
    expect(message).not.toContain("y".repeat(1501));
  });
});
