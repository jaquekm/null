import { beforeEach, describe, expect, it, vi } from "vitest";
import { hmacSha256Hex } from "@/lib/crypto";
import { N8nWhatsAppChannel } from "./n8n-whatsapp";

describe("N8nWhatsAppChannel", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("faz POST com o corpo certo e a assinatura X-Hub-Signature correta", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const channel = new N8nWhatsAppChannel("https://n8n.example/webhook/whatsapp", "segredo");
    const result = await channel.send({ deliveryId: "delivery-1", to: "+5511999998888", text: "Oi Bia" });

    expect(result).toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://n8n.example/webhook/whatsapp");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");

    const expectedBody = JSON.stringify({ deliveryId: "delivery-1", to: "+5511999998888", text: "Oi Bia", template: null });
    expect(init.body).toBe(expectedBody);
    expect(init.headers["X-Hub-Signature"]).toBe(hmacSha256Hex("segredo", expectedBody));
  });

  it("inclui o template quando presente", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const channel = new N8nWhatsAppChannel("https://n8n.example/webhook/whatsapp", "segredo");
    await channel.send({
      deliveryId: "delivery-1",
      to: "+5511999998888",
      text: "Oi Bia",
      template: { name: "lembrete_generico", language: "pt_BR", variables: ["Bia", "amanhã"] },
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.template).toEqual({ name: "lembrete_generico", language: "pt_BR", variables: ["Bia", "amanhã"] });
  });

  it("resposta não-ok do N8N: lança", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const channel = new N8nWhatsAppChannel("https://n8n.example/webhook/whatsapp", "segredo");
    await expect(channel.send({ deliveryId: "delivery-1", to: "+5511999998888", text: "Oi" })).rejects.toThrow("503");
  });
});
