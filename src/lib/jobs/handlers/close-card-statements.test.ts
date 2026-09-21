import { describe, expect, it } from "vitest";
import type { Job } from "../types";
import { closeCardStatements } from "./close-card-statements";

function fakeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    owner_id: "owner-1",
    kind: "close_card_statements",
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

interface Config {
  statements?: Record<string, unknown>[] | null;
  statementsError?: unknown;
  accounts?: Record<string, unknown>[];
  transactionsByStatement?: Record<string, { amount_cents: number }[]>;
  transactionsError?: Record<string, unknown>;
  existingBillByStatement?: Record<string, { id: string } | null>;
}

function fakeSupabase(config: Config) {
  const statementUpdates: { id: string; status: string }[] = [];
  const billInserts: Record<string, unknown>[] = [];
  const billUpdates: { id: string; amount_cents: number; due_on: string }[] = [];

  const client = {
    from: (table: string) => {
      if (table === "fin_card_statements") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                lt: () => Promise.resolve({ data: config.statements ?? [], error: config.statementsError ?? null }),
              }),
            }),
          }),
          update: (values: { status: string }) => ({
            eq: (_col: string, id: string) => {
              statementUpdates.push({ id, ...values });
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === "fin_accounts") {
        return { select: () => ({ in: () => Promise.resolve({ data: config.accounts ?? [], error: null }) }) };
      }
      if (table === "fin_transactions") {
        return {
          select: () => ({
            eq: (_col: string, statementId: string) =>
              Promise.resolve({ data: config.transactionsByStatement?.[statementId] ?? [], error: config.transactionsError?.[statementId] ?? null }),
          }),
        };
      }
      if (table === "fin_bills") {
        return {
          select: () => ({
            eq: (_col: string, statementId: string) => ({
              maybeSingle: () => Promise.resolve({ data: config.existingBillByStatement?.[statementId] ?? null, error: null }),
            }),
          }),
          update: (values: { amount_cents: number; due_on: string }) => ({
            eq: (_col: string, id: string) => {
              billUpdates.push({ id, ...values });
              return Promise.resolve({ error: null });
            },
          }),
          insert: (values: Record<string, unknown>) => {
            billInserts.push(values);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
  return { client: client as never, statementUpdates, billInserts, billUpdates };
}

describe("closeCardStatements", () => {
  it("erro ao buscar faturas abertas: retry", async () => {
    const { client } = fakeSupabase({ statementsError: { message: "boom" } });
    const outcome = await closeCardStatements(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "retry" });
  });

  it("nenhuma fatura vencida: done, closed: 0", async () => {
    const { client } = fakeSupabase({ statements: [] });
    const outcome = await closeCardStatements(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done", result: { closed: 0 } });
  });

  it("fecha a fatura e cria a conta a pagar com o total (valor absoluto) e a conta pagadora do cartão", async () => {
    const { client, statementUpdates, billInserts } = fakeSupabase({
      statements: [{ id: "stmt-1", account_id: "acc-cartao", due_on: "2026-10-05" }],
      accounts: [{ id: "acc-cartao", name: "Nubank", payment_account_id: "acc-corrente" }],
      transactionsByStatement: { "stmt-1": [{ amount_cents: -5000 }, { amount_cents: -3000 }] },
      existingBillByStatement: { "stmt-1": null },
    });

    const outcome = await closeCardStatements(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done", result: { closed: 1 } });
    expect(statementUpdates).toEqual([{ id: "stmt-1", status: "closed" }]);
    expect(billInserts).toEqual([
      expect.objectContaining({
        direction: "payable",
        description: "Fatura Nubank",
        account_id: "acc-corrente",
        amount_cents: 8000,
        due_on: "2026-10-05",
        statement_id: "stmt-1",
        owner_id: "owner-1",
      }),
    ]);
  });

  it("conta sem conta pagadora definida: fatura fica com account_id nulo", async () => {
    const { client, billInserts } = fakeSupabase({
      statements: [{ id: "stmt-1", account_id: "acc-cartao", due_on: "2026-10-05" }],
      accounts: [{ id: "acc-cartao", name: "Cartão X", payment_account_id: null }],
      transactionsByStatement: { "stmt-1": [{ amount_cents: -1000 }] },
      existingBillByStatement: { "stmt-1": null },
    });

    await closeCardStatements(fakeJob(), { supabase: client });
    expect(billInserts[0]).toMatchObject({ account_id: null });
  });

  it("já existe conta a pagar vinculada: atualiza em vez de criar outra", async () => {
    const { client, billInserts, billUpdates } = fakeSupabase({
      statements: [{ id: "stmt-1", account_id: "acc-cartao", due_on: "2026-10-05" }],
      accounts: [{ id: "acc-cartao", name: "Nubank", payment_account_id: "acc-corrente" }],
      transactionsByStatement: { "stmt-1": [{ amount_cents: -4000 }] },
      existingBillByStatement: { "stmt-1": { id: "bill-existente" } },
    });

    await closeCardStatements(fakeJob(), { supabase: client });
    expect(billInserts).toEqual([]);
    expect(billUpdates).toEqual([{ id: "bill-existente", amount_cents: 4000, due_on: "2026-10-05" }]);
  });

  it("total zero (fatura totalmente estornada): fecha a fatura, mas não cria conta a pagar", async () => {
    const { client, statementUpdates, billInserts } = fakeSupabase({
      statements: [{ id: "stmt-1", account_id: "acc-cartao", due_on: "2026-10-05" }],
      accounts: [{ id: "acc-cartao", name: "Nubank", payment_account_id: "acc-corrente" }],
      transactionsByStatement: { "stmt-1": [{ amount_cents: -1000 }, { amount_cents: 1000 }] },
      existingBillByStatement: { "stmt-1": null },
    });

    const outcome = await closeCardStatements(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done", result: { closed: 1 } });
    expect(statementUpdates).toEqual([{ id: "stmt-1", status: "closed" }]);
    expect(billInserts).toEqual([]);
  });

  it("uma fatura falha: continua processando as outras e devolve retry com os erros acumulados", async () => {
    const { client, statementUpdates } = fakeSupabase({
      statements: [
        { id: "stmt-erro", account_id: "acc-cartao", due_on: "2026-10-05" },
        { id: "stmt-ok", account_id: "acc-cartao", due_on: "2026-10-05" },
      ],
      accounts: [{ id: "acc-cartao", name: "Nubank", payment_account_id: "acc-corrente" }],
      transactionsByStatement: { "stmt-ok": [{ amount_cents: -1000 }] },
      transactionsError: { "stmt-erro": { message: "falhou" } },
      existingBillByStatement: { "stmt-ok": null },
    });

    const outcome = await closeCardStatements(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "retry" });
    expect(statementUpdates).toEqual([{ id: "stmt-ok", status: "closed" }]);
  });
});
