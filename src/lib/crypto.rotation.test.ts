import { beforeEach, describe, expect, it, vi } from "vitest";

const KEY_A = "YGIGZeZ+dHcLzIGbTw8jcRoq/+FSc4TIL+NQqw5yXUA=";
const KEY_B = "1B2vQY0m5m8b8f3H8sZ0y7m8L8x7q6b1c2d3e4f5g6A=";

/**
 * Rotação de `ENCRYPTION_KEY` sem downtime (7.7) — precisa reimportar
 * `./crypto` com `serverEnv` mockado diferente em cada fase (uma chave
 * "atual" gerando um payload legado, outra consumindo esse payload já com a
 * chave nova + a antiga como `ENCRYPTION_KEY_PREVIOUS`), por isso
 * `vi.resetModules()`/`vi.doMock` em vez do `vi.mock` hoisted de
 * `crypto.test.ts`.
 */
async function loadCrypto(env: { ENCRYPTION_KEY: string; ENCRYPTION_KEY_PREVIOUS?: string }) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({ serverEnv: env }));
  return import("./crypto");
}

beforeEach(() => {
  vi.resetModules();
});

describe("rotação de ENCRYPTION_KEY", () => {
  it("payload criptografado com a chave antiga ainda decodifica quando ela vira ENCRYPTION_KEY_PREVIOUS", async () => {
    const oldCrypto = await loadCrypto({ ENCRYPTION_KEY: KEY_B });
    const legacyPayload = oldCrypto.encrypt("token-oauth-antigo");

    const newCrypto = await loadCrypto({ ENCRYPTION_KEY: KEY_A, ENCRYPTION_KEY_PREVIOUS: KEY_B });
    expect(newCrypto.decrypt(legacyPayload)).toBe("token-oauth-antigo");
  });

  it("encrypt() sempre usa a chave atual, nunca a anterior", async () => {
    const crypto = await loadCrypto({ ENCRYPTION_KEY: KEY_A, ENCRYPTION_KEY_PREVIOUS: KEY_B });
    const payload = crypto.encrypt("texto novo");

    const onlyKeyA = await loadCrypto({ ENCRYPTION_KEY: KEY_A });
    expect(onlyKeyA.decrypt(payload)).toBe("texto novo");
  });

  it("sem ENCRYPTION_KEY_PREVIOUS configurada, um payload da chave antiga não decodifica (comportamento de antes, sem regressão)", async () => {
    const oldCrypto = await loadCrypto({ ENCRYPTION_KEY: KEY_B });
    const legacyPayload = oldCrypto.encrypt("token-oauth-antigo");

    const newCrypto = await loadCrypto({ ENCRYPTION_KEY: KEY_A });
    expect(() => newCrypto.decrypt(legacyPayload)).toThrow();
  });

  it("wasEncryptedWithPreviousKey: true só pra payload que só bate com a chave anterior", async () => {
    const oldCrypto = await loadCrypto({ ENCRYPTION_KEY: KEY_B });
    const legacyPayload = oldCrypto.encrypt("token-oauth-antigo");

    const crypto = await loadCrypto({ ENCRYPTION_KEY: KEY_A, ENCRYPTION_KEY_PREVIOUS: KEY_B });
    const freshPayload = crypto.encrypt("token novo");

    expect(crypto.wasEncryptedWithPreviousKey(legacyPayload)).toBe(true);
    expect(crypto.wasEncryptedWithPreviousKey(freshPayload)).toBe(false);
  });
});
