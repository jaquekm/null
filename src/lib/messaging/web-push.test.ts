import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeWebPushError extends Error {
  constructor(public statusCode: number) {
    super(`status ${statusCode}`);
  }
}

const setVapidDetailsMock = vi.fn();
const sendNotificationMock = vi.fn();
vi.mock("web-push", () => ({
  default: { setVapidDetails: setVapidDetailsMock, sendNotification: sendNotificationMock },
  WebPushError: FakeWebPushError,
}));

const selectEqMock = vi.fn();
const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "push_subscriptions") {
        return {
          select: () => ({ eq: selectEqMock }),
          delete: () => ({ eq: deleteEqMock }),
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  }),
}));

const { WebPushChannel } = await import("./web-push");

describe("WebPushChannel", () => {
  beforeEach(() => {
    setVapidDetailsMock.mockClear();
    sendNotificationMock.mockReset();
    selectEqMock.mockReset();
    deleteEqMock.mockClear();
  });

  it("configura os detalhes VAPID no construtor", () => {
    new WebPushChannel("mailto:dono@example.com", "pub-key", "priv-key");
    expect(setVapidDetailsMock).toHaveBeenCalledWith("mailto:dono@example.com", "pub-key", "priv-key");
  });

  it("sem nenhuma assinatura: lança", async () => {
    selectEqMock.mockResolvedValue({ data: [] });
    const channel = new WebPushChannel("mailto:dono@example.com", "pub-key", "priv-key");
    await expect(channel.send({ deliveryId: "d1", to: "owner-1", text: "Oi" })).rejects.toThrow("Nenhum dispositivo");
  });

  it("envia pra todas as assinaturas do dono", async () => {
    selectEqMock.mockResolvedValue({
      data: [
        { id: "sub-1", endpoint: "https://push.example/1", p256dh: "p1", auth: "a1" },
        { id: "sub-2", endpoint: "https://push.example/2", p256dh: "p2", auth: "a2" },
      ],
    });
    sendNotificationMock.mockResolvedValue({ statusCode: 201 });

    const channel = new WebPushChannel("mailto:dono@example.com", "pub-key", "priv-key");
    const result = await channel.send({ deliveryId: "d1", to: "owner-1", text: "Oi", subject: "Lembrete" });

    expect(result).toEqual({});
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
    expect(sendNotificationMock).toHaveBeenCalledWith(
      { endpoint: "https://push.example/1", keys: { p256dh: "p1", auth: "a1" } },
      JSON.stringify({ title: "Lembrete", body: "Oi", url: "/lembretes" }),
    );
  });

  it("assinatura expirada (404/410): remove do banco, mas continua as outras", async () => {
    selectEqMock.mockResolvedValue({
      data: [
        { id: "sub-1", endpoint: "https://push.example/1", p256dh: "p1", auth: "a1" },
        { id: "sub-2", endpoint: "https://push.example/2", p256dh: "p2", auth: "a2" },
      ],
    });
    sendNotificationMock.mockRejectedValueOnce(new FakeWebPushError(410)).mockResolvedValueOnce({ statusCode: 201 });

    const channel = new WebPushChannel("mailto:dono@example.com", "pub-key", "priv-key");
    const result = await channel.send({ deliveryId: "d1", to: "owner-1", text: "Oi" });

    expect(result).toEqual({});
    expect(deleteEqMock).toHaveBeenCalledWith("id", "sub-1");
  });

  it("todas as assinaturas falham: lança", async () => {
    selectEqMock.mockResolvedValue({ data: [{ id: "sub-1", endpoint: "https://push.example/1", p256dh: "p1", auth: "a1" }] });
    sendNotificationMock.mockRejectedValue(new Error("timeout"));

    const channel = new WebPushChannel("mailto:dono@example.com", "pub-key", "priv-key");
    await expect(channel.send({ deliveryId: "d1", to: "owner-1", text: "Oi" })).rejects.toThrow("Falha ao enviar");
  });
});
