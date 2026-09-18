import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("remove acentos e coloca em minúsculo", () => {
    expect(slugify("Finanças da casa")).toBe("financas-da-casa");
  });

  it("troca espaços e pontuação por hífen único", () => {
    expect(slugify("Olá,   mundo!!")).toBe("ola-mundo");
  });

  it("remove hífens nas pontas", () => {
    expect(slugify("  -Estudos-  ")).toBe("estudos");
  });

  it("mantém números", () => {
    expect(slugify("Projeto 2026")).toBe("projeto-2026");
  });
});
