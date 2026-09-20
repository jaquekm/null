import { beforeEach, describe, expect, it, vi } from "vitest";
import { hmacSha256Hex } from "@/lib/crypto";

vi.mock("@/lib/env", () => ({ serverEnv: { N8N_WEBHOOK_SECRET: "n8n-secret" } }));
const SECRET = "n8n-secret";

const contactUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const contactUpdateMock = vi.fn(() => ({ eq: contactUpdateEqMock }));
const deliveryUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const deliveryUpdateMock = vi.fn(() => ({ eq: deliveryUpdateEqMock }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "contacts") return { update: contactUpdateMock };
      if (table === "reminder_deliveries") return { update: deliveryUpdateMock };
      throw new Error(`tabela inesperada: ${table}`);
    },
  }),
}));

const { POST } = await import("./route");

function fakeRequest(body: string, signature?: string): Request {
  return new Request("https://hub.example/api/webhooks/messaging", {
    method: "POST",
    headers: signature !== undefined ? { "X-Hub-Signature": signature } : {},
    body,
  });
}

function signedRequest(payload: unknown): Request {
  const body = JSON.stringify(payload);
  return fakeRequest(body, hmacSha256Hex(SECRET, body));
}

describe("POST /api/webhooks/messaging", () => {
  beforeEach(() => {
    contactUpdateMock.mockClear();
    contactUpdateEqMock.mockClear();
    deliveryUpdateMock.mockClear();
    deliveryUpdateEqMock.mockClear();
  });

  it("sem assinatura: 401", async () => {
    const res = await POST(fakeRequest(JSON.stringify({ type: "opt_out", phone: "+5511999998888" })));
    expect(res.status).toBe(401);
  });

  it("assinatura errada: 401", async () => {
    const res = await POST(fakeRequest(JSON.stringify({ type: "opt_out", phone: "+5511999998888" }), "0".repeat(64)));
    expect(res.status).toBe(401);
  });

  it("JSON inválido (mesmo com assinatura certa do corpo): 400", async () => {
    const body = "isso não é json";
    const res = await POST(fakeRequest(body, hmacSha256Hex(SECRET, body)));
    expect(res.status).toBe(400);
  });

  it("payload que não bate com nenhum formato conhecido: 400", async () => {
    const res = await POST(signedRequest({ foo: "bar" }));
    expect(res.status).toBe(400);
  });

  it("opt-out: marca opted_out_at e desliga os dois opt-ins pelo telefone", async () => {
    const res = await POST(signedRequest({ type: "opt_out", phone: "+5511999998888" }));
    expect(res.status).toBe(200);
    expect(contactUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ whatsapp_opt_in: false, email_opt_in: false, opted_out_at: expect.any(String) }),
    );
    expect(contactUpdateEqMock).toHaveBeenCalledWith("phone_e164", "+5511999998888");
  });

  it("atualização de status de entrega: atualiza reminder_deliveries pelo deliveryId", async () => {
    const res = await POST(
      signedRequest({ deliveryId: "11111111-1111-4111-8111-111111111111", status: "delivered", providerMessageId: "wamid.123" }),
    );
    expect(res.status).toBe(200);
    expect(deliveryUpdateMock).toHaveBeenCalledWith({
      status: "delivered",
      provider_message_id: "wamid.123",
      error: null,
    });
    expect(deliveryUpdateEqMock).toHaveBeenCalledWith("id", "11111111-1111-4111-8111-111111111111");
  });

  it("atualização de status 'failed' com erro", async () => {
    const res = await POST(
      signedRequest({ deliveryId: "11111111-1111-4111-8111-111111111111", status: "failed", error: "número inválido" }),
    );
    expect(res.status).toBe(200);
    expect(deliveryUpdateMock).toHaveBeenCalledWith({ status: "failed", provider_message_id: null, error: "número inválido" });
  });
});
