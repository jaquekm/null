import mammoth from "mammoth";
import { PDFDocument } from "pdf-lib";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import { toAnthropicImageMediaType } from "@/features/attachments/lib/anthropic-image-media-type";
import { chunkPageIndices } from "@/features/attachments/lib/chunk-page-indices";
import { hasSufficientTextLayer } from "@/features/attachments/lib/pdf-text-layer";
import { pickExtractionStrategy } from "@/features/attachments/lib/pick-extraction-method";
import { isAutoOcrEnabled } from "@/features/settings/queries";
import { AiBudgetExceededError, AiDisabledError, callClaude } from "@/lib/ai/claude";
import type { JobHandler } from "../types";

const payloadSchema = z.object({
  attachmentId: z.string().uuid(),
  // "Extrair novamente" (2.9): ignora o "OCR automático" desligado — um pedido explícito sempre roda.
  manual: z.boolean().optional(),
});

/** Limite generoso pra txt/md/csv — o enunciado só pede "limitar tamanho". */
const MAX_PLAIN_TEXT_CHARS = 200_000;
/** Margem confortável sob o teto de 100 páginas/requisição da API do Claude pra um contexto de 200k tokens. */
const PAGES_PER_OCR_CHUNK = 20;
const OCR_MAX_TOKENS = 8192;

const OCR_SYSTEM_PROMPT = "Você transcreve documentos com fidelidade em português do Brasil.";
const OCR_PROMPT =
  "Transcreva fielmente todo o texto deste documento em Markdown, mantendo títulos, listas e tabelas. " +
  "Marque trechos ilegíveis como [ilegível]. Não resuma. Não adicione comentários, introdução ou conclusão — " +
  "responda só com o texto transcrito.";

async function ocrPdfBytes(bytes: Uint8Array, ownerId: string, itemId: string | undefined): Promise<string> {
  const base64 = Buffer.from(bytes).toString("base64");
  const { text } = await callClaude({
    ownerId,
    itemId,
    feature: "ocr",
    system: OCR_SYSTEM_PROMPT,
    maxTokens: OCR_MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: OCR_PROMPT },
        ],
      },
    ],
  });
  return text;
}

/** PDF escaneado grande: divide em blocos de páginas (`pdf-lib`) e concatena o texto de cada bloco. */
async function ocrPdf(bytes: Uint8Array, totalPages: number, ownerId: string, itemId: string | undefined): Promise<string> {
  const chunks = chunkPageIndices(totalPages, PAGES_PER_OCR_CHUNK);
  if (chunks.length <= 1) return ocrPdfBytes(bytes, ownerId, itemId);

  const src = await PDFDocument.load(bytes);
  const parts: string[] = [];
  for (const pageIndices of chunks) {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, pageIndices);
    for (const page of pages) out.addPage(page);
    const chunkBytes = await out.save();
    parts.push(await ocrPdfBytes(chunkBytes, ownerId, itemId));
  }
  return parts.join("\n\n");
}

/**
 * Job `extract_attachment` (2.9): extrai texto de PDF/imagem/DOCX/TXT-MD-CSV
 * de acordo com a tabela do enunciado. PDF: tenta a camada de texto primeiro
 * (`unpdf`); se a média for menor que ~100 caracteres por página, trata como
 * escaneado e manda pro OCR com Claude. Imagem: sempre OCR. `extraction_status`
 * fica `'skipped'` quando o disparo é automático, precisa de OCR e o dono
 * desligou "OCR automático" nas configurações — o botão manual sempre roda.
 * `item_id` pode ser nulo (anexo avulso, sem item — 4.8: boleto de conta a
 * pagar antes de existir um item): roda a extração igual, só pula o
 * `refresh_item_extra_text` no final (não tem item pra recompor).
 */
export const extractAttachment: JobHandler = async (job, { supabase }) => {
  const parsed = payloadSchema.safeParse(job.payload);
  if (!parsed.success) return { status: "failed", error: "Payload inválido — falta attachmentId." };
  const { attachmentId, manual } = parsed.data;

  const { data: attachment, error: readError } = await supabase
    .from("attachments")
    .select("id, owner_id, item_id, mime_type, storage_path")
    .eq("id", attachmentId)
    .maybeSingle();
  if (readError) return { status: "retry", error: readError.message };
  if (!attachment) return { status: "failed", error: "Anexo não encontrado." };

  const strategy = pickExtractionStrategy(attachment.mime_type);
  if (!strategy) return { status: "done" }; // não elegível — não deveria ter sido enfileirado

  await supabase.from("attachments").update({ extraction_status: "processing" }).eq("id", attachmentId);

  try {
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("attachments")
      .download(attachment.storage_path);
    if (downloadError || !fileBlob) throw new Error("Não foi possível baixar o arquivo do Storage.");

    let text: string;
    let method: "plain" | "docx" | "pdf_text" | "ai_ocr";
    let pageCount: number | null = null;

    if (strategy === "plain") {
      const raw = await fileBlob.text();
      text = raw.length > MAX_PLAIN_TEXT_CHARS ? raw.slice(0, MAX_PLAIN_TEXT_CHARS) : raw;
      method = "plain";
    } else if (strategy === "docx") {
      const buffer = Buffer.from(await fileBlob.arrayBuffer());
      const converted = await mammoth.convertToMarkdown({ buffer });
      text = converted.value;
      method = "docx";
    } else if (strategy === "pdf") {
      const bytes = new Uint8Array(await fileBlob.arrayBuffer());
      const pdf = await getDocumentProxy(bytes);
      const layer = await extractPdfText(pdf, { mergePages: true });
      pageCount = layer.totalPages;

      if (hasSufficientTextLayer(layer.text, layer.totalPages)) {
        text = layer.text;
        method = "pdf_text";
      } else {
        if (!manual && !(await isAutoOcrEnabled(supabase, attachment.owner_id))) {
          await supabase.from("attachments").update({ extraction_status: "skipped" }).eq("id", attachmentId);
          return { status: "done" };
        }
        text = await ocrPdf(bytes, layer.totalPages, attachment.owner_id, attachment.item_id ?? undefined);
        method = "ai_ocr";
      }
    } else {
      const mediaType = toAnthropicImageMediaType(attachment.mime_type);
      if (!mediaType) return { status: "failed", error: `Formato de imagem não suportado pela IA: ${attachment.mime_type}.` };

      if (!manual && !(await isAutoOcrEnabled(supabase, attachment.owner_id))) {
        await supabase.from("attachments").update({ extraction_status: "skipped" }).eq("id", attachmentId);
        return { status: "done" };
      }

      const base64 = Buffer.from(await fileBlob.arrayBuffer()).toString("base64");
      const result = await callClaude({
        ownerId: attachment.owner_id,
        itemId: attachment.item_id ?? undefined,
        feature: "ocr",
        system: OCR_SYSTEM_PROMPT,
        maxTokens: OCR_MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: OCR_PROMPT },
            ],
          },
        ],
      });
      text = result.text;
      method = "ai_ocr";
    }

    const { error: updateError } = await supabase
      .from("attachments")
      .update({
        extracted_text: text,
        extraction_status: "done",
        extraction_method: method,
        page_count: pageCount,
      })
      .eq("id", attachmentId);
    if (updateError) return { status: "retry", error: updateError.message };

    // Anexo avulso (4.8: boleto sem item) — não tem `content_text` de item pra recompor.
    if (attachment.item_id) await supabase.rpc("refresh_item_extra_text", { p_item_id: attachment.item_id });

    return { status: "done" };
  } catch (err) {
    if (err instanceof AiBudgetExceededError || err instanceof AiDisabledError) {
      await supabase.from("attachments").update({ extraction_status: "failed" }).eq("id", attachmentId);
      return { status: "failed", error: err.message };
    }
    const message = err instanceof Error ? err.message : "Falha ao extrair o texto.";
    // Última tentativa permitida: `resolveJobTransition` vai marcar o job
    // como `failed` mesmo com este `retry` (attempts esgotadas) — reflete
    // isso no anexo também, senão `extraction_status` fica preso em
    // 'processing' pra sempre.
    if (job.attempts >= job.max_attempts) {
      await supabase.from("attachments").update({ extraction_status: "failed" }).eq("id", attachmentId);
    }
    return { status: "retry", error: message };
  }
};
