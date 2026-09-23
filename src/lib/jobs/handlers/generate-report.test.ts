import { beforeEach, describe, expect, it, vi } from "vitest";
import { baseReportParamsSchema } from "@/features/reports/schemas";
import { fakeUuid, FakeSupabase } from "@/lib/testing/fake-supabase";
import type { Job } from "../types";

vi.mock("@/lib/env", () => ({
  serverEnv: { APP_URL: "https://hub.example", OWNER_EMAIL: "dono@example.com", CRON_SECRET: "cron-secret", AI_MONTHLY_BUDGET_USD: 0 },
}));

const STUB_KIND = "study_progress" as const;

const stubGenerator = {
  kind: STUB_KIND,
  label: "Estudos (stub)",
  paramsSchema: baseReportParamsSchema,
  collect: vi.fn().mockResolvedValue({ hoursThisWeek: 3 }),
  title: vi.fn(() => "Estudos — stub"),
  toBlocks: vi.fn(() => [{ kind: "text" as const, body: "resumo stub" }]),
};

vi.mock("@/features/reports/registry", () => ({ getReportGenerator: (kind: string) => (kind === STUB_KIND ? stubGenerator : undefined) }));

const notifyOwner = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/messaging/notify-owner", () => ({ notifyOwner }));

const emailSend = vi.fn().mockResolvedValue({ providerMessageId: "email-1" });
const whatsappSend = vi.fn().mockResolvedValue({ providerMessageId: "wa-1" });
const getMessageChannel = vi.fn((kind: string) => {
  if (kind === "email") return { send: emailSend };
  if (kind === "whatsapp") return { send: whatsappSend };
  return null;
});
vi.mock("@/lib/messaging", () => ({ getMessageChannel }));

const { generateReport } = await import("./generate-report");

const OWNER_ID = "owner-1";

function job(payload: unknown): Job {
  return {
    id: "job-1",
    owner_id: OWNER_ID,
    kind: "generate_report",
    payload,
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

function fakeSupabaseWithStorage() {
  const fake = new FakeSupabase();
  fake.seed("user_settings", [{ owner_id: OWNER_ID, timezone: "America/Sao_Paulo" }]);
  const upload = vi.fn().mockResolvedValue({ error: null });
  (fake as unknown as { storage: unknown }).storage = { from: () => ({ upload }) };
  return { fake, upload };
}

beforeEach(() => {
  notifyOwner.mockClear();
  emailSend.mockClear();
  whatsappSend.mockClear();
  stubGenerator.collect.mockClear();
});

describe("generateReport — ad hoc (kind + params, sem definição)", () => {
  it("gera o PDF, salva o snapshot e avisa por push (canal padrão)", async () => {
    const { fake, upload } = fakeSupabaseWithStorage();

    const outcome = await generateReport(job({ kind: STUB_KIND, params: {} }), { supabase: fake as never });

    expect(outcome.status).toBe("done");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(stubGenerator.collect).toHaveBeenCalledTimes(1);

    const runs = fake.rowsOf("report_runs");
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ kind: STUB_KIND, title: "Estudos — stub", definition_id: null, status: "done" });
    expect(runs[0]!.pdf_attachment_id).toBeTruthy();

    const attachments = fake.rowsOf("attachments");
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({ owner_id: OWNER_ID, item_id: null, mime_type: "application/pdf", extraction_status: "none" });

    expect(notifyOwner).toHaveBeenCalledTimes(1);
    expect(emailSend).not.toHaveBeenCalled();
  });

  it('kind sem gerador registrado: falha sem tentar de novo ("failed", não "retry")', async () => {
    // "finance_monthly" é um `ReportKind` válido, mas o mock do registry (só STUB_KIND) simula um gerador ausente.
    const { fake } = fakeSupabaseWithStorage();
    const outcome = await generateReport(job({ kind: "finance_monthly", params: {} }), { supabase: fake as never });
    expect(outcome.status).toBe("failed");
  });

  it("payload inválido: falha sem tentar de novo", async () => {
    const { fake } = fakeSupabaseWithStorage();
    const outcome = await generateReport(job({ nonsense: true }), { supabase: fake as never });
    expect(outcome.status).toBe("failed");
  });
});

const DEFINITION_ID = fakeUuid(1);

describe("generateReport — a partir de uma definição salva", () => {
  function definitionRow(overrides: Record<string, unknown> = {}) {
    return {
      id: DEFINITION_ID,
      owner_id: OWNER_ID,
      name: "Meu relatório",
      kind: STUB_KIND,
      params: {},
      schedule_rrule: null,
      timezone: "America/Sao_Paulo",
      next_run_at: null,
      deliver_to: { me: true, contacts: [] },
      channels: ["push", "email"],
      include_ai_summary: false,
      enabled: true,
      created_at: "2026-01-01T00:00:00.000Z",
      ...overrides,
    };
  }

  it("entrega por e-mail com o PDF anexado quando o canal está na definição", async () => {
    const { fake } = fakeSupabaseWithStorage();
    fake.seed("report_definitions", [definitionRow()]);

    const outcome = await generateReport(job({ definitionId: DEFINITION_ID }), { supabase: fake as never });

    expect(outcome.status).toBe("done");
    expect(emailSend).toHaveBeenCalledTimes(1);
    const call = emailSend.mock.calls[0]![0];
    expect(call.attachments).toHaveLength(1);
    expect(call.attachments[0].contentType).toBe("application/pdf");

    const runs = fake.rowsOf("report_runs");
    expect(runs[0]).toMatchObject({ definition_id: DEFINITION_ID });
  });

  it("entrega por WhatsApp só pro contato com opt-in, e cria o link público", async () => {
    const { fake } = fakeSupabaseWithStorage();
    fake.seed("report_definitions", [definitionRow({ channels: ["whatsapp"], deliver_to: { me: false, contacts: ["c1", "c2"] } })]);
    fake.seed("contacts", [
      { id: "c1", owner_id: OWNER_ID, phone_e164: "+5511999990001", whatsapp_opt_in: true, opted_out_at: null },
      { id: "c2", owner_id: OWNER_ID, phone_e164: "+5511999990002", whatsapp_opt_in: false, opted_out_at: null },
    ]);

    const outcome = await generateReport(job({ definitionId: DEFINITION_ID }), { supabase: fake as never });

    expect(outcome.status).toBe("done");
    expect(whatsappSend).toHaveBeenCalledTimes(1);
    expect(whatsappSend.mock.calls[0]![0].to).toBe("+5511999990001");
    expect(notifyOwner).not.toHaveBeenCalled();

    expect(fake.rowsOf("share_links")).toHaveLength(1);
    const run = fake.rowsOf("report_runs")[0]!;
    expect(run.share_link_id).toBeTruthy();
  });

  it("definição inexistente: falha sem tentar de novo", async () => {
    const { fake } = fakeSupabaseWithStorage();
    const outcome = await generateReport(job({ definitionId: fakeUuid(2) }), { supabase: fake as never });
    expect(outcome.status).toBe("failed");
  });
});
