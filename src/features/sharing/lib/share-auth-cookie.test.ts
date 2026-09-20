import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ serverEnv: { ENCRYPTION_KEY: "dGVzdC1rZXktMzItYnl0ZXMtbG9uZy1mb3ItaG1hYyE=" } }));

const { shareAuthCookieName, signShareAuthCookie, verifyShareAuthCookie } = await import("./share-auth-cookie");

describe("share auth cookie", () => {
  it("nome do cookie é específico por link", () => {
    expect(shareAuthCookieName("link-1")).toBe("share_auth_link-1");
    expect(shareAuthCookieName("link-2")).toBe("share_auth_link-2");
  });

  it("assinatura certa verifica", () => {
    const signed = signShareAuthCookie("link-1");
    expect(verifyShareAuthCookie("link-1", signed)).toBe(true);
  });

  it("assinatura de outro link não verifica (não dá pra reusar o cookie de um link no outro)", () => {
    const signed = signShareAuthCookie("link-1");
    expect(verifyShareAuthCookie("link-2", signed)).toBe(false);
  });

  it("sem cookie: false", () => {
    expect(verifyShareAuthCookie("link-1", undefined)).toBe(false);
  });

  it("cookie adulterado: false", () => {
    expect(verifyShareAuthCookie("link-1", "valor-qualquer")).toBe(false);
  });
});
