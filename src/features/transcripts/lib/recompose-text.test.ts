import { describe, expect, it } from "vitest";
import { recomposeText } from "./recompose-text";

describe("recomposeText", () => {
  it("junta o texto dos segmentos, na ordem, separado por espaço", () => {
    const text = recomposeText([
      { speaker: "A", start: 0, end: 1, text: "Olá," },
      { speaker: "A", start: 1, end: 2, text: "tudo bem?" },
    ]);
    expect(text).toBe("Olá, tudo bem?");
  });

  it("lista vazia dá string vazia", () => {
    expect(recomposeText([])).toBe("");
  });
});
