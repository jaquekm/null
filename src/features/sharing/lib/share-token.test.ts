import { describe, expect, it } from "vitest";
import { generateShareToken, hashShareToken } from "./share-token";

describe("generateShareToken", () => {
  it("gera um token de 32 bytes em base64url", () => {
    const { token } = generateShareToken();
    // base64url de 32 bytes sem padding: 43 caracteres
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("prefix é o começo do token, nunca o token inteiro", () => {
    const { token, prefix } = generateShareToken();
    expect(token.startsWith(prefix)).toBe(true);
    expect(prefix.length).toBeLessThan(token.length);
  });

  it("hash bate com hashShareToken(token)", () => {
    const { token, hash } = generateShareToken();
    expect(hash).toBe(hashShareToken(token));
  });

  it("dois tokens gerados são diferentes", () => {
    const a = generateShareToken();
    const b = generateShareToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });
});
