import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminClient } from "./supabase/admin";
import { hashToken, verifyApiToken, verifyApiTokenAnyScope } from "./tokens";

vi.mock("./supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

interface FakeTokenRow {
  id: string;
  owner_id: string;
  scopes: string[];
  revoked_at: string | null;
  expires_at: string | null;
}

function mockAdmin(row: FakeTokenRow | null) {
  vi.mocked(createAdminClient).mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: null }),
        }),
      }),
      update: () => ({
        eq: async () => ({ data: null, error: null }),
      }),
    }),
  } as unknown as ReturnType<typeof createAdminClient>);
}

function requestWithToken(token: string | null): Request {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request("http://localhost/api/capture", { headers });
}

describe("hashToken", () => {
  it("é determinístico e sensível ao valor do token", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });

  it("gera um hex de 64 caracteres (sha256)", () => {
    expect(hashToken("qualquer coisa")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("verifyApiToken", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sem cabeçalho Authorization retorna null", async () => {
    const result = await verifyApiToken(requestWithToken(null), "capture");
    expect(result).toBeNull();
  });

  it("token que não existe no banco retorna null", async () => {
    mockAdmin(null);
    const result = await verifyApiToken(requestWithToken("hub_inexistente"), "capture");
    expect(result).toBeNull();
  });

  it("token revogado retorna null", async () => {
    mockAdmin({
      id: "tok-1",
      owner_id: "user-1",
      scopes: ["capture"],
      revoked_at: new Date().toISOString(),
      expires_at: null,
    });
    const result = await verifyApiToken(requestWithToken("hub_valido"), "capture");
    expect(result).toBeNull();
  });

  it("token expirado retorna null", async () => {
    mockAdmin({
      id: "tok-1",
      owner_id: "user-1",
      scopes: ["capture"],
      revoked_at: null,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    const result = await verifyApiToken(requestWithToken("hub_valido"), "capture");
    expect(result).toBeNull();
  });

  it("token sem o escopo pedido retorna null", async () => {
    mockAdmin({
      id: "tok-1",
      owner_id: "user-1",
      scopes: ["mcp"],
      revoked_at: null,
      expires_at: null,
    });
    const result = await verifyApiToken(requestWithToken("hub_valido"), "capture");
    expect(result).toBeNull();
  });

  it("token válido com o escopo certo retorna o dono e o id do token", async () => {
    mockAdmin({
      id: "tok-1",
      owner_id: "user-1",
      scopes: ["capture", "mcp"],
      revoked_at: null,
      expires_at: null,
    });
    const result = await verifyApiToken(requestWithToken("hub_valido"), "capture");
    expect(result).toEqual({ ownerId: "user-1", tokenId: "tok-1" });
  });
});

describe("verifyApiTokenAnyScope", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sem cabeçalho Authorization retorna null", async () => {
    const result = await verifyApiTokenAnyScope(requestWithToken(null), ["mcp:read", "mcp:write", "finance:read"]);
    expect(result).toBeNull();
  });

  it("token sem nenhum dos escopos pedidos retorna null (6.9: só mcp:read/mcp:write/finance:read abrem o MCP)", async () => {
    mockAdmin({ id: "tok-1", owner_id: "user-1", scopes: ["capture"], revoked_at: null, expires_at: null });
    const result = await verifyApiTokenAnyScope(requestWithToken("hub_valido"), ["mcp:read", "mcp:write", "finance:read"]);
    expect(result).toBeNull();
  });

  it("token revogado retorna null mesmo com o escopo certo", async () => {
    mockAdmin({ id: "tok-1", owner_id: "user-1", scopes: ["mcp:read"], revoked_at: new Date().toISOString(), expires_at: null });
    const result = await verifyApiTokenAnyScope(requestWithToken("hub_valido"), ["mcp:read"]);
    expect(result).toBeNull();
  });

  it("token expirado retorna null", async () => {
    mockAdmin({ id: "tok-1", owner_id: "user-1", scopes: ["mcp:read"], revoked_at: null, expires_at: new Date(Date.now() - 1000).toISOString() });
    const result = await verifyApiTokenAnyScope(requestWithToken("hub_valido"), ["mcp:read"]);
    expect(result).toBeNull();
  });

  it("basta ter um dos escopos pedidos — devolve todos os escopos do token, não só o pedido", async () => {
    mockAdmin({ id: "tok-1", owner_id: "user-1", scopes: ["mcp:write"], revoked_at: null, expires_at: null });
    const result = await verifyApiTokenAnyScope(requestWithToken("hub_valido"), ["mcp:read", "mcp:write", "finance:read"]);
    expect(result).toEqual({ ownerId: "user-1", tokenId: "tok-1", scopes: ["mcp:write"] });
  });

  it("token com todos os três escopos MCP devolve a lista inteira", async () => {
    mockAdmin({ id: "tok-1", owner_id: "user-1", scopes: ["mcp:read", "mcp:write", "finance:read"], revoked_at: null, expires_at: null });
    const result = await verifyApiTokenAnyScope(requestWithToken("hub_valido"), ["mcp:read", "mcp:write", "finance:read"]);
    expect(result).toEqual({ ownerId: "user-1", tokenId: "tok-1", scopes: ["mcp:read", "mcp:write", "finance:read"] });
  });
});
