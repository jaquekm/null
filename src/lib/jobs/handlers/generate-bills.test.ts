import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildRRuleString } from "@/features/reminders/lib/recurrence";
import type { Job } from "../types";
import { generateBills } from "./generate-bills";

const TIMEZONE = "America/Sao_Paulo";

function fakeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    owner_id: "owner-1",
    kind: "generate_bills",
    payload: {},
    status: "running",
    priority: 100,
    attempts: 1,
    max_attempts: 5,
    run_after: "2026-09-21T12:00:00.000Z",
    locked_at: "2026-09-21T12:00:00.000Z",
    finished_at: null,
    last_error: null,
    result: null,
    dedupe_key: null,
    created_at: "2026-09-21T12:00:00.000Z",
    updated_at: "2026-09-21T12:00:00.000Z",
    ...overrides,
  };
}

interface Config {
  recurring?: Record<string, unknown>[] | null;
  recurringError?: unknown;
  /** por `recurring_id`: erro "real" (não 23505) — o insert lança e a recorrência cai no catch. */
  insertErrorByRecurringId?: Record<string, unknown>;
  /** por `recurring_id`: `due_on`s que devem simular conflito 23505 (já existe). */
  duplicateDueOnsByRecurringId?: Record<string, string[]>;
}

function fakeSupabase(config: Config) {
  const recurringUpdates: { id: string; next_due_on?: string; active?: boolean }[] = [];
  const billInserts: Record<string, unknown>[] = [];

  const client = {
    from: (table: string) => {
      if (table === "fin_recurring") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: config.recurring ?? [], error: config.recurringError ?? null }),
            }),
          }),
          update: (values: { next_due_on?: string; active?: boolean }) => ({
            eq: (_col: string, id: string) => {
              recurringUpdates.push({ id, ...values });
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === "user_settings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "fin_bills") {
        return {
          insert: (values: Record<string, unknown>) => {
            const recurringId = values.recurring_id as string;
            const dueOn = values.due_on as string;
            if (config.insertErrorByRecurringId?.[recurringId]) {
              return Promise.resolve({ error: config.insertErrorByRecurringId[recurringId] });
            }
            if (config.duplicateDueOnsByRecurringId?.[recurringId]?.includes(dueOn)) {
              return Promise.resolve({ error: { code: "23505", message: "já existe" } });
            }
            billInserts.push(values);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
  return { client: client as never, recurringUpdates, billInserts };
}

/** Recorrência anual (âncora 2026-10-01): só uma ocorrência dentro do horizonte de 60 dias. */
function yearlyRecurring(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec-1",
    space_id: "space-1",
    description: "Aluguel",
    direction: "payable",
    amount_cents: 150000,
    category_id: "cat-1",
    account_id: "acc-1",
    contact_id: null,
    rrule: buildRRuleString({ kind: "yearly" }, new Date("2026-10-01T12:00:00Z"), TIMEZONE),
    next_due_on: "2026-10-01",
    ends_on: null,
    ...overrides,
  };
}

describe("generateBills", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("erro ao buscar recorrências ativas: retry", async () => {
    const { client } = fakeSupabase({ recurringError: { message: "boom" } });
    const outcome = await generateBills(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "retry" });
  });

  it("nenhuma recorrência ativa: done, created: 0", async () => {
    const { client, recurringUpdates } = fakeSupabase({ recurring: [] });
    const outcome = await generateBills(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done", result: { created: 0 } });
    expect(recurringUpdates).toEqual([]);
  });

  it("uma ocorrência dentro do horizonte: cria a conta e avança next_due_on pra depois do horizonte", async () => {
    const { client, billInserts, recurringUpdates } = fakeSupabase({ recurring: [yearlyRecurring()] });

    const outcome = await generateBills(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done", result: { created: 1 } });
    expect(billInserts).toEqual([
      expect.objectContaining({
        owner_id: "owner-1",
        space_id: "space-1",
        direction: "payable",
        description: "Aluguel",
        contact_id: null,
        category_id: "cat-1",
        account_id: "acc-1",
        amount_cents: 150000,
        due_on: "2026-10-01",
        recurring_id: "rec-1",
      }),
    ]);
    expect(recurringUpdates).toEqual([{ id: "rec-1", next_due_on: "2027-10-01" }]);
  });

  it("múltiplas ocorrências no mesmo horizonte (diária): gera todas e não desativa", async () => {
    const daily = yearlyRecurring({
      id: "rec-diaria",
      rrule: buildRRuleString({ kind: "daily" }, new Date("2026-09-22T12:00:00Z"), TIMEZONE),
      next_due_on: "2026-09-22",
    });
    const { client, billInserts, recurringUpdates } = fakeSupabase({ recurring: [daily] });

    const outcome = await generateBills(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done", result: { created: 60 } });
    expect(billInserts).toHaveLength(60);
    expect(billInserts[0]).toMatchObject({ due_on: "2026-09-22" });
    expect(billInserts[59]).toMatchObject({ due_on: "2026-11-20" });
    expect(recurringUpdates).toEqual([{ id: "rec-diaria", next_due_on: "2026-11-21" }]);
  });

  it("insert cai em 23505 (já existe): não conta como criada nem como erro, só pula", async () => {
    const rec = yearlyRecurring();
    const { client, billInserts, recurringUpdates } = fakeSupabase({
      recurring: [rec],
      duplicateDueOnsByRecurringId: { "rec-1": ["2026-10-01"] },
    });

    const outcome = await generateBills(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done", result: { created: 0 } });
    expect(billInserts).toEqual([]);
    expect(recurringUpdates).toEqual([{ id: "rec-1", next_due_on: "2027-10-01" }]);
  });

  it("ends_on antes do próximo vencimento: não cria conta e desativa a recorrência", async () => {
    const rec = yearlyRecurring({ ends_on: "2026-09-20" });
    const { client, billInserts, recurringUpdates } = fakeSupabase({ recurring: [rec] });

    const outcome = await generateBills(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done", result: { created: 0 } });
    expect(billInserts).toEqual([]);
    expect(recurringUpdates).toEqual([{ id: "rec-1", active: false }]);
  });

  it("RRULE esgotada (COUNT=1): cria a última ocorrência e desativa a recorrência", async () => {
    const base = buildRRuleString({ kind: "daily" }, new Date("2026-09-22T12:00:00Z"), TIMEZONE)!;
    const exhausting = base.replace("RRULE:FREQ=DAILY", "RRULE:FREQ=DAILY;COUNT=1");
    const rec = yearlyRecurring({ id: "rec-exaure", rrule: exhausting, next_due_on: "2026-09-22" });
    const { client, billInserts, recurringUpdates } = fakeSupabase({ recurring: [rec] });

    const outcome = await generateBills(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done", result: { created: 1 } });
    expect(billInserts).toEqual([expect.objectContaining({ recurring_id: "rec-exaure", due_on: "2026-09-22" })]);
    expect(recurringUpdates).toEqual([{ id: "rec-exaure", active: false }]);
  });

  it("uma recorrência falha: continua processando as outras e devolve retry com os erros acumulados", async () => {
    const recErro = yearlyRecurring({ id: "rec-erro" });
    const recOk = yearlyRecurring({ id: "rec-ok" });
    const { client, billInserts, recurringUpdates } = fakeSupabase({
      recurring: [recErro, recOk],
      insertErrorByRecurringId: { "rec-erro": { message: "falhou" } },
    });

    const outcome = await generateBills(fakeJob(), { supabase: client });

    expect(outcome).toMatchObject({ status: "retry" });
    expect(billInserts).toEqual([expect.objectContaining({ recurring_id: "rec-ok" })]);
    expect(recurringUpdates).toEqual([{ id: "rec-ok", next_due_on: "2027-10-01" }]);
  });
});
