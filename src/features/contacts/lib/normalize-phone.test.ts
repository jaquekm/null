import { describe, expect, it } from "vitest";
import { normalizePhoneToE164 } from "./normalize-phone";

describe("normalizePhoneToE164", () => {
  it("normaliza um celular BR sem código de país", () => {
    expect(normalizePhoneToE164("11987654321")).toBe("+5511987654321");
  });

  it("normaliza um celular BR já formatado", () => {
    expect(normalizePhoneToE164("(11) 98765-4321")).toBe("+5511987654321");
  });

  it("mantém o país quando o número já vem com +", () => {
    expect(normalizePhoneToE164("+1 415 555 2671")).toBe("+14155552671");
  });

  it("devolve null pra string vazia", () => {
    expect(normalizePhoneToE164("")).toBeNull();
    expect(normalizePhoneToE164("   ")).toBeNull();
  });

  it("devolve null pra número inválido", () => {
    expect(normalizePhoneToE164("123")).toBeNull();
    expect(normalizePhoneToE164("não é telefone")).toBeNull();
  });
});
