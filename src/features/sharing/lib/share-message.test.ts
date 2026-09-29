import { describe, expect, it } from "vitest";
import { shareMessage } from "./share-message";

describe("shareMessage", () => {
  it("fala de lista quando é lista e inclui o link", () => {
    expect(shareMessage("Prioridades de vida", "https://x/p/abc", true)).toBe(
      "Estou compartilhando a lista “Prioridades de vida” com você. Acompanhe por aqui — o link mostra sempre a versão atual, sem precisar criar conta: https://x/p/abc",
    );
  });

  it("usa só o título nos outros itens e cobre título vazio", () => {
    expect(shareMessage("  ", "u", false)).toContain("compartilhando “Sem título” com você");
  });
});
