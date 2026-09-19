import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "./types";

/**
 * Integração da fase 2 (2.11): encadeia os módulos de verdade — não mocka
 * `applyTranscriptionResult` nem os handlers entre si — pra provar que a
 * fiação "upload → transcribe_audio → webhook → resumo" funciona de ponta a
 * ponta, não só que cada peça isolada bate com o mock dos vizinhos (o que os
 * testes unitários de cada handler já cobrem). "→ itens de tarefa"
 * (`createTasksFromActions`) fica de fora: é uma Server Action manual, e o
 * projeto não testa isoladamente actions que só encadeiam chamadas ao
 * Supabase (mesmo padrão de `transcripts/actions.ts`, 2.8).
 */

vi.mock("@/lib/env", () => ({ serverEnv: { APP_URL: "https://hub.example" } }));

const submitMock = vi.fn();
const verifyWebhookMock = vi.fn();
const fetchResultMock = vi.fn();
const getTranscriptionProviderMock = vi.fn();
vi.mock("@/lib/transcription", () => ({ getTranscriptionProvider: getTranscriptionProviderMock }));

const enqueueJobMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/jobs/enqueue", () => ({ enqueueJob: enqueueJobMock }));

const callClaudeJsonMock = vi.fn();
class FakeAiBudgetExceededError extends Error {}
class FakeAiDisabledError extends Error {}
vi.mock("@/lib/ai/claude", () => ({
  callClaude: vi.fn(),
  callClaudeJson: callClaudeJsonMock,
  AiBudgetExceededError: FakeAiBudgetExceededError,
  AiDisabledError: FakeAiDisabledError,
}));

// --- fake Supabase (PostgREST-like) compartilhado entre os três estágios ---

type Row = Record<string, unknown>;

function makeTable(rows: Row[]) {
  function builder(kind: "select" | "update" | "insert", payload?: Row) {
    const filters: [string, unknown][] = [];
    let wantsSelect = false;

    function matches(row: Row): boolean {
      return filters.every(([col, val]) => row[col] === val);
    }

    async function run(): Promise<Row[]> {
      if (kind === "select") return rows.filter(matches);
      if (kind === "update") {
        const affected = rows.filter(matches);
        affected.forEach((row) => Object.assign(row, payload));
        return affected;
      }
      // insert
      const inserted = { id: `generated-${rows.length + 1}`, ...payload };
      rows.push(inserted);
      return [inserted];
    }

    const api = {
      eq(col: string, val: unknown) {
        filters.push([col, val]);
        return api;
      },
      select() {
        wantsSelect = true;
        return api;
      },
      maybeSingle: () => run().then((rs) => ({ data: rs[0] ?? null, error: null })),
      single: () => run().then((rs) => (rs[0] ? { data: rs[0], error: null } : { data: null, error: { message: "not found" } })),
      then(onFulfilled: (v: { data: Row[] | null; error: null }) => unknown, onRejected?: (e: unknown) => unknown) {
        return run()
          .then((rs) => onFulfilled({ data: kind === "update" && !wantsSelect ? null : rs, error: null }))
          .catch(onRejected);
      },
    };
    return api;
  }

  return {
    select: () => builder("select"),
    update: (values: Row) => builder("update", values),
    insert: (values: Row) => builder("insert", values),
  };
}

function fakeAdminClient(tables: Record<string, Row[]>) {
  return {
    from: (table: string) => {
      if (!tables[table]) throw new Error(`tabela inesperada: ${table}`);
      return makeTable(tables[table]);
    },
    rpc: () => Promise.resolve({ error: null }),
    storage: {
      from: () => ({
        createSignedUrl: () => Promise.resolve({ data: { signedUrl: "https://storage.example/signed" }, error: null }),
      }),
    },
  } as never;
}

let clientForWebhookRoute: ReturnType<typeof fakeAdminClient> | null = null;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => clientForWebhookRoute }));

const { transcribeAudio } = await import("./handlers/transcribe-audio");
const { summarizeTranscript } = await import("./handlers/summarize-transcript");
const { POST: webhookHandler } = await import("@/app/api/webhooks/transcription/route");

function fakeJob(kind: string, payload: Record<string, unknown>): Job {
  return {
    id: "job-1",
    owner_id: "owner-1",
    kind,
    payload,
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
  } as unknown as Job;
}

const TRANSCRIPT_ID = "11111111-1111-4111-8111-111111111111";

const meetingSummary = {
  titulo_sugerido: "Reunião de planejamento",
  resumo: "Discutimos o roadmap do trimestre e adiamos o lançamento.",
  topicos: [{ titulo: "Roadmap", pontos: ["Adiar lançamento"] }],
  decisoes: ["Adiar o lançamento em duas semanas"],
  acoes: [{ descricao: "Atualizar o cronograma", responsavel: "João", prazo: "2026-10-01" }],
  perguntas_em_aberto: [],
  participantes_mencionados: ["João", "Maria"],
};

describe("pipeline de mídia (2.11): transcribe_audio → webhook → resumo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTranscriptionProviderMock.mockReturnValue({
      name: "assemblyai",
      submit: submitMock,
      verifyWebhook: verifyWebhookMock,
      fetchResult: fetchResultMock,
    });
  });

  it("caminho feliz: sobe o áudio, o webhook chega, o resumo é gerado e prepended ao item", async () => {
    const tables: Record<string, Row[]> = {
      transcripts: [
        {
          id: TRANSCRIPT_ID,
          owner_id: "owner-1",
          attachment_id: "a1",
          item_id: "item-1",
          language: "pt",
          status: "queued",
          provider: "assemblyai",
          summarize: false,
          external_id: null,
          text: null,
          segments: null,
          duration_seconds: null,
          speaker_names: null,
          summary: null,
        },
      ],
      attachments: [{ id: "a1", storage_path: "owner-1/item-1/a1.webm" }],
      items: [
        {
          id: "item-1",
          title: "Sem título",
          content: { type: "doc", content: [] },
          content_text: "",
          properties: {},
          object_types: { slug: "reuniao" },
        },
      ],
      usage_events: [],
      item_versions: [],
    };
    const admin = fakeAdminClient(tables);
    clientForWebhookRoute = admin;

    // 1) transcribe_audio: envia pro provedor, marca "processing", enfileira o poll (não usado aqui — o webhook chega antes).
    submitMock.mockResolvedValue({ externalId: "ext-1" });
    const transcribeOutcome = await transcribeAudio(fakeJob("transcribe_audio", { transcriptId: TRANSCRIPT_ID }), { supabase: admin });
    expect(transcribeOutcome).toEqual({ status: "done" });
    expect(tables.transcripts![0]).toMatchObject({ status: "processing", external_id: "ext-1" });
    expect(enqueueJobMock).toHaveBeenCalledWith(expect.objectContaining({ kind: "poll_transcription" }));

    // 2) o provedor chama nosso webhook — nunca confiamos no payload, buscamos com fetchResult.
    enqueueJobMock.mockClear();
    verifyWebhookMock.mockResolvedValue({ externalId: "ext-1" });
    fetchResultMock.mockResolvedValue({
      status: "completed",
      text: "Bom dia. Vamos adiar o lançamento.",
      segments: [{ speaker: "A", start: 0, end: 3, text: "Bom dia. Vamos adiar o lançamento." }],
      durationSeconds: 3,
    });
    const webhookRes = await webhookHandler(
      new Request("https://hub.example/api/webhooks/transcription", {
        method: "POST",
        body: JSON.stringify({ transcript_id: "ext-1", status: "completed" }),
      }),
    );
    expect(webhookRes.status).toBe(200);
    expect(tables.transcripts![0]).toMatchObject({ status: "completed", text: "Bom dia. Vamos adiar o lançamento." });
    // é uma Reunião (`object_types.slug === 'reuniao'`) → `summarize_transcript` enfileirado automaticamente (2.6).
    expect(enqueueJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "summarize_transcript", payload: { transcriptId: TRANSCRIPT_ID } }),
    );

    // 3) summarize_transcript: gera o resumo estruturado e prepende ao conteúdo do item.
    callClaudeJsonMock.mockResolvedValue(meetingSummary);
    const summarizeOutcome = await summarizeTranscript(fakeJob("summarize_transcript", { transcriptId: TRANSCRIPT_ID }), {
      supabase: admin,
    });
    expect(summarizeOutcome).toEqual({ status: "done" });
    expect(tables.transcripts![0]).toMatchObject({ summary: meetingSummary });
    expect(tables.item_versions).toHaveLength(1); // snapshot salvo antes de alterar o item (mesma regra da 2.7)
    const updatedItem = tables.items![0]!;
    expect(updatedItem.title).toBe("Reunião de planejamento"); // "Sem título" → troca pelo título sugerido
    expect((updatedItem.content as { content: unknown[] }).content[0]).toMatchObject({
      type: "heading",
      content: [{ text: "Resumo gerado" }],
    });
  });

  it("webhook repetido não duplica: segunda chamada não reaplica nem reenfileira o resumo", async () => {
    const tables: Record<string, Row[]> = {
      transcripts: [
        {
          id: TRANSCRIPT_ID,
          owner_id: "owner-1",
          attachment_id: "a1",
          item_id: "item-1",
          status: "completed", // já foi processado pela primeira chamada do webhook
          provider: "assemblyai",
          summarize: false,
          external_id: "ext-1",
          text: "já processado",
        },
      ],
      attachments: [{ id: "a1", storage_path: "owner-1/item-1/a1.webm" }],
      items: [{ id: "item-1", title: "Sem título", content: { type: "doc", content: [] }, properties: {}, object_types: { slug: "reuniao" } }],
      usage_events: [],
      item_versions: [],
    };
    clientForWebhookRoute = fakeAdminClient(tables);

    verifyWebhookMock.mockResolvedValue({ externalId: "ext-1" });
    const res = await webhookHandler(
      new Request("https://hub.example/api/webhooks/transcription", {
        method: "POST",
        body: JSON.stringify({ transcript_id: "ext-1", status: "completed" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(fetchResultMock).not.toHaveBeenCalled(); // status já não é "processing" — idempotente, nem consulta o provedor de novo
    expect(enqueueJobMock).not.toHaveBeenCalled();
  });
});
