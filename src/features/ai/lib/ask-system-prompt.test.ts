import { describe, expect, it } from "vitest";
import { buildAskSystemPrompt } from "./ask-system-prompt";

describe("buildAskSystemPrompt", () => {
  it("inclui a data de hoje no fuso do dono e o bloco de fontes", () => {
    const prompt = buildAskSystemPrompt('[1] Item: "Nota" — trecho 1\nconteúdo', "America/Sao_Paulo");

    expect(prompt).toContain("A data de hoje é");
    expect(prompt).toContain("Fontes:");
    expect(prompt).toContain('[1] Item: "Nota"');
  });

  it("instrui a citar com [n] e a admitir insuficiência de fontes", () => {
    const prompt = buildAskSystemPrompt("contexto", "America/Sao_Paulo");

    expect(prompt).toMatch(/n.mero entre colchetes/);
    expect(prompt).toMatch(/diga claramente o que não foi encontrado/);
  });

  it("sem contexto: avisa que não há fontes em vez de bloco vazio", () => {
    const prompt = buildAskSystemPrompt("", "America/Sao_Paulo");

    expect(prompt).toContain("Nenhuma fonte relevante foi encontrada na base para esta pergunta.");
    expect(prompt).not.toContain("Fontes:");
  });

  it("com ferramentas: instrui a citá-las como fonte, sem [n]", () => {
    const prompt = buildAskSystemPrompt("contexto", "America/Sao_Paulo", true);

    expect(prompt).toMatch(/use as ferramentas disponíveis/);
    expect(prompt).toContain("Fonte: lançamentos de 01/06 a 31/08");
  });

  it("sem ferramentas (padrão): não menciona a instrução de ferramentas", () => {
    const prompt = buildAskSystemPrompt("contexto", "America/Sao_Paulo");

    expect(prompt).not.toMatch(/use as ferramentas disponíveis/);
  });
});
