import { createHash, createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  serverEnv: { ENCRYPTION_KEY: "YGIGZeZ+dHcLzIGbTw8jcRoq/+FSc4TIL+NQqw5yXUA=" },
}));

const { decrypt, encrypt, hmacSha256Hex, safeEqual, sha256Hex } = await import("./crypto");

describe("encrypt/decrypt (AES-256-GCM)", () => {
  it("ida e volta preserva o texto original", () => {
    const plain = "token-oauth-de-verdade-com-acentuação-e-tudo-çãõ";
    const encrypted = encrypt(plain);
    expect(decrypt(encrypted)).toBe(plain);
  });

  it("o payload criptografado tem o formato iv.authTag.ciphertext (3 partes em base64)", () => {
    const encrypted = encrypt("qualquer coisa");
    const parts = encrypted.split(".");
    expect(parts).toHaveLength(3);
    for (const part of parts) expect(() => Buffer.from(part, "base64")).not.toThrow();
  });

  it("duas chamadas com o mesmo texto produzem payloads diferentes (IV aleatório)", () => {
    const a = encrypt("mesmo texto");
    const b = encrypt("mesmo texto");
    expect(a).not.toBe(b);
  });

  it("payload adulterado (ciphertext) lança erro — GCM detecta a violação de integridade", () => {
    const [iv, authTag] = encrypt("segredo").split(".");
    const tampered = `${iv}.${authTag}.${Buffer.from("outracoisa").toString("base64")}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("payload adulterado (authTag) lança erro", () => {
    const [iv, , ciphertext] = encrypt("segredo").split(".");
    const fakeAuthTag = Buffer.alloc(16, 1).toString("base64");
    expect(() => decrypt(`${iv}.${fakeAuthTag}.${ciphertext}`)).toThrow();
  });

  it("payload em formato inválido (sem 3 partes) lança erro", () => {
    expect(() => decrypt("so-uma-parte")).toThrow();
  });
});

describe("sha256Hex", () => {
  it("calcula o sha256 em hex de um valor conhecido", () => {
    const expected = createHash("sha256").update("hub").digest("hex");
    expect(sha256Hex("hub")).toBe(expected);
  });

  it("mesmo valor sempre produz o mesmo hash (determinístico, ao contrário de encrypt)", () => {
    expect(sha256Hex("mesmo valor")).toBe(sha256Hex("mesmo valor"));
  });
});

describe("safeEqual", () => {
  it("reexporta timingSafeEqualStrings (2.2) — mesma comparação em tempo constante", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });
});

describe("hmacSha256Hex", () => {
  it("calcula o HMAC-SHA256 em hex do segredo e corpo dados", () => {
    const expected = createHmac("sha256", "meu-segredo").update("corpo-da-mensagem").digest("hex");
    expect(hmacSha256Hex("meu-segredo", "corpo-da-mensagem")).toBe(expected);
  });

  it("segredos diferentes produzem assinaturas diferentes pro mesmo corpo", () => {
    expect(hmacSha256Hex("segredo-a", "corpo")).not.toBe(hmacSha256Hex("segredo-b", "corpo"));
  });
});
