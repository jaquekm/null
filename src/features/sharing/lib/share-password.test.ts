import { describe, expect, it } from "vitest";
import { hashSharePassword, verifySharePassword } from "./share-password";

describe("share password (scrypt)", () => {
  it("ida e volta: senha certa verifica", async () => {
    const hash = await hashSharePassword("segredo123");
    expect(await verifySharePassword("segredo123", hash)).toBe(true);
  });

  it("senha errada: false", async () => {
    const hash = await hashSharePassword("segredo123");
    expect(await verifySharePassword("outra-coisa", hash)).toBe(false);
  });

  it("duas chamadas com a mesma senha geram hashes diferentes (salt aleatório)", async () => {
    const a = await hashSharePassword("segredo123");
    const b = await hashSharePassword("segredo123");
    expect(a).not.toBe(b);
  });

  it("hash em formato inesperado (sem o separador): false, não lança", async () => {
    await expect(verifySharePassword("segredo123", "isso-nao-e-um-hash-valido")).resolves.toBe(false);
  });

  it("hash vazio: false, não lança", async () => {
    await expect(verifySharePassword("segredo123", "")).resolves.toBe(false);
  });
});
