import { beforeEach, describe, expect, it, vi } from "vitest";

const getMessageChannelMock = vi.fn();
vi.mock(".", () => ({ getMessageChannel: getMessageChannelMock }));

const { notifyOwner } = await import("./notify-owner");

describe("notifyOwner", () => {
  beforeEach(() => {
    getMessageChannelMock.mockReset();
  });

  it("sem canal push configurado: não lança, não faz nada", async () => {
    getMessageChannelMock.mockReturnValue(null);
    await expect(notifyOwner("owner-1", { title: "Oi", text: "Mensagem" })).resolves.toBeUndefined();
  });

  it("com canal: manda pro owner_id com título/texto", async () => {
    const send = vi.fn().mockResolvedValue({});
    getMessageChannelMock.mockReturnValue({ send });

    await notifyOwner("owner-1", { title: "Google desconectado", text: "Reconecte." });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner-1", text: "Reconecte.", subject: "Google desconectado" }),
    );
  });

  it("envio falha: não lança (melhor esforço)", async () => {
    const send = vi.fn().mockRejectedValue(new Error("sem dispositivo"));
    getMessageChannelMock.mockReturnValue({ send });

    await expect(notifyOwner("owner-1", { title: "Oi", text: "x" })).resolves.toBeUndefined();
  });
});
