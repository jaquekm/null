import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../types";

const notifyOwnerMock = vi.fn();
vi.mock("@/lib/messaging/notify-owner", () => ({ notifyOwner: notifyOwnerMock }));

const { checkBudgets } = await import("./check-budgets");

function fakeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    owner_id: "owner-1",
    kind: "check_budgets",
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

interface Config {
  categories?: Record<string, unknown>[] | null;
  categoriesError?: unknown;
  transactions?: Record<string, unknown>[] | null;
  transactionsError?: unknown;
  /** chaves `"categoryId:month:threshold"` que já existem — simula conflito 23505 (já notificado). */
  existingAlerts?: Set<string>;
  alertInsertError?: unknown;
}

function fakeSupabase(config: Config) {
  const alertInserts: Record<string, unknown>[] = [];

  const client = {
    from: (table: string) => {
      if (table === "user_settings") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) };
      }
      if (table === "fin_categories") {
        return { select: () => autoQuery({ data: config.categories ?? [], error: config.categoriesError ?? null }) };
      }
      if (table === "fin_transactions") {
        return { select: () => autoQuery({ data: config.transactions ?? [], error: config.transactionsError ?? null }) };
      }
      if (table === "fin_budget_alerts") {
        return {
          insert: (values: Record<string, unknown>) => {
            const key = `${values.category_id}:${values.month}:${values.threshold}`;
            if (config.existingAlerts?.has(key)) return Promise.resolve({ error: { code: "23505", message: "já existe" } });
            if (config.alertInsertError) return Promise.resolve({ error: config.alertInsertError });
            alertInserts.push(values);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
  return { client: client as never, alertInserts };
}

function category(overrides: Record<string, unknown> = {}) {
  return { id: "cat-1", name: "Mercado", monthly_budget_cents: 100000, ...overrides };
}

describe("checkBudgets", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    notifyOwnerMock.mockClear();
  });

  it("erro ao buscar categorias: retry", async () => {
    const { client } = fakeSupabase({ categoriesError: { message: "boom" } });
    const outcome = await checkBudgets(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "retry" });
  });

  it("nenhuma categoria com orçamento: done, sem notificar", async () => {
    const { client } = fakeSupabase({ categories: [] });
    const outcome = await checkBudgets(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done", result: { checked: 0, notified: 0 } });
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("erro ao buscar transações: retry", async () => {
    const { client } = fakeSupabase({ categories: [category()], transactionsError: { message: "boom" } });
    const outcome = await checkBudgets(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "retry" });
  });

  it("gasto abaixo de 80%: não notifica nem grava alerta", async () => {
    const { client, alertInserts } = fakeSupabase({
      categories: [category({ monthly_budget_cents: 100000 })],
      transactions: [{ category_id: "cat-1", amount_cents: -50000 }],
    });
    const outcome = await checkBudgets(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done", result: { checked: 1, notified: 0 } });
    expect(alertInserts).toEqual([]);
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("cruza 80% (mas não 100%): grava só o alerta de 80 e notifica uma vez", async () => {
    const { client, alertInserts } = fakeSupabase({
      categories: [category({ monthly_budget_cents: 100000 })],
      transactions: [{ category_id: "cat-1", amount_cents: -85000 }],
    });
    const outcome = await checkBudgets(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done", result: { checked: 1, notified: 1 } });
    expect(alertInserts).toEqual([{ owner_id: "owner-1", category_id: "cat-1", month: "2026-09-01", threshold: 80 }]);
    expect(notifyOwnerMock).toHaveBeenCalledTimes(1);
    expect(notifyOwnerMock).toHaveBeenCalledWith("owner-1", expect.objectContaining({ title: "Orçamento quase no limite" }));
  });

  it("cruza 100%: grava os dois alertas (80 e 100) e notifica duas vezes", async () => {
    const { client, alertInserts } = fakeSupabase({
      categories: [category({ monthly_budget_cents: 100000 })],
      transactions: [{ category_id: "cat-1", amount_cents: -120000 }],
    });
    const outcome = await checkBudgets(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done", result: { checked: 1, notified: 2 } });
    expect(alertInserts).toEqual([
      { owner_id: "owner-1", category_id: "cat-1", month: "2026-09-01", threshold: 80 },
      { owner_id: "owner-1", category_id: "cat-1", month: "2026-09-01", threshold: 100 },
    ]);
    expect(notifyOwnerMock).toHaveBeenCalledTimes(2);
    expect(notifyOwnerMock).toHaveBeenNthCalledWith(2, "owner-1", expect.objectContaining({ title: "Orçamento estourado" }));
  });

  it("alerta de 80 já existe (23505): não notifica de novo, não conta como erro", async () => {
    const { client, alertInserts } = fakeSupabase({
      categories: [category({ monthly_budget_cents: 100000 })],
      transactions: [{ category_id: "cat-1", amount_cents: -85000 }],
      existingAlerts: new Set(["cat-1:2026-09-01:80"]),
    });
    const outcome = await checkBudgets(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done", result: { checked: 1, notified: 0 } });
    expect(alertInserts).toEqual([]);
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("cruza 100%, mas o de 80 já foi notificado antes: só grava/notifica o de 100", async () => {
    const { client, alertInserts } = fakeSupabase({
      categories: [category({ monthly_budget_cents: 100000 })],
      transactions: [{ category_id: "cat-1", amount_cents: -120000 }],
      existingAlerts: new Set(["cat-1:2026-09-01:80"]),
    });
    const outcome = await checkBudgets(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done", result: { checked: 1, notified: 1 } });
    expect(alertInserts).toEqual([{ owner_id: "owner-1", category_id: "cat-1", month: "2026-09-01", threshold: 100 }]);
  });

  it("soma o gasto de várias transações da mesma categoria, sem misturar com outra categoria", async () => {
    const { client } = fakeSupabase({
      categories: [category({ id: "cat-1", monthly_budget_cents: 100000 }), category({ id: "cat-2", name: "Lazer", monthly_budget_cents: 20000 })],
      transactions: [
        { category_id: "cat-1", amount_cents: -50000 },
        { category_id: "cat-1", amount_cents: -30000 },
        { category_id: "cat-2", amount_cents: -25000 },
      ],
    });
    const outcome = await checkBudgets(fakeJob(), { supabase: client });
    // cat-1: 80000/100000 = 80% (warning); cat-2: 25000/20000 = 125% (over, cruza os dois)
    expect(outcome).toEqual({ status: "done", result: { checked: 2, notified: 3 } });
  });

  it("erro real (não 23505) ao gravar alerta: devolve retry, mas não quebra o processamento", async () => {
    const { client } = fakeSupabase({
      categories: [category({ monthly_budget_cents: 100000 })],
      transactions: [{ category_id: "cat-1", amount_cents: -85000 }],
      alertInsertError: { message: "falhou de verdade" },
    });
    const outcome = await checkBudgets(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "retry" });
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });

  it("categoria com monthly_budget_cents zero/negativo é ignorada (mesma regra da lib pura)", async () => {
    const { client, alertInserts } = fakeSupabase({
      categories: [category({ id: "cat-zero", monthly_budget_cents: 0 })],
      transactions: [{ category_id: "cat-zero", amount_cents: -100 }],
    });
    const outcome = await checkBudgets(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done", result: { checked: 1, notified: 0 } });
    expect(alertInserts).toEqual([]);
  });
});
