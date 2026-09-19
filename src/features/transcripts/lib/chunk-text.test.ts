import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk-text";

describe("chunkText", () => {
  it("texto dentro do limite devolve um único bloco", () => {
    expect(chunkText("abc", 10, 2)).toEqual(["abc"]);
  });

  it("divide texto maior que o limite em blocos sobrepostos", () => {
    const text = "a".repeat(25);
    const chunks = chunkText(text, 10, 3);

    expect(chunks.length).toBeGreaterThan(1);
    // cobre o texto inteiro, sem buracos
    expect(chunks.join("").length).toBeGreaterThanOrEqual(text.length);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(10);
  });

  it("prefere quebrar numa linha (\\n) perto do limite, não no meio de uma fala", () => {
    const text = "linha um\nlinha dois é bem mais longa\nlinha tres";
    const chunks = chunkText(text, 20, 2);

    // nenhum chunk deveria cortar "linha dois" ao meio se uma quebra de linha está disponível antes do limite
    expect(chunks[0]!.endsWith("\n") || !chunks[0]!.includes("linha dois")).toBe(true);
  });

  it("termina sem loop infinito mesmo sem quebras de linha disponíveis", () => {
    const text = "x".repeat(1000);
    const chunks = chunkText(text, 50, 45);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThan(1000); // sanity: não ficou preso incrementando 1 char por vez
  });
});
