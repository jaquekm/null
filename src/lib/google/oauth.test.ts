import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  serverEnv: { APP_URL: "https://hub.example", GOOGLE_CLIENT_ID: "client-id", GOOGLE_CLIENT_SECRET: "client-secret" },
}));

const { buildAuthorizationUrl, exchangeAuthorizationCode, fetchGoogleUserEmail, getGoogleRedirectUri, GOOGLE_SCOPES, refreshAccessToken, revokeGoogleToken } =
  await import("./oauth");

describe("getGoogleRedirectUri", () => {
  it("deriva do APP_URL", () => {
    expect(getGoogleRedirectUri()).toBe("https://hub.example/api/google/callback");
  });
});

describe("buildAuthorizationUrl", () => {
  it("inclui os parâmetros obrigatórios do fluxo com PKCE e access offline", () => {
    const url = new URL(buildAuthorizationUrl({ state: "s1", codeChallenge: "c1" }));

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("https://hub.example/api/google/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("s1");
    expect(url.searchParams.get("code_challenge")).toBe("c1");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe(GOOGLE_SCOPES.join(" "));
  });
});

describe("exchangeAuthorizationCode / refreshAccessToken", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("troca o código por tokens com grant_type=authorization_code", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ access_token: "at", refresh_token: "rt", expires_in: 3600 }),
    });

    const tokens = await exchangeAuthorizationCode({ code: "abc", codeVerifier: "verifier" });

    expect(tokens).toEqual({ accessToken: "at", refreshToken: "rt", expiresInSeconds: 3600 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("abc");
    expect(body.get("code_verifier")).toBe("verifier");
    expect(body.get("client_secret")).toBe("client-secret");
  });

  it("renova com grant_type=refresh_token e sem code_verifier", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ access_token: "at2", expires_in: 3600 }),
    });

    const tokens = await refreshAccessToken("rt");

    expect(tokens).toEqual({ accessToken: "at2", refreshToken: null, expiresInSeconds: 3600 });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rt");
  });

  it("lança com o nome do erro do Google (ex.: invalid_grant)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "invalid_grant", error_description: "Token expirado ou revogado." }),
    });

    await expect(refreshAccessToken("rt-revogado")).rejects.toMatchObject({ name: "invalid_grant" });
  });
});

describe("fetchGoogleUserEmail", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("busca o e-mail no endpoint UserInfo com o access token", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ email: "dono@example.com" }) });

    await expect(fetchGoogleUserEmail("at")).resolves.toBe("dono@example.com");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openidconnect.googleapis.com/v1/userinfo");
    expect(init.headers).toMatchObject({ authorization: "Bearer at" });
  });

  it("lança se a resposta não tiver e-mail", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await expect(fetchGoogleUserEmail("at")).rejects.toThrow();
  });
});

describe("revokeGoogleToken", () => {
  it("chama o endpoint de revogação com o token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await revokeGoogleToken("some-token");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/revoke?token=some-token");
    expect(init.method).toBe("POST");
  });
});
