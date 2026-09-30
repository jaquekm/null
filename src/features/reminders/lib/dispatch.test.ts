import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Tables } from "@/lib/supabase/database.types";

vi.mock("@/lib/env", () => ({ serverEnv: { OWNER_EMAIL: "dono@example.com" } }));

const getMessageChannelMock = vi.fn();
vi.mock("@/lib/messaging", () => ({ getMessageChannel: getMessageChannelMock }));

const { dispatchReminderOccurrence } = await import("./dispatch");

type ReminderRow = Tables<"reminders">;

function fakeReminder(overrides: Partial<ReminderRow> = {}): ReminderRow {
  return {
    id: "rem-1",
    owner_id: "owner-1",
    title: "Consulta",
    message_template: "Oi {{nome}}, sua consulta é {{data}} às {{hora}}.",
    channel: "whatsapp",
    recipient_type: "contacts",
    contact_ids: ["contact-1"],
    send_at: "2026-01-15T15:00:00.000Z", // 12:00 em São Paulo
    rrule: null,
    timezone: "America/Sao_Paulo",
    ends_at: null,
    status: "scheduled",
    source_type: null,
    source_id: null,
    rule_id: null,
    item_id: null,
    variables: {},
    last_sent_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

interface FakeState {
  contacts?: Record<string, unknown>[];
  deliveriesLast24h?: number;
  insertError?: { code: string } | null;
  item?: { status: string; deleted_at: string | null } | null;
  preferences?: Record<string, unknown>;
}

const optedInContact = {
  id: "contact-1",
  name: "Beatriz Souza",
  nickname: "Bia",
  phone_e164: "+5511999998888",
  email: null,
  preferred_channel: "whatsapp",
  whatsapp_opt_in: true,
  email_opt_in: false,
  opted_out_at: null,
};

function fakeSupabase(state: FakeState = {}) {
  const inserted: Record<string, unknown>[] = [];
  const deliveryUpdates: Record<string, unknown>[] = [];
  const reminderUpdates: Record<string, unknown>[] = [];

  const client = {
    from: (table: string) => {
      if (table === "items") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.item ?? null }) }) }) };
      }
      if (table === "user_settings") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { preferences: state.preferences ?? {} } }) }) }) };
      }
      if (table === "contacts") {
        return { select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: state.contacts ?? [] }) }) }) };
      }
      if (table === "reminder_deliveries") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  in: () => Promise.resolve({ data: Array.from({ length: state.deliveriesLast24h ?? 0 }) }),
                }),
              }),
            }),
          }),
          insert: (row: Record<string, unknown>) => {
            inserted.push(row);
            return {
              select: () => ({
                single: () =>
                  state.insertError
                    ? Promise.resolve({ data: null, error: state.insertError })
                    : Promise.resolve({ data: { id: `delivery-${inserted.length}` }, error: null }),
              }),
            };
          },
          update: (values: Record<string, unknown>) => {
            deliveryUpdates.push(values);
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      }
      if (table === "reminders") {
        return {
          update: (values: Record<string, unknown>) => {
            reminderUpdates.push(values);
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
  return { client: client as never, inserted, deliveryUpdates, reminderUpdates };
}

describe("dispatchReminderOccurrence — WhatsApp pra mim (9.8)", () => {
  beforeEach(() => {
    getMessageChannelMock.mockReset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-15T15:00:30.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("com o número salvo em Notificações: manda pro WhatsApp da dona", async () => {
    const send = vi.fn().mockResolvedValue({});
    getMessageChannelMock.mockReturnValue({ send });
    const { client, inserted } = fakeSupabase({ preferences: { ownerWhatsapp: "+5511988887777" } });

    const result = await dispatchReminderOccurrence(client, "owner-1", fakeReminder({ recipient_type: "me", contact_ids: [], channel: "whatsapp", message_template: "Conta vence amanhã" }));

    expect(result.sent).toBe(1);
    expect(inserted[0]).toMatchObject({ channel: "whatsapp", destination: "+5511988887777", status: "pending" });
    expect(getMessageChannelMock).toHaveBeenCalledWith("whatsapp");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "+5511988887777", text: "Conta vence amanhã" }));
  });

  it("sem número salvo: pula sem destino, não tenta mandar", async () => {
    const send = vi.fn();
    getMessageChannelMock.mockReturnValue({ send });
    const { client, inserted } = fakeSupabase({ preferences: {} });

    const result = await dispatchReminderOccurrence(client, "owner-1", fakeReminder({ recipient_type: "me", contact_ids: [], channel: "whatsapp" }));

    expect(result.skipped).toBe(1);
    expect(inserted[0]).toMatchObject({ channel: "whatsapp", destination: null, status: "skipped" });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("dispatchReminderOccurrence", () => {
  beforeEach(() => {
    getMessageChannelMock.mockReset();
    getMessageChannelMock.mockReturnValue(null);
    // O job roda logo depois da ocorrência padrão (`send_at` do fakeReminder).
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-15T15:00:30.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("contato com opt-in e telefone: entrega pendente, depois 'failed' (canal ainda não configurado, 3.9)", async () => {
    const { client, inserted, deliveryUpdates, reminderUpdates } = fakeSupabase({
      contacts: [
        {
          id: "contact-1",
          name: "Beatriz Souza",
          nickname: "Bia",
          phone_e164: "+5511999998888",
          email: null,
          preferred_channel: "whatsapp",
          whatsapp_opt_in: true,
          email_opt_in: false,
          opted_out_at: null,
        },
      ],
    });

    const result = await dispatchReminderOccurrence(client, "owner-1", fakeReminder());

    expect(result).toEqual({ sent: 0, failed: 1, skipped: 0 });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      channel: "whatsapp",
      destination: "+5511999998888",
      rendered_message: "Oi Bia, sua consulta é 15/01/2026 às 12:00.",
      status: "pending",
      skip_reason: null,
    });
    expect(deliveryUpdates[0]).toEqual({ status: "failed", error: "Canal não configurado." });
    // sem rrule: conclui
    expect(reminderUpdates[0]).toMatchObject({ status: "completed" });
  });

  it("contato sem opt-in: entrega 'skipped' com motivo opt_out, nada é enviado", async () => {
    const { client, inserted, deliveryUpdates } = fakeSupabase({
      contacts: [
        {
          id: "contact-1",
          name: "Beatriz Souza",
          nickname: null,
          phone_e164: "+5511999998888",
          email: null,
          preferred_channel: "whatsapp",
          whatsapp_opt_in: false,
          email_opt_in: false,
          opted_out_at: null,
        },
      ],
    });

    const result = await dispatchReminderOccurrence(client, "owner-1", fakeReminder());

    expect(result).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(inserted[0]).toMatchObject({ status: "skipped", skip_reason: "opt_out" });
    expect(deliveryUpdates).toHaveLength(0); // não tenta enviar
  });

  it("contato sem telefone (canal whatsapp): no_destination", async () => {
    const { client, inserted } = fakeSupabase({
      contacts: [
        {
          id: "contact-1",
          name: "Beatriz Souza",
          nickname: null,
          phone_e164: null,
          email: null,
          preferred_channel: "whatsapp",
          whatsapp_opt_in: true,
          email_opt_in: false,
          opted_out_at: null,
        },
      ],
    });

    const result = await dispatchReminderOccurrence(client, "owner-1", fakeReminder());
    expect(result).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(inserted[0]).toMatchObject({ skip_reason: "no_destination" });
  });

  it("provedor configurado: envia e marca 'sent' com provider_message_id", async () => {
    getMessageChannelMock.mockReturnValue({ send: vi.fn().mockResolvedValue({ providerMessageId: "wamid.123" }) });
    const { client, deliveryUpdates } = fakeSupabase({
      contacts: [
        {
          id: "contact-1",
          name: "Beatriz Souza",
          nickname: "Bia",
          phone_e164: "+5511999998888",
          email: null,
          preferred_channel: "whatsapp",
          whatsapp_opt_in: true,
          email_opt_in: false,
          opted_out_at: null,
        },
      ],
    });

    const result = await dispatchReminderOccurrence(client, "owner-1", fakeReminder());
    expect(result).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(deliveryUpdates[0]).toEqual({ status: "sent", provider_message_id: "wamid.123" });
  });

  it("já processado (índice único violado): não conta como enviado nem falho", async () => {
    const { client, deliveryUpdates } = fakeSupabase({
      contacts: [
        {
          id: "contact-1",
          name: "Beatriz Souza",
          nickname: "Bia",
          phone_e164: "+5511999998888",
          email: null,
          preferred_channel: "whatsapp",
          whatsapp_opt_in: true,
          email_opt_in: false,
          opted_out_at: null,
        },
      ],
      insertError: { code: "23505" },
    });

    const result = await dispatchReminderOccurrence(client, "owner-1", fakeReminder());
    expect(result).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(deliveryUpdates).toHaveLength(0);
  });

  it("recorrente (rrule diário): calcula a próxima ocorrência em vez de completar", async () => {
    const { client, reminderUpdates } = fakeSupabase({
      contacts: [
        {
          id: "contact-1",
          name: "Beatriz Souza",
          nickname: "Bia",
          phone_e164: "+5511999998888",
          email: null,
          preferred_channel: "whatsapp",
          whatsapp_opt_in: true,
          email_opt_in: false,
          opted_out_at: null,
        },
      ],
    });

    await dispatchReminderOccurrence(
      client,
      "owner-1",
      fakeReminder({ rrule: "DTSTART:20260115T120000Z\nRRULE:FREQ=DAILY" }),
    );

    expect(reminderUpdates[0]).toMatchObject({ send_at: "2026-01-16T15:00:00.000Z" });
  });

  it("recipient_type 'me': destinatário único (dono), sem consultar contatos", async () => {
    getMessageChannelMock.mockReturnValue({ send: vi.fn().mockResolvedValue({ providerMessageId: "push-1" }) });
    const { client, inserted } = fakeSupabase();

    const result = await dispatchReminderOccurrence(
      client,
      "owner-1",
      fakeReminder({ recipient_type: "me", contact_ids: [], channel: "push" }),
    );

    expect(result).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(inserted[0]).toMatchObject({ contact_id: null, channel: "push", destination: "owner-1" });
  });

  it("'me' com canal 'auto': usa push (não existe preferred_channel pro dono)", async () => {
    const { client, inserted } = fakeSupabase();
    await dispatchReminderOccurrence(client, "owner-1", fakeReminder({ recipient_type: "me", contact_ids: [], channel: "auto" }));
    expect(inserted[0]).toMatchObject({ channel: "push" });
  });

  it("'me' com canal 'email': usa o e-mail do dono (OWNER_EMAIL)", async () => {
    const { client, inserted } = fakeSupabase();
    await dispatchReminderOccurrence(client, "owner-1", fakeReminder({ recipient_type: "me", contact_ids: [], channel: "email" }));
    expect(inserted[0]).toMatchObject({ destination: "dono@example.com" });
  });

  it("horário silencioso na hora do envio: adia a ocorrência pras 8h, sem registrar entrega", async () => {
    const { client, inserted, reminderUpdates } = fakeSupabase({
      contacts: [
        {
          id: "contact-1",
          name: "Beatriz Souza",
          nickname: "Bia",
          phone_e164: "+5511999998888",
          email: null,
          preferred_channel: "whatsapp",
          whatsapp_opt_in: true,
          email_opt_in: false,
          opted_out_at: null,
        },
      ],
    });

    vi.setSystemTime(new Date("2026-01-16T01:00:30.000Z")); // 22:00 local
    const result = await dispatchReminderOccurrence(client, "owner-1", fakeReminder({ send_at: "2026-01-16T01:00:00.000Z" }));
    expect(result).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(inserted).toHaveLength(0);
    expect(reminderUpdates[0]).toEqual({ send_at: "2026-01-16T11:00:00.000Z" }); // 8:00 local do dia seguinte
  });

  it("job atrasado: ocorrência às 20h processada às 23h também é adiada (antes ia às 23h)", async () => {
    const { client, inserted, reminderUpdates } = fakeSupabase({ contacts: [optedInContact] });
    vi.setSystemTime(new Date("2026-01-16T02:00:00.000Z")); // 23:00 local
    await dispatchReminderOccurrence(client, "owner-1", fakeReminder({ send_at: "2026-01-15T23:00:00.000Z" })); // 20:00 local
    expect(inserted).toHaveLength(0);
    expect(reminderUpdates[0]).toEqual({ send_at: "2026-01-16T11:00:00.000Z" });
  });

  it("contato com ocorrência atrasada mais de 24h: não envia (too_late), e o recorrente pula pro futuro", async () => {
    const { client, inserted, reminderUpdates } = fakeSupabase({ contacts: [optedInContact] });
    vi.setSystemTime(new Date("2026-01-20T15:30:00.000Z")); // 5 dias depois, 12:30 local
    const result = await dispatchReminderOccurrence(
      client,
      "owner-1",
      fakeReminder({ rrule: "DTSTART:20260115T120000Z\nRRULE:FREQ=DAILY" }),
    );
    expect(result).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(inserted[0]).toMatchObject({ status: "skipped", skip_reason: "too_late" });
    expect(reminderUpdates[0]).toMatchObject({ send_at: "2026-01-21T15:00:00.000Z" });
  });

  it("dono com lembrete diário atrasado 10 dias: envia uma vez e a próxima é amanhã (sem rajada de 10)", async () => {
    getMessageChannelMock.mockReturnValue({ send: vi.fn().mockResolvedValue({ providerMessageId: "push-1" }) });
    const { client, reminderUpdates } = fakeSupabase();
    vi.setSystemTime(new Date("2026-01-25T16:00:00.000Z"));
    const result = await dispatchReminderOccurrence(
      client,
      "owner-1",
      fakeReminder({ recipient_type: "me", contact_ids: [], channel: "push", rrule: "DTSTART:20260115T120000Z\nRRULE:FREQ=DAILY" }),
    );
    expect(result.sent).toBe(1);
    expect(reminderUpdates[0]).toMatchObject({ send_at: "2026-01-26T15:00:00.000Z" });
  });

  it("lembrete de item arquivado ou na lixeira: cancela sem enviar", async () => {
    const { client, inserted, reminderUpdates } = fakeSupabase({ contacts: [optedInContact], item: { status: "archived", deleted_at: null } });
    const result = await dispatchReminderOccurrence(client, "owner-1", fakeReminder({ item_id: "item-1" }));
    expect(result).toEqual({ sent: 0, failed: 0, skipped: 0 });
    expect(inserted).toHaveLength(0);
    expect(reminderUpdates[0]).toEqual({ status: "canceled" });
  });

  it("limite diário (3 nas últimas 24h): entrega 'skipped' com motivo rate_limit", async () => {
    const { client, inserted } = fakeSupabase({
      contacts: [
        {
          id: "contact-1",
          name: "Beatriz Souza",
          nickname: "Bia",
          phone_e164: "+5511999998888",
          email: null,
          preferred_channel: "whatsapp",
          whatsapp_opt_in: true,
          email_opt_in: false,
          opted_out_at: null,
        },
      ],
      deliveriesLast24h: 3,
    });

    await dispatchReminderOccurrence(client, "owner-1", fakeReminder());
    expect(inserted[0]).toMatchObject({ skip_reason: "rate_limit" });
  });

  it("executado duas vezes seguidas pra mesma ocorrência: a segunda não reenvia (índice único)", async () => {
    const state = {
      contacts: [
        {
          id: "contact-1",
          name: "Beatriz Souza",
          nickname: "Bia",
          phone_e164: "+5511999998888",
          email: null,
          preferred_channel: "whatsapp",
          whatsapp_opt_in: true,
          email_opt_in: false,
          opted_out_at: null,
        },
      ],
    };
    getMessageChannelMock.mockReturnValue({ send: vi.fn().mockResolvedValue({ providerMessageId: "wamid.123" }) });

    // primeira chamada: insere e "envia" de verdade
    const first = fakeSupabase(state);
    const firstResult = await dispatchReminderOccurrence(first.client, "owner-1", fakeReminder());
    expect(firstResult.sent).toBe(1);

    // segunda chamada pra mesma ocorrência: o banco de verdade rejeitaria o insert (23505) —
    // aqui simulamos isso diretamente, já que o fake não tem estado persistente entre chamadas.
    const second = fakeSupabase({ ...state, insertError: { code: "23505" } });
    const secondResult = await dispatchReminderOccurrence(second.client, "owner-1", fakeReminder());
    expect(secondResult).toEqual({ sent: 0, failed: 0, skipped: 0 });
  });
});
