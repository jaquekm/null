import { beforeEach, describe, expect, it, vi } from "vitest";
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
}

function fakeSupabase(state: FakeState = {}) {
  const inserted: Record<string, unknown>[] = [];
  const deliveryUpdates: Record<string, unknown>[] = [];
  const reminderUpdates: Record<string, unknown>[] = [];

  const client = {
    from: (table: string) => {
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

describe("dispatchReminderOccurrence", () => {
  beforeEach(() => {
    getMessageChannelMock.mockReset();
    getMessageChannelMock.mockReturnValue(null);
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

  it("horário silencioso: entrega 'skipped' com motivo quiet_hours", async () => {
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
    });

    await dispatchReminderOccurrence(client, "owner-1", fakeReminder({ send_at: "2026-01-16T01:00:00.000Z" })); // 22:00 local
    expect(inserted[0]).toMatchObject({ skip_reason: "quiet_hours" });
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
