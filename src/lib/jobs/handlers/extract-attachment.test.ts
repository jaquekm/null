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

const enqueueIndexItemMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/ai/lib/enqueue-index", () => ({ enqueueIndexItem: enqueueIndexItemMock }));

const convertToMarkdownMock = vi.fn();
const convertToHtmlMock = vi.fn().mockResolvedValue({ value: "<p>texto</p>", messages: [] });
vi.mock("mammoth", () => ({
  default: {
    convertToMarkdown: convertToMarkdownMock,
    convertToHtml: convertToHtmlMock,
    images: { imgElement: (fn: () => unknown) => fn },
  },
}));

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
  /** Item dono do anexo (corpo vazio por padrão = recebe o texto do documento). */
  item?: { content_text: string | null } | null;
}

function fakeSupabase(config: Config) {
  const updateCalls: Record<string, unknown>[] = [];
  const itemUpdates: Record<string, unknown>[] = [];
  const rpcCalls: unknown[] = [];
  const done = () => Promise.resolve({ error: null });
  const client = {
    from: (table: string) => {
      if (table === "items") {
        const item = config.item === undefined ? { content_text: "" } : config.item;
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: item, error: null }) }) }) }),
          update: (values: Record<string, unknown>) => {
            itemUpdates.push(values);
            return { eq: () => ({ eq: done }) };
          },
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: config.attachment ?? null, error: null }) }) }),
        update: (values: Record<string, unknown>) => {
          updateCalls.push(values);
          return { eq: done };
        },
      };
    },
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
  return { client: client as never, updateCalls, itemUpdates, rpcCalls };
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
    enqueueIndexItemMock.mockClear();
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

  it("docx: limpa o Markdown do mammoth (âncoras <a id>, pontuação escapada, __negrito__) antes de gravar", async () => {
    convertToMarkdownMock.mockResolvedValue({ value: '### <a id="_x"></a>__Tópico__\n\n- Vale a pena\\. Sim\\-não', messages: [] });
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    const { client, updateCalls } = fakeSupabase({
      attachment: { ...baseAttachment, mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      blob,
    });

    await extractAttachment(fakeJob(), { supabase: client });

    expect(updateCalls.at(-1)).toMatchObject({ extracted_text: "### **Tópico**\n\n- Vale a pena. Sim-não", extraction_method: "docx" });
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

  it("docx anexado a item vazio vira o corpo do item (texto editável); item com texto não é tocado", async () => {
    convertToMarkdownMock.mockResolvedValue({ value: "# Treino A\n\n- Supino 4x10" });
    convertToHtmlMock.mockResolvedValue({ value: "<h1>Treino A</h1><table><tr><td>Exercício</td><td>Séries</td></tr><tr><td>Supino</td><td>4x10</td></tr></table>", messages: [] });
    const docx = { ...baseAttachment, mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", storage_path: "p/a1.docx" };

    const empty = fakeSupabase({ attachment: docx, blob: new Blob(["x"]) });
    expect(await extractAttachment(fakeJob(), { supabase: empty.client })).toEqual({ status: "done" });
    expect(empty.itemUpdates).toHaveLength(1);
    expect(empty.itemUpdates[0]!.content_text).toContain("Supino");
    // Tabela do Word vira tabela de verdade no corpo, não parágrafos soltos.
    const content = (empty.itemUpdates[0]!.content as { content: { type: string }[] }).content;
    expect(content.map((block) => block.type)).toEqual(["heading", "table"]);

    const written = fakeSupabase({ attachment: docx, blob: new Blob(["x"]), item: { content_text: "minhas anotações" } });
    await extractAttachment(fakeJob(), { supabase: written.client });
    expect(written.itemUpdates).toHaveLength(0);
  });
});
