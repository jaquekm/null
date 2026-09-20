import { describe, expect, it } from "vitest";
import { computeCodeChallengeS256, generateCodeVerifier, generateState } from "./pkce";

describe("computeCodeChallengeS256", () => {
  it("bate com o vetor de exemplo do RFC 7636 (Apêndice B)", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(computeCodeChallengeS256(verifier)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("é determinístico pro mesmo verifier", () => {
    const verifier = generateCodeVerifier();
    expect(computeCodeChallengeS256(verifier)).toBe(computeCodeChallengeS256(verifier));
  });
});

describe("generateCodeVerifier", () => {
  it("gera um verifier dentro da faixa de tamanho do RFC 7636 (43-128 caracteres)", () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it("gera valores diferentes a cada chamada", () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });
});

describe("generateState", () => {
  it("gera valores diferentes a cada chamada", () => {
    expect(generateState()).not.toBe(generateState());
  });
});
