import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  serverEnv: { APP_URL: "https://hub.example", OWNER_EMAIL: "dono@example.com", ENCRYPTION_KEY: "dGVzdC1rZXktMzItYnl0ZXMtbG9uZy1mb3ItaG1hYyE=" },
}));

const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

const maybeSingleMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) }),
  }),
}));

const { ResendEmailChannel } = await import("./resend-email");

describe("ResendEmailChannel", () => {
  beforeEach(() => {
    sendMock.mockReset();
    maybeSingleMock.mockReset();
  });

  it("envia com from/to/subject/reply_to e devolve o providerMessageId", async () => {
    maybeSingleMock.mockResolvedValue({ data: { contact_id: "contact-1" } });
    sendMock.mockResolvedValue({ data: { id: "email-123" }, error: null });

    const channel = new ResendEmailChannel("re_key", "Hub <avisos@hub.example>");
    const result = await channel.send({ deliveryId: "delivery-1", to: "bia@example.com", text: "Oi Bia, sua consulta é amanhã.", subject: "Consulta" });

    expect(result).toEqual({ providerMessageId: "email-123" });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Hub <avisos@hub.example>",
        to: "bia@example.com",
        subject: "Consulta",
        replyTo: "dono@example.com",
      }),
    );
  });

  it("inclui o rodapé de opt-out quando a entrega tem contact_id", async () => {
    maybeSingleMock.mockResolvedValue({ data: { contact_id: "contact-1" } });
    sendMock.mockResolvedValue({ data: { id: "email-123" }, error: null });

    const channel = new ResendEmailChannel("re_key", "Hub <avisos@hub.example>");
    await channel.send({ deliveryId: "delivery-1", to: "bia@example.com", text: "Oi Bia" });

    const html = sendMock.mock.calls[0]![0].html as string;
    expect(html).toContain("/p/opt-out/");
    expect(html).toContain("Não quer mais receber?");
  });

  it("sem contact_id (destinatário é o dono): não inclui rodapé de opt-out", async () => {
    maybeSingleMock.mockResolvedValue({ data: { contact_id: null } });
    sendMock.mockResolvedValue({ data: { id: "email-123" }, error: null });

    const channel = new ResendEmailChannel("re_key", "Hub <avisos@hub.example>");
    await channel.send({ deliveryId: "delivery-1", to: "dono@example.com", text: "Lembrete pessoal" });

    const html = sendMock.mock.calls[0]![0].html as string;
    expect(html).not.toContain("/p/opt-out/");
  });

  it("sem subject: usa 'Lembrete' como padrão", async () => {
    maybeSingleMock.mockResolvedValue({ data: null });
    sendMock.mockResolvedValue({ data: { id: "email-123" }, error: null });

    const channel = new ResendEmailChannel("re_key", "Hub <avisos@hub.example>");
    await channel.send({ deliveryId: "delivery-1", to: "bia@example.com", text: "Oi" });

    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ subject: "Lembrete" }));
  });

  it("erro da Resend: lança com a mensagem", async () => {
    maybeSingleMock.mockResolvedValue({ data: { contact_id: "contact-1" } });
    sendMock.mockResolvedValue({ data: null, error: { message: "domínio não verificado" } });

    const channel = new ResendEmailChannel("re_key", "Hub <avisos@hub.example>");
    await expect(channel.send({ deliveryId: "delivery-1", to: "bia@example.com", text: "Oi" })).rejects.toThrow("domínio não verificado");
  });
});
