import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../types";

const buildEventBeforeRemindersMock = vi.fn().mockReturnValue([]);
vi.mock("@/features/reminders/lib/build-event-before-reminders", () => ({ buildEventBeforeReminders: buildEventBeforeRemindersMock }));

const buildBirthdayRemindersMock = vi.fn().mockReturnValue([]);
vi.mock("@/features/reminders/lib/build-birthday-reminders", () => ({ buildBirthdayReminders: buildBirthdayRemindersMock }));

const buildItemDateFieldRemindersMock = vi.fn().mockReturnValue([]);
vi.mock("@/features/reminders/lib/build-item-date-field-reminders", () => ({ buildItemDateFieldReminders: buildItemDateFieldRemindersMock }));

const buildBillDueRemindersMock = vi.fn().mockReturnValue([]);
vi.mock("@/features/reminders/lib/build-bill-due-reminders", () => ({ buildBillDueReminders: buildBillDueRemindersMock }));

const reconcileGeneratedRemindersMock = vi.fn().mockReturnValue({ toInsert: [], toUpdate: [], toCancel: [] });
vi.mock("@/features/reminders/lib/reconcile-generated-reminders", () => ({ reconcileGeneratedReminders: reconcileGeneratedRemindersMock }));

const getUserTimezoneMock = vi.fn().mockResolvedValue("America/Sao_Paulo");
vi.mock("@/features/reminders/queries", () => ({ getUserTimezone: getUserTimezoneMock }));

vi.mock("@/lib/env", () => ({ serverEnv: { APP_URL: "https://hub.example" } }));

const { generateReminders } = await import("./generate-reminders");

function fakeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    owner_id: "owner-1",
    kind: "generate_reminders",
    payload: {},
    status: "running",
    priority: 100,
    attempts: 1,
    max_attempts: 5,
    run_after: "2026-09-20T00:00:00.000Z",
    locked_at: "2026-09-20T00:00:00.000Z",
    finished_at: null,
    last_error: null,
    result: null,
    dedupe_key: null,
    created_at: "2026-09-20T00:00:00.000Z",
    updated_at: "2026-09-20T00:00:00.000Z",
    ...overrides,
  };
}

function autoQuery(result: { data: unknown; error?: unknown } = { data: [], error: null }) {
  const proxy: object = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          const promise = Promise.resolve(result);
          return promise.then.bind(promise);
        }
        return () => proxy;
      },
    },
  );
  return proxy;
}

interface FakeState {
  rules?: Record<string, unknown>[] | null;
  rulesError?: unknown;
  existingReminders?: Record<string, unknown>[];
  existingError?: unknown;
}

function fakeSupabase(state: FakeState) {
  const inserted: Record<string, unknown>[][] = [];
  const updates: { id: string; values: Record<string, unknown> }[] = [];
  const cancels: string[][] = [];

  const client = {
    from: (table: string) => {
      if (table === "reminder_rules") {
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: state.rules ?? [], error: state.rulesError ?? null }) }) }) };
      }
      if (table === "events" || table === "contacts" || table === "items" || table === "fin_bills" || table === "fin_recurring") {
        return { select: () => autoQuery({ data: [] }) };
      }
      if (table === "reminders") {
        return {
          select: () => ({
            eq: () => ({ eq: () => Promise.resolve({ data: state.existingReminders ?? [], error: state.existingError ?? null }) }),
          }),
          insert: (rows: Record<string, unknown>[]) => {
            inserted.push(rows);
            return Promise.resolve({ error: null });
          },
          update: (values: Record<string, unknown>) => ({
            eq: (_col: string, id: unknown) => {
              updates.push({ id: id as string, values });
              return Promise.resolve({ error: null });
            },
            in: (_col: string, ids: string[]) => {
              cancels.push(ids);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
  return { client: client as never, inserted, updates, cancels };
}

describe("generateReminders", () => {
  beforeEach(() => {
    buildEventBeforeRemindersMock.mockReset().mockReturnValue([]);
    buildBirthdayRemindersMock.mockReset().mockReturnValue([]);
    buildItemDateFieldRemindersMock.mockReset().mockReturnValue([]);
    buildBillDueRemindersMock.mockReset().mockReturnValue([]);
    reconcileGeneratedRemindersMock.mockReset().mockReturnValue({ toInsert: [], toUpdate: [], toCancel: [] });
    getUserTimezoneMock.mockClear();
  });

  it("erro ao buscar regras: retry", async () => {
    const { client } = fakeSupabase({ rulesError: { message: "boom" } });
    const outcome = await generateReminders(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "retry" });
  });

  it("sem regras ativas: done, rulesProcessed: 0", async () => {
    const { client } = fakeSupabase({ rules: [] });
    const outcome = await generateReminders(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done", result: { rulesProcessed: 0 } });
  });

  it("regra 'event_before': chama buildEventBeforeReminders com os campos certos", async () => {
    const { client } = fakeSupabase({
      rules: [{ id: "rule-1", kind: "event_before", config: { hoursBefore: 12 }, channel: "auto", recipient_type: "contacts", message_template: "Oi" }],
    });
    await generateReminders(fakeJob(), { supabase: client });

    expect(buildEventBeforeRemindersMock).toHaveBeenCalledTimes(1);
    const [, , rule, timezone, , appUrl] = buildEventBeforeRemindersMock.mock.calls[0]!;
    expect(rule).toMatchObject({ id: "rule-1", recipientType: "contacts", channel: "auto", messageTemplate: "Oi", config: { hoursBefore: 12 } });
    expect(timezone).toBe("America/Sao_Paulo");
    expect(appUrl).toBe("https://hub.example");
  });

  it("regra 'birthday': chama buildBirthdayReminders", async () => {
    const { client } = fakeSupabase({
      rules: [{ id: "rule-2", kind: "birthday", config: {}, channel: "auto", recipient_type: "me", message_template: "Parabéns" }],
    });
    await generateReminders(fakeJob(), { supabase: client });
    expect(buildBirthdayRemindersMock).toHaveBeenCalledTimes(1);
  });

  it("regra 'item_date_field' com typeId configurado: chama buildItemDateFieldReminders", async () => {
    const { client } = fakeSupabase({
      rules: [{ id: "rule-3", kind: "item_date_field", config: { typeId: "type-1", fieldKey: "prazo", fieldType: "date" }, channel: "auto", recipient_type: "me", message_template: "x" }],
    });
    await generateReminders(fakeJob(), { supabase: client });
    expect(buildItemDateFieldRemindersMock).toHaveBeenCalledTimes(1);
  });

  it("regra 'item_date_field' sem typeId: não chama o builder (nada configurado ainda)", async () => {
    const { client } = fakeSupabase({
      rules: [{ id: "rule-4", kind: "item_date_field", config: {}, channel: "auto", recipient_type: "me", message_template: "x" }],
    });
    await generateReminders(fakeJob(), { supabase: client });
    expect(buildItemDateFieldRemindersMock).not.toHaveBeenCalled();
  });

  it("regra 'bill_due': chama buildBillDueReminders com os campos certos", async () => {
    const { client } = fakeSupabase({
      rules: [{ id: "rule-5", kind: "bill_due", config: { daysBefore: 5 }, channel: "auto", recipient_type: "me", message_template: "x" }],
    });
    await generateReminders(fakeJob(), { supabase: client });

    expect(buildBillDueRemindersMock).toHaveBeenCalledTimes(1);
    const [, , remindDaysBeforeByRecurringId, rule, timezone] = buildBillDueRemindersMock.mock.calls[0]!;
    expect(rule).toMatchObject({ id: "rule-5", recipientType: "me", channel: "auto", messageTemplate: "x", config: { daysBefore: 5 } });
    expect(remindDaysBeforeByRecurringId).toBeInstanceOf(Map);
    expect(timezone).toBe("America/Sao_Paulo");
  });

  it("kind desconhecido ('split_open', 4.9): não chama nenhum builder, não quebra", async () => {
    const { client } = fakeSupabase({
      rules: [{ id: "rule-6", kind: "split_open", config: {}, channel: "auto", recipient_type: "me", message_template: "x" }],
    });
    const outcome = await generateReminders(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "done" });
    expect(buildEventBeforeRemindersMock).not.toHaveBeenCalled();
    expect(buildBirthdayRemindersMock).not.toHaveBeenCalled();
    expect(buildItemDateFieldRemindersMock).not.toHaveBeenCalled();
    expect(buildBillDueRemindersMock).not.toHaveBeenCalled();
  });

  it("executa o resultado do reconcile: insere, atualiza e cancela", async () => {
    buildBirthdayRemindersMock.mockReturnValue([
      {
        sourceType: "birthday",
        sourceId: "contact-1",
        sendAt: "2026-06-15T12:00:00.000Z",
        title: "Aniversário",
        messageTemplate: "Parabéns",
        channel: "push",
        recipientType: "me",
        contactIds: [],
        variables: { contato: "Bia" },
        itemId: null,
      },
    ]);
    reconcileGeneratedRemindersMock.mockReturnValue({
      toInsert: [
        {
          sourceType: "birthday",
          sourceId: "contact-1",
          sendAt: "2026-06-15T12:00:00.000Z",
          title: "Aniversário",
          messageTemplate: "Parabéns",
          channel: "push",
          recipientType: "me",
          contactIds: [],
          variables: { contato: "Bia" },
          itemId: null,
        },
      ],
      toUpdate: [{ id: "rem-2", sendAt: "2026-07-01T12:00:00.000Z", variables: { link: "x" }, contactIds: ["contact-2"] }],
      toCancel: ["rem-3"],
    });

    const { client, inserted, updates, cancels } = fakeSupabase({
      rules: [{ id: "rule-2", kind: "birthday", config: {}, channel: "auto", recipient_type: "me", message_template: "Parabéns" }],
    });

    const outcome = await generateReminders(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done", result: { rulesProcessed: 1, inserted: 1, updated: 1, canceled: 1 } });
    expect(inserted[0]?.[0]).toMatchObject({ owner_id: "owner-1", source_type: "birthday", source_id: "contact-1", rule_id: "rule-2" });
    expect(updates[0]).toMatchObject({ id: "rem-2", values: { send_at: "2026-07-01T12:00:00.000Z", contact_ids: ["contact-2"] } });
    expect(cancels[0]).toEqual(["rem-3"]);
  });

  it("erro numa regra: junta no retry, mas continua processando as outras", async () => {
    const { client } = fakeSupabase({
      rules: [
        { id: "rule-a", kind: "birthday", config: {}, channel: "auto", recipient_type: "me", message_template: "x" },
        { id: "rule-b", kind: "birthday", config: {}, channel: "auto", recipient_type: "me", message_template: "x" },
      ],
      existingError: { message: "falha ao buscar existentes" },
    });
    const outcome = await generateReminders(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "retry" });
    expect(buildBirthdayRemindersMock).toHaveBeenCalledTimes(2);
  });
});
