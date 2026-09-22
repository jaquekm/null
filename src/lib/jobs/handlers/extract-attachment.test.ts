import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../types";

const callClaudeMock = vi.fn();
class FakeAiBudgetExceededError extends Error {}
class FakeAiDisabledError extends Error {}
vi.mock("@/lib/ai/claude", () => ({
  callClaude: callClaudeMock,
  AiBudgetExceededError: FakeAiBudgetExceededError,
  AiDisabledError: FakeAiDisabledError,
}));

const isAutoOcrEnabledMock = vi.fn().mockResolvedValue(true);
vi.mock("@/features/settings/queries", () => ({ isAutoOcrEnabled: isAutoOcrEnabledMock }));

const convertToMarkdownMock = vi.fn();
vi.mock("mammoth", () => ({ default: { convertToMarkdown: convertToMarkdownMock } }));

const extractPdfTextMock = vi.fn();
const getDocumentProxyMock = vi.fn().mockResolvedValue({});
vi.mock("unpdf", () => ({ extractText: extractPdfTextMock, getDocumentProxy: getDocumentProxyMock }));

const pdfLibLoadMock = vi.fn();
const pdfLibCreateMock = vi.fn();
vi.mock("pdf-lib", () => ({ PDFDocument: { load: pdfLibLoadMock, create: pdfLibCreateMock } }));

const { extractAttachment } = await import("./extract-attachment");

function fakeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    owner_id: "owner-1",
    kind: "extract_attachment",
    payload: { attachmentId: "11111111-1111-4111-8111-111111111111" },
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
  attachment?: Record<string, unknown> | null;
  blob?: Blob | null;
  downloadError?: unknown;
}

function fakeSupabase(config: Config) {
  const updateCalls: Record<string, unknown>[] = [];
  const rpcCalls: unknown[] = [];
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: config.attachment ?? null, error: null }) }) }),
      update: (values: Record<string, unknown>) => {
        updateCalls.push(values);
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
    storage: {
      from: () => ({
        download: () => Promise.resolve({ data: config.blob ?? null, error: config.downloadError ?? null }),
      }),
    },
    rpc: (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return Promise.resolve({ error: null });
    },
  };
  return { client: client as never, updateCalls, rpcCalls };
}

const baseAttachment = { id: "a1", owner_id: "owner-1", item_id: "item-1", mime_type: "text/plain", storage_path: "p/a1.txt" };

describe("extractAttachment", () => {
  beforeEach(() => {
    callClaudeMock.mockReset();
    isAutoOcrEnabledMock.mockReset();
    isAutoOcrEnabledMock.mockResolvedValue(true);
    convertToMarkdownMock.mockReset();
    extractPdfTextMock.mockReset();
    pdfLibLoadMock.mockReset();
    pdfLibCreateMock.mockReset();
  });

  it("plain: lê o texto direto do blob", async () => {
    const blob = new Blob(["olá mundo"], { type: "text/plain" });
    const { client, updateCalls, rpcCalls } = fakeSupabase({ attachment: baseAttachment, blob });

    const outcome = await extractAttachment(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done" });
    const finalUpdate = updateCalls.at(-1);
    expect(finalUpdate).toMatchObject({ extracted_text: "olá mundo", extraction_status: "done", extraction_method: "plain" });
    expect(rpcCalls[0]).toMatchObject({ name: "refresh_item_extra_text", args: { p_item_id: "item-1" } });
  });

  it("docx: usa mammoth.convertToMarkdown", async () => {
    convertToMarkdownMock.mockResolvedValue({ value: "# Título\n\ntexto", messages: [] });
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    const { client, updateCalls } = fakeSupabase({
      attachment: { ...baseAttachment, mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      blob,
    });

    const outcome = await extractAttachment(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done" });
    expect(convertToMarkdownMock).toHaveBeenCalled();
    expect(updateCalls.at(-1)).toMatchObject({ extracted_text: "# Título\n\ntexto", extraction_method: "docx" });
  });

  it("pdf com camada de texto suficiente: usa o texto direto, sem OCR", async () => {
    extractPdfTextMock.mockResolvedValue({ totalPages: 2, text: "a".repeat(300) }); // 150/página
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    const { client, updateCalls } = fakeSupabase({ attachment: { ...baseAttachment, mime_type: "application/pdf" }, blob });

    const outcome = await extractAttachment(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done" });
    expect(callClaudeMock).not.toHaveBeenCalled();
    expect(updateCalls.at(-1)).toMatchObject({ extraction_method: "pdf_text", page_count: 2 });
  });

  it("pdf escaneado (pouco texto): manda pro OCR com Claude", async () => {
    extractPdfTextMock.mockResolvedValue({ totalPages: 1, text: "pouco" }); // < 100/página
    callClaudeMock.mockResolvedValue({ text: "texto ocr", usage: { input_tokens: 1, output_tokens: 1 } });
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    const { client, updateCalls } = fakeSupabase({ attachment: { ...baseAttachment, mime_type: "application/pdf" }, blob });

    const outcome = await extractAttachment(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done" });
    expect(callClaudeMock).toHaveBeenCalledTimes(1);
    const call = callClaudeMock.mock.calls[0]![0] as { messages: { content: { type: string }[] }[] };
    expect(call.messages[0]!.content[0]).toMatchObject({ type: "document" });
    expect(updateCalls.at(-1)).toMatchObject({ extracted_text: "texto ocr", extraction_method: "ai_ocr" });
  });

  it("imagem: sempre OCR com Claude", async () => {
    callClaudeMock.mockResolvedValue({ text: "texto da imagem", usage: { input_tokens: 1, output_tokens: 1 } });
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    const { client, updateCalls } = fakeSupabase({ attachment: { ...baseAttachment, mime_type: "image/jpeg" }, blob });

    const outcome = await extractAttachment(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done" });
    const call = callClaudeMock.mock.calls[0]![0] as { messages: { content: { type: string; source?: { media_type: string } }[] }[] };
    expect(call.messages[0]!.content[0]).toMatchObject({ type: "image", source: { media_type: "image/jpeg" } });
    expect(updateCalls.at(-1)).toMatchObject({ extraction_method: "ai_ocr" });
  });

  it("formato de imagem não suportado pela API (ex.: heic): failed sem chamar a IA", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    const { client } = fakeSupabase({ attachment: { ...baseAttachment, mime_type: "image/heic" }, blob });

    const outcome = await extractAttachment(fakeJob(), { supabase: client });

    expect(outcome).toMatchObject({ status: "failed" });
    expect(callClaudeMock).not.toHaveBeenCalled();
  });

  it("imagem com OCR automático desligado (disparo automático): 'skipped', não chama a IA", async () => {
    isAutoOcrEnabledMock.mockResolvedValue(false);
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    const { client, updateCalls } = fakeSupabase({ attachment: { ...baseAttachment, mime_type: "image/jpeg" }, blob });

    const outcome = await extractAttachment(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done" });
    expect(callClaudeMock).not.toHaveBeenCalled();
    expect(updateCalls.at(-1)).toMatchObject({ extraction_status: "skipped" });
  });

  it("imagem com OCR automático desligado mas pedido manual ('Extrair novamente'): roda mesmo assim", async () => {
    isAutoOcrEnabledMock.mockResolvedValue(false);
    callClaudeMock.mockResolvedValue({ text: "texto", usage: { input_tokens: 1, output_tokens: 1 } });
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    const { client, updateCalls } = fakeSupabase({ attachment: { ...baseAttachment, mime_type: "image/jpeg" }, blob });

    const outcome = await extractAttachment(
      fakeJob({ payload: { attachmentId: "11111111-1111-4111-8111-111111111111", manual: true } }),
      { supabase: client },
    );

    expect(outcome).toEqual({ status: "done" });
    expect(callClaudeMock).toHaveBeenCalledTimes(1);
    expect(updateCalls.at(-1)).toMatchObject({ extraction_method: "ai_ocr" });
  });

  it("MIME não elegível: done sem fazer nada (não deveria ter sido enfileirado)", async () => {
    const { client } = fakeSupabase({ attachment: { ...baseAttachment, mime_type: "audio/webm" } });
    const outcome = await extractAttachment(fakeJob(), { supabase: client });
    expect(outcome).toEqual({ status: "done" });
  });

  it("anexo não encontrado: failed", async () => {
    const { client } = fakeSupabase({ attachment: null });
    const outcome = await extractAttachment(fakeJob(), { supabase: client });
    expect(outcome).toMatchObject({ status: "failed" });
  });

  it("IA desligada (AiDisabledError): failed e marca o anexo como failed", async () => {
    callClaudeMock.mockRejectedValue(new FakeAiDisabledError("desligado"));
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    const { client, updateCalls } = fakeSupabase({ attachment: { ...baseAttachment, mime_type: "image/jpeg" }, blob });

    const outcome = await extractAttachment(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "failed", error: "desligado" });
    expect(updateCalls.at(-1)).toMatchObject({ extraction_status: "failed" });
  });

  it("erro genérico (rede) na última tentativa: retry, mas já marca o anexo como failed", async () => {
    callClaudeMock.mockRejectedValue(new Error("timeout"));
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    const { client, updateCalls } = fakeSupabase({ attachment: { ...baseAttachment, mime_type: "image/jpeg" }, blob });

    const outcome = await extractAttachment(fakeJob({ attempts: 5, max_attempts: 5 }), { supabase: client });

    expect(outcome).toEqual({ status: "retry", error: "timeout" });
    expect(updateCalls.at(-1)).toMatchObject({ extraction_status: "failed" });
  });

  it("erro genérico (rede) com tentativas sobrando: retry, sem marcar o anexo como failed ainda", async () => {
    callClaudeMock.mockRejectedValue(new Error("timeout"));
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    const { client, updateCalls } = fakeSupabase({ attachment: { ...baseAttachment, mime_type: "image/jpeg" }, blob });

    const outcome = await extractAttachment(fakeJob({ attempts: 1, max_attempts: 5 }), { supabase: client });

    expect(outcome).toEqual({ status: "retry", error: "timeout" });
    expect(updateCalls.at(-1)).toMatchObject({ extraction_status: "processing" });
  });

  it("anexo avulso (sem item, 4.8 — boleto): extrai normalmente e não chama refresh_item_extra_text", async () => {
    const blob = new Blob(["345.67"], { type: "text/plain" });
    const { client, updateCalls, rpcCalls } = fakeSupabase({ attachment: { ...baseAttachment, item_id: null }, blob });

    const outcome = await extractAttachment(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done" });
    expect(updateCalls.at(-1)).toMatchObject({ extracted_text: "345.67", extraction_status: "done" });
    expect(rpcCalls).toEqual([]);
  });

  it("imagem de anexo avulso (sem item): chama a IA com itemId indefinido, sem quebrar", async () => {
    callClaudeMock.mockResolvedValue({ text: "texto da imagem", usage: { input_tokens: 1, output_tokens: 1 } });
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    const { client, rpcCalls } = fakeSupabase({ attachment: { ...baseAttachment, item_id: null, mime_type: "image/jpeg" }, blob });

    const outcome = await extractAttachment(fakeJob(), { supabase: client });

    expect(outcome).toEqual({ status: "done" });
    const call = callClaudeMock.mock.calls[0]![0] as { itemId: string | undefined };
    expect(call.itemId).toBeUndefined();
    expect(rpcCalls).toEqual([]);
  });

  it("payload inválido: failed", async () => {
    const { client } = fakeSupabase({ attachment: baseAttachment });
    const outcome = await extractAttachment(fakeJob({ payload: {} }), { supabase: client });
    expect(outcome).toMatchObject({ status: "failed" });
  });
});
