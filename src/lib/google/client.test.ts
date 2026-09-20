import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/crypto", () => ({
  encrypt: (value: string) => `enc(${value})`,
  decrypt: (value: string) => value.replace(/^enc\(/, "").replace(/\)$/, ""),
}));

const refreshAccessTokenMock = vi.fn();
vi.mock("./oauth", () => ({ refreshAccessToken: refreshAccessTokenMock }));

const getOwnerNotificationPreferencesMock = vi.fn();
vi.mock("@/features/settings/queries", () => ({ getOwnerNotificationPreferences: getOwnerNotificationPreferencesMock }));

const notifyOwnerMock = vi.fn();
vi.mock("@/lib/messaging/notify-owner", () => ({ notifyOwner: notifyOwnerMock }));

const { getAccessToken, GoogleConnectionNotFoundError, GoogleConnectionRevokedError } = await import("./client");

function fakeSupabase(connection: Record<string, unknown> | null) {
  const updates: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: connection, error: null }) }) }),
      update: (values: Record<string, unknown>) => {
        updates.push(values);
        return {
          eq: () => ({
            select: () => ({
              maybeSingle: () => Promise.resolve({ data: { owner_id: "owner-1", google_email: "dono@gmail.com" } }),
            }),
          }),
        };
      },
    }),
  };
  return { client: client as never, updates };
}

describe("getAccessToken", () => {
  beforeEach(() => {
    refreshAccessTokenMock.mockReset();
    getOwnerNotificationPreferencesMock.mockReset().mockResolvedValue({
      remindersPersonal: true,
      shareComments: true,
      jobFailures: true,
      googleReconnect: true,
    });
    notifyOwnerMock.mockReset();
  });

  it("devolve o access token direto quando ainda não está perto de expirar", async () => {
    const farFuture = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { client } = fakeSupabase({
      status: "active",
      refresh_token_encrypted: "enc(refresh)",
      access_token_encrypted: "enc(valid-token)",
      access_token_expires_at: farFuture,
    });

    await expect(getAccessToken(client, "conn-1")).resolves.toBe("valid-token");
    expect(refreshAccessTokenMock).not.toHaveBeenCalled();
  });

  it("renova quando faltam menos de 5 min pra expirar, e salva o novo token criptografado", async () => {
    const almostExpired = new Date(Date.now() + 60 * 1000).toISOString();
    const { client, updates } = fakeSupabase({
      status: "active",
      refresh_token_encrypted: "enc(refresh)",
      access_token_encrypted: "enc(old-token)",
      access_token_expires_at: almostExpired,
    });
    refreshAccessTokenMock.mockResolvedValue({ accessToken: "new-token", refreshToken: null, expiresInSeconds: 3600 });

    await expect(getAccessToken(client, "conn-1")).resolves.toBe("new-token");
    expect(refreshAccessTokenMock).toHaveBeenCalledWith("refresh");
    expect(updates[0]).toMatchObject({ access_token_encrypted: "enc(new-token)" });
  });

  it("renova quando nunca teve access token salvo (sem access_token_expires_at)", async () => {
    const { client } = fakeSupabase({
      status: "active",
      refresh_token_encrypted: "enc(refresh)",
      access_token_encrypted: null,
      access_token_expires_at: null,
    });
    refreshAccessTokenMock.mockResolvedValue({ accessToken: "brand-new", refreshToken: null, expiresInSeconds: 3600 });

    await expect(getAccessToken(client, "conn-1")).resolves.toBe("brand-new");
  });

  it("marca a conexão como revogada e lança quando o Google responde invalid_grant", async () => {
    const almostExpired = new Date(Date.now() + 1000).toISOString();
    const { client, updates } = fakeSupabase({
      status: "active",
      refresh_token_encrypted: "enc(refresh)",
      access_token_encrypted: "enc(old)",
      access_token_expires_at: almostExpired,
    });
    const invalidGrantError = new Error("Token expirado.");
    invalidGrantError.name = "invalid_grant";
    refreshAccessTokenMock.mockRejectedValue(invalidGrantError);

    await expect(getAccessToken(client, "conn-1")).rejects.toThrow(GoogleConnectionRevokedError);
    expect(updates[0]).toMatchObject({ status: "revoked" });
    expect(notifyOwnerMock).toHaveBeenCalledWith("owner-1", expect.objectContaining({ title: expect.any(String) }));
  });

  it("marca revogada mas não avisa quando o dono desligou 'reconexão do Google'", async () => {
    getOwnerNotificationPreferencesMock.mockResolvedValue({
      remindersPersonal: true,
      shareComments: true,
      jobFailures: true,
      googleReconnect: false,
    });
    const almostExpired = new Date(Date.now() + 1000).toISOString();
    const { client } = fakeSupabase({
      status: "active",
      refresh_token_encrypted: "enc(refresh)",
      access_token_encrypted: "enc(old)",
      access_token_expires_at: almostExpired,
    });
    const invalidGrantError = new Error("Token expirado.");
    invalidGrantError.name = "invalid_grant";
    refreshAccessTokenMock.mockRejectedValue(invalidGrantError);

    await expect(getAccessToken(client, "conn-1")).rejects.toThrow(GoogleConnectionRevokedError);
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("lança GoogleConnectionNotFoundError quando a conexão não existe", async () => {
    const { client } = fakeSupabase(null);
    await expect(getAccessToken(client, "conn-inexistente")).rejects.toThrow(GoogleConnectionNotFoundError);
  });

  it("lança GoogleConnectionRevokedError quando a conexão já não está ativa", async () => {
    const { client } = fakeSupabase({ status: "revoked", refresh_token_encrypted: "enc(refresh)", access_token_encrypted: null, access_token_expires_at: null });
    await expect(getAccessToken(client, "conn-1")).rejects.toThrow(GoogleConnectionRevokedError);
  });
});
