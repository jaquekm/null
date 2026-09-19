import { describe, expect, it } from "vitest";
import { hasSufficientTextLayer } from "./pdf-text-layer";

describe("hasSufficientTextLayer", () => {
  it("texto com média >= 100 caracteres por página é suficiente", () => {
    expect(hasSufficientTextLayer("a".repeat(250), 2)).toBe(true); // 125/página
  });

  it("texto com média < 100 caracteres por página não é suficiente (PDF escaneado)", () => {
    expect(hasSufficientTextLayer("a".repeat(50), 2)).toBe(false); // 25/página
  });

  it("0 páginas nunca é suficiente", () => {
    expect(hasSufficientTextLayer("qualquer coisa", 0)).toBe(false);
  });
});
