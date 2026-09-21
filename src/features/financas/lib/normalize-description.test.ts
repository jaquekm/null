import { describe, expect, it } from "vitest";
import { normalizeDescription } from "./normalize-description";

describe("normalizeDescription", () => {
  it("remove acentos e baixa a caixa", () => {
    expect(normalizeDescription("Pão de Açúcar")).toBe("pao de acucar");
  });

  it("troca pontuação/símbolos por espaço", () => {
    expect(normalizeDescription("Uber *Trip help.uber.com")).toBe("uber trip help uber com");
  });

  it("colapsa espaços repetidos e tira das pontas", () => {
    expect(normalizeDescription("  Mercado   Livre  ")).toBe("mercado livre");
  });

  it("string vazia continua vazia", () => {
    expect(normalizeDescription("")).toBe("");
  });
});
