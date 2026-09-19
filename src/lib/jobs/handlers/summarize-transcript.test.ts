import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../types";

const callClaudeMock = vi.fn();
const callClaudeJsonMock = vi.fn();
class FakeAiBudgetExceededError extends Error {}
class FakeAiDisabledError extends Error {}
vi.mock("@/lib/ai/claude", () => ({
  callClaude: callClaudeMock,
  callClaudeJson: callClaudeJsonMock,
  AiBudgetExceededError: FakeAiBudgetExceededError,
  AiDisabledError: FakeAiDisabledError,
}));

const { summarizeTranscript } = await import("./summarize-transcript");

function fakeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    owner_id: "owner-1",
    kind: "summarize_transcript",
    payload: { transcriptId: "11111111-1111-4111-8111-111111111111" },
    status: "running",
    priority: 100,
    attempts: 1,
    max_attempts: 5,
    run_after: "2026-09-19T00:00:00.000Z",
    locked_at: "2026-09-19T00:00:00.000Z",
    finished_at: null,
    last_error: null,
    result: null,
    dedupe_key: null,
    created_at: "2026-09-19T00:00:00.000Z",
    updated_at: "2026-09-19T00:00:00.000Z",
    ...overrides,
  };
}

interface Config {
  transcript: Record<string, unknown> | null;
  item?: Record<string, unknown> | null;
  summaryUpdateError?: unknown;
  versionInsertError?: unknown;
  contentUpdateError?: unknown;
}

function fakeSupabase(config: Config) {
  const summaryUpdateCalls: Record<string, unknown>[] = [];
  const versionInserts: Record<string, unknown>[] = [];
  const contentUpdateCalls: Record<string, unknown>[] = [];

  const client = {
    from: (table: string) => {
      if (table === "transcripts") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: config.transcript, error: null }) }) }),
          update: (values: Record<string, unknown>) => {
            summaryUpdateCalls.push(values);
            return { eq: () => Promise.resolve({ error: config.summaryUpdateError ?? null }) };
          },
        };
      }
      if (table === "items") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: config.item ?? null, error: null }) }) }),
          update: (values: Record<string, unknown>) => {
            contentUpdateCalls.push(values);
            return { eq: () => Promise.resolve({ error: config.contentUpdateError ?? null }) };
          },
        };
      }
      if (table === "item_versions") {
        return {
          insert: (values: Record<string, unknown>) => {
            versionInserts.push(values);
            return Promise.resolve({ error: config.versionInsertError ?? null });
          },
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
  return { client: client as never, summaryUpdateCalls, versionInserts, contentUpdateCalls };
}

const completedTranscript = {
  id: "t1",
  owner_id: "owner-1",
  item_id: "item-1",
  status: "completed",
  text: "texto pequeno",
  segments: [{ speaker: "A", start: 0, end: 5, text: "Bom dia." }],
  speaker_names: { A: "João" },
  summary: null,
};

const summaryResult = {
  titulo_sugerido: "Reunião — planejamento",
  resumo: "Resumo curto.",
  topicos: [],
  decisoes: [],
  acoes: [],
  perguntas_em_aberto: [],
  participantes_mencionados: [],
};

describe("summarizeTranscript", () => {
  beforeEach(() => {
    callClaudeMock.mockReset();
    callClaudeJsonMock.mockReset();
    callClaudeJsonMock.mockResolvedValue(summaryResult);
  });

  it("caminho feliz: salva summary, cria versão 'ai' e prepende o bloco no content", async () => {
    const item = { title: "Sem título", content: { type: "doc", content: [{ type: "paragraph", content: [] }] }, properties: {} };
    const { client, summaryUpdateCalls, versionInserts, contentUpdateCalls } = fakeSupabase({
      transcript: completedTranscript,
      item,
    });

    const outcome = await summarizeTranscript(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done" });
    expect(callClaudeMock).not.toHaveBeenCalled(); // texto pequeno, sem chunking
    expect(summaryUpdateCalls[0]).toMatchObject({ summary: summaryResult });
    expect(versionInserts[0]).toMatchObject({ reason: "ai", item_id: "item-1", title: "Sem título" });
    const newContent = contentUpdateCalls[0]!.content as { content: { type: string }[] };
    expect(newContent.content[0]).toMatchObject({ type: "heading" });
    expect(contentUpdateCalls[0]!.title).toBe("Reunião — planejamento"); // título padrão -> usa titulo_sugerido
  });

  it("título não-padrão não é sobrescrito pelo titulo_sugerido", async () => {
    const item = { title: "Reunião com o cliente X", content: null, properties: {} };
    const { client, contentUpdateCalls } = fakeSupabase({ transcript: completedTranscript, item });

    await summarizeTranscript(fakeJob(), { supabase: client });

    expect(contentUpdateCalls[0]!.title).toBe("Reunião com o cliente X");
  });

  it("inclui a data da reunião no contexto quando properties.data existe", async () => {
    const item = { title: "Sem título", content: null, properties: { data: "2026-10-01T14:00:00.000Z" } };
    const { client } = fakeSupabase({ transcript: completedTranscript, item });

    await summarizeTranscript(fakeJob(), { supabase: client });

    const call = callClaudeJsonMock.mock.calls[0]![0] as { messages: { content: string }[] };
    expect(call.messages[0]!.content).toContain("Data da reunião: 2026-10-01T14:00:00.000Z");
  });

  it("transcript não encontrado: failed", async () => {
    const { client } = fakeSupabase({ transcript: null });
    const outcome = await summarizeTranscript(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "failed" });
  });

  it("transcript ainda não 'completed': failed, não chama a IA", async () => {
    const { client } = fakeSupabase({ transcript: { ...completedTranscript, status: "processing" } });
    const outcome = await summarizeTranscript(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "failed" });
    expect(callClaudeJsonMock).not.toHaveBeenCalled();
  });

  it("já resumido e sem force: done, idempotente, não gasta uma chamada de IA de novo", async () => {
    const { client } = fakeSupabase({ transcript: { ...completedTranscript, summary: { resumo: "já tem" } } });
    const outcome = await summarizeTranscript(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done" });
    expect(callClaudeJsonMock).not.toHaveBeenCalled();
  });

  it("já resumido com force=true: regenera mesmo assim ('Gerar resumo novamente')", async () => {
    const item = { title: "Sem título", content: null, properties: {} };
    const { client } = fakeSupabase({ transcript: { ...completedTranscript, summary: { resumo: "já tem" } }, item });

    const outcome = await summarizeTranscript(fakeJob({ payload: { transcriptId: "11111111-1111-4111-8111-111111111111", force: true } }), {
      supabase: client,
    });

    expect(outcome).toEqual({ status: "done" });
    expect(callClaudeJsonMock).toHaveBeenCalledTimes(1);
  });

  it("texto grande: resume em blocos (callClaude) antes da chamada estruturada final", async () => {
    const bigText = Array.from({ length: 2000 }, (_, i) => `[00:00:0${i % 10}] A: fala número ${i} bem longa pra estourar o limite.`).join(
      "\n",
    );
    callClaudeMock.mockResolvedValue({ text: "notas do trecho", usage: { input_tokens: 1, output_tokens: 1 } });
    const item = { title: "Sem título", content: null, properties: {} };
    const { client } = fakeSupabase({
      transcript: { ...completedTranscript, segments: [{ speaker: "A", start: 0, end: 1, text: bigText }] },
      item,
    });

    const outcome = await summarizeTranscript(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done" });
    expect(callClaudeMock.mock.calls.length).toBeGreaterThan(1);
    expect(callClaudeJsonMock).toHaveBeenCalledTimes(1);
  });

  it("IA desligada (AiDisabledError): failed, não sobe como exceção genérica", async () => {
    callClaudeJsonMock.mockRejectedValue(new FakeAiDisabledError("desligado"));
    const item = { title: "Sem título", content: null, properties: {} };
    const { client, summaryUpdateCalls } = fakeSupabase({ transcript: completedTranscript, item });

    const outcome = await summarizeTranscript(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "failed", error: "desligado" });
    expect(summaryUpdateCalls).toEqual([]);
  });

  it("orçamento estourado (AiBudgetExceededError): failed", async () => {
    callClaudeJsonMock.mockRejectedValue(new FakeAiBudgetExceededError("orçamento estourado"));
    const item = { title: "Sem título", content: null, properties: {} };
    const { client } = fakeSupabase({ transcript: completedTranscript, item });

    const outcome = await summarizeTranscript(fakeJob(), { supabase: client });

    expect(outcome).toMatchObject({ status: "failed", error: "orçamento estourado" });
  });

  it("erro genérico da IA (ex.: rede) sobe pro runJob tratar como retry, não vira failed aqui", async () => {
    callClaudeJsonMock.mockRejectedValue(new Error("timeout de rede"));
    const item = { title: "Sem título", content: null, properties: {} };
    const { client } = fakeSupabase({ transcript: completedTranscript, item });

    await expect(summarizeTranscript(fakeJob(), { supabase: client })).rejects.toThrow("timeout de rede");
  });

  it("payload inválido: failed", async () => {
    const { client } = fakeSupabase({ transcript: completedTranscript });
    const outcome = await summarizeTranscript(fakeJob({ payload: {} }), { supabase: client });
    expect(outcome).toMatchObject({ status: "failed" });
  });
});
