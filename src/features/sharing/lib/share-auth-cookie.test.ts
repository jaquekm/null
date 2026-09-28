import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ serverEnv: { ENCRYPTION_KEY: "dGVzdC1rZXktMzItYnl0ZXMtbG9uZy1mb3ItaG1hYyE=" } }));

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined) }) }));

const { isShareLinkUnlocked, shareAuthCookieName, signShareAuthCookie, verifyShareAuthCookie } = await import("./share-auth-cookie");

describe("isShareLinkUnlocked (página e rotas de arquivo /p/[token]/...)", () => {
  it("link sem senha: sempre liberado", async () => {
    cookieJar.clear();
    expect(await isShareLinkUnlocked({ id: "link-1", passwordHash: null })).toBe(true);
  });

  it("link com senha e sem cookie: bloqueado (o caso do PDF/recibo/anexo baixado sem digitar a senha)", async () => {
    cookieJar.clear();
    expect(await isShareLinkUnlocked({ id: "link-1", passwordHash: "hash" })).toBe(false);
  });

  it("link com senha e cookie assinado deste link: liberado", async () => {
    cookieJar.clear();
    cookieJar.set(shareAuthCookieName("link-1"), signShareAuthCookie("link-1"));
    expect(await isShareLinkUnlocked({ id: "link-1", passwordHash: "hash" })).toBe(true);
  });

  it("cookie de outro link não libera", async () => {
    cookieJar.clear();
    cookieJar.set(shareAuthCookieName("link-1"), signShareAuthCookie("link-2"));
    expect(await isShareLinkUnlocked({ id: "link-1", passwordHash: "hash" })).toBe(false);
  });
});

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
