import { describe, expect, it, vi } from "vitest";
import { reportScheduleToRRule } from "@/features/reports/lib/schedule-presets";
import type { Job } from "../types";

const enqueueJob = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/jobs/enqueue", () => ({ enqueueJob }));

const { scheduleReports } = await import("./schedule-reports");

const OWNER_ID = "owner-1";
const TZ = "America/Sao_Paulo";
const NOW = new Date("2026-09-23T15:00:00.000Z");

function job(): Job {
  return {
    id: "job-1",
    owner_id: OWNER_ID,
    kind: "schedule_reports",
    payload: {},
    status: "running",
    priority: 100,
    attempts: 0,
    max_attempts: 5,
    run_after: new Date().toISOString(),
    locked_at: null,
    finished_at: null,
    last_error: null,
    result: null,
    dedupe_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as Job;
}

function definitionRow(overrides: Record<string, unknown> = {}) {
  const rrule = reportScheduleToRRule({ kind: "monthly_day1_8h" }, TZ, NOW)!;
  return {
    id: "def-1",
    owner_id: OWNER_ID,
    name: "Financeiro mensal",
    kind: "finance_monthly",
    params: {},
    schedule_rrule: rrule,
    timezone: TZ,
    next_run_at: "2026-09-01T11:00:00.000Z",
    deliver_to: { me: true, contacts: [] },
    channels: ["push"],
    include_ai_summary: false,
    enabled: true,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * Mock mínimo do Supabase (mesmo padrão de `check-budgets.test.ts`, um proxy
 * que devolve a si mesmo pra qualquer método encadeado) — `FakeSupabase` não
 * cobre `.not()`/`.lte()`, que `listDueReportDefinitions` usa de verdade.
 * `due` já vem pré-filtrado (a query real faz o filtro no Postgres; aqui só
 * se testa o que o handler faz com o resultado).
 */
function fakeSupabase(due: Record<string, unknown>[]) {
  const updates: { id: string; nextRunAt: string | null }[] = [];

  function autoQuery(data: unknown) {
    const proxy: object = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") {
            const promise = Promise.resolve({ data, error: null });
            return promise.then.bind(promise);
          }
          return () => proxy;
        },
      },
    );
    return proxy;
  }

  const client = {
    from: (table: string) => {
      if (table !== "report_definitions") throw new Error(`tabela inesperada: ${table}`);
      return {
        select: () => autoQuery(due),
        update: (patch: { next_run_at: string | null }) => ({
          eq: (_field: string, id: string) => {
            updates.push({ id, nextRunAt: patch.next_run_at });
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
  };
  return { client: client as never, updates };
}

describe("scheduleReports", () => {
  it("definição vencida: enfileira generate_report e recalcula next_run_at", async () => {
    const { client, updates } = fakeSupabase([definitionRow()]);

    const outcome = await scheduleReports(job(), { supabase: client });

    expect(outcome).toMatchObject({ status: "done", result: { triggered: 1 } });
    expect(enqueueJob).toHaveBeenCalledTimes(1);
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: OWNER_ID, kind: "generate_report", payload: { definitionId: "def-1" } }),
    );

    expect(updates).toHaveLength(1);
    expect(updates[0]!.id).toBe("def-1");
    expect(updates[0]!.nextRunAt).not.toBeNull();
    expect(new Date(updates[0]!.nextRunAt!).toISOString()).toBe("2026-10-01T11:00:00.000Z"); // 08h em América/São_Paulo (UTC-3)
  });

  it("nenhuma definição vencida: não dispara nada", async () => {
    const { client, updates } = fakeSupabase([]);
    enqueueJob.mockClear();

    const outcome = await scheduleReports(job(), { supabase: client });

    expect(outcome).toMatchObject({ status: "done", result: { triggered: 0 } });
    expect(enqueueJob).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("RRULE esgotada (sem próxima ocorrência): next_run_at vira null", async () => {
    const { client, updates } = fakeSupabase([definitionRow({ schedule_rrule: "DTSTART:20200101T080000Z\nRRULE:FREQ=DAILY;COUNT=1" })]);
    enqueueJob.mockClear();

    await scheduleReports(job(), { supabase: client });

    expect(updates[0]!.nextRunAt).toBeNull();
  });
});
