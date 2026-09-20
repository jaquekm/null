import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ serverEnv: { ENCRYPTION_KEY: "chave-de-teste" } }));

const { signOAuthStateCookie, verifyOAuthStateCookie } = await import("./state-cookie");

describe("signOAuthStateCookie / verifyOAuthStateCookie", () => {
  it("ida e volta: devolve o code_verifier quando o state bate", () => {
    const cookieValue = signOAuthStateCookie({ state: "s1", codeVerifier: "verifier-1" });
    expect(verifyOAuthStateCookie(cookieValue, "s1")).toEqual({ codeVerifier: "verifier-1" });
  });

  it("devolve null quando o cookie está ausente", () => {
    expect(verifyOAuthStateCookie(undefined, "s1")).toBeNull();
  });

  it("devolve null quando o state não bate (possível CSRF)", () => {
    const cookieValue = signOAuthStateCookie({ state: "s1", codeVerifier: "verifier-1" });
    expect(verifyOAuthStateCookie(cookieValue, "outro-state")).toBeNull();
  });

  it("devolve null quando a assinatura foi adulterada", () => {
    const cookieValue = signOAuthStateCookie({ state: "s1", codeVerifier: "verifier-1" });
    const [encoded] = cookieValue.split(".");
    expect(verifyOAuthStateCookie(`${encoded}.assinatura-forjada`, "s1")).toBeNull();
  });

  it("devolve null quando o payload foi adulterado (assinatura não bate mais)", () => {
    const cookieValue = signOAuthStateCookie({ state: "s1", codeVerifier: "verifier-1" });
    const [, signature] = cookieValue.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ state: "s1", codeVerifier: "outro-verifier" }), "utf8").toString("base64url");
    expect(verifyOAuthStateCookie(`${forgedPayload}.${signature}`, "s1")).toBeNull();
  });

  it("devolve null pra cookie em formato inválido", () => {
    expect(verifyOAuthStateCookie("nao-tem-ponto-separador", "s1")).toBeNull();
    expect(verifyOAuthStateCookie("naoehbase64valido!!!.assinatura", "s1")).toBeNull();
  });
});
