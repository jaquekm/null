"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JSONContent } from "@tiptap/core";
import { createCaptureItem } from "@/features/capture/lib/create-capture-item";
import { extractText } from "@/features/items/lib/extract-text";
import { markdownToTiptapDoc } from "@/features/items/lib/markdown-to-tiptap";
import { getObjectTypeBySlug } from "@/features/types/queries";
import { AiBudgetExceededError, AiDisabledError, callClaude } from "@/lib/ai/claude";
import { requireOwner } from "@/lib/auth";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { fail, ok, type Result } from "@/lib/result";
import type { Database, Json } from "@/lib/supabase/database.types";
import { buildStoragePath } from "./lib/build-storage-path";
import { pickExtractionStrategy } from "./lib/pick-extraction-method";
import type { AttachmentRow } from "./queries";

const GENERIC_ERROR = "Não foi possível salvar o anexo. Tente de novo.";

export interface DuplicateAttachment {
  id: string;
  fileName: string;
  storagePath: string;
}

/** Procura, em todos os anexos do dono, um com o mesmo sha256 (1.9: "oferecer reutilizar"). */
export async function findDuplicateAttachment(sha256: string): Promise<Result<DuplicateAttachment | null>> {
  const { supabase, user } = await requireOwner();

  const { data, error } = await supabase
    .from("attachments")
    .select("id, file_name, storage_path")
    .eq("owner_id", user.id)
    .eq("sha256", sha256)
    .limit(1)
    .maybeSingle();

  if (error) return fail(GENERIC_ERROR);
  if (!data) return ok(null);
  return ok({ id: data.id, fileName: data.file_name, storagePath: data.storage_path });
}

const recordSchema = z.object({
  /** Nulo = anexo avulso, sem item (4.8: boleto de conta a pagar) — `attachments.item_id` já é opcional no banco desde a fundação. */
  itemId: z.string().uuid().optional(),
  storagePath: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().length(64),
  durationSeconds: z.number().positive().optional(),
  /** 2.10: o PDF combinado do "Escanear" não precisa de OCR automático — o texto de cada foto já foi extraído individualmente. */
  skipExtraction: z.boolean().optional(),
});

/** Enfileira `extract_attachment` (2.9) se o MIME for elegível — mesma checagem usada pro `extraction_status` inicial na linha. */
async function enqueueExtractionIfEligible(ownerId: string, attachmentId: string, mimeType: string): Promise<void> {
  if (!pickExtractionStrategy(mimeType)) return;
  await enqueueJob({
    ownerId,
    kind: "extract_attachment",
    payload: { attachmentId },
    dedupeKey: `extract:${attachmentId}`,
  });
}

/** Registra a linha em `attachments` depois de um upload direto ao Storage ter dado certo. */
export async function recordAttachment(input: z.infer<typeof recordSchema>): Promise<Result<AttachmentRow | null>> {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return fail(GENERIC_ERROR);

  const { supabase, user } = await requireOwner();
  const eligible = !parsed.data.skipExtraction && pickExtractionStrategy(parsed.data.mimeType) !== null;

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      owner_id: user.id,
      item_id: parsed.data.itemId ?? null,
      storage_path: parsed.data.storagePath,
      file_name: parsed.data.fileName,
      mime_type: parsed.data.mimeType,
      size_bytes: parsed.data.sizeBytes,
      sha256: parsed.data.sha256,
      duration_seconds: parsed.data.durationSeconds ?? null,
      extraction_status: eligible ? "queued" : "none",
    })
    .select("id, file_name, mime_type, size_bytes, created_at, extraction_status")
    .single();

  if (error || !data) return fail(GENERIC_ERROR);

  if (eligible) await enqueueExtractionIfEligible(user.id, data.id, parsed.data.mimeType);

  if (parsed.data.itemId) revalidatePath(`/itens/${parsed.data.itemId}`);
  return ok({
    id: data.id,
    fileName: data.file_name,
    mimeType: data.mime_type,
    sizeBytes: data.size_bytes,
    createdAt: data.created_at,
    extractionStatus: data.extraction_status,
  });
}

/**
 * "Reutilizar" um anexo idêntico (1.9): copia o objeto no Storage para um
 * caminho novo (evita reenviar os bytes) e cria uma linha própria — cada
 * anexo tem seu próprio `storage_path` único, mesmo reaproveitando o
 * conteúdo.
 *
 * 2.9: se o original já tem extração concluída, copia `extracted_text`
 * junto (mesmo conteúdo, sha256 igual — refazer OCR seria gasto duplicado à
 * toa). Se o original ainda não terminou (ou nunca teve, ou falhou), a
 * cópia enfileira sua própria extração — copiar um status "em andamento" não
 * funcionaria, porque o job do original só atualiza a linha do original.
 */
export async function reuseAttachment(
  existingAttachmentId: string,
  itemId: string,
): Promise<Result<AttachmentRow | null>> {
  const { supabase, user } = await requireOwner();

  const { data: existing, error: readError } = await supabase
    .from("attachments")
    .select("storage_path, file_name, mime_type, size_bytes, sha256, extraction_status, extraction_method, extracted_text, page_count")
    .eq("id", existingAttachmentId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (readError || !existing) return fail("Anexo original não encontrado.");

  const newPath = buildStoragePath(user.id, itemId, crypto.randomUUID(), existing.file_name);

  const { error: copyError } = await supabase.storage.from("attachments").copy(existing.storage_path, newPath);
  if (copyError) return fail("Não foi possível reaproveitar o anexo.");

  const extractionDone = existing.extraction_status === "done";
  const eligible = pickExtractionStrategy(existing.mime_type) !== null;

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      owner_id: user.id,
      item_id: itemId,
      storage_path: newPath,
      file_name: existing.file_name,
      mime_type: existing.mime_type,
      size_bytes: existing.size_bytes,
      sha256: existing.sha256,
      extraction_status: extractionDone ? "done" : eligible ? "queued" : "none",
      extraction_method: extractionDone ? existing.extraction_method : null,
      extracted_text: extractionDone ? existing.extracted_text : null,
      page_count: extractionDone ? existing.page_count : null,
    })
    .select("id, file_name, mime_type, size_bytes, created_at, extraction_status")
    .single();

  if (error || !data) return fail(GENERIC_ERROR);

  if (extractionDone) {
    await supabase.rpc("refresh_item_extra_text", { p_item_id: itemId });
  } else if (eligible) {
    await enqueueExtractionIfEligible(user.id, data.id, existing.mime_type);
  }

  revalidatePath(`/itens/${itemId}`);
  return ok({
    id: data.id,
    fileName: data.file_name,
    mimeType: data.mime_type,
    sizeBytes: data.size_bytes,
    createdAt: data.created_at,
    extractionStatus: data.extraction_status,
  });
}

/**
 * Remove do Storage todos os arquivos de um item (não mexe na linha em
 * `attachments` — quem chama decide se apaga o item, que cai em cascata por
 * `on delete cascade`). Usado por `permanentlyDeleteItem` e pelo job
 * `purge_trash` (2.2): os dois excluem o item definitivamente, e sem isso o
 * arquivo ficava órfão no bucket (o `on delete cascade` só limpa a linha do
 * banco, não o objeto do Storage).
 */
export async function removeItemAttachmentsFromStorage(
  supabase: SupabaseClient<Database>,
  itemId: string,
): Promise<void> {
  const { data: attachments, error } = await supabase.from("attachments").select("storage_path").eq("item_id", itemId);
  if (error || !attachments || attachments.length === 0) return;

  await supabase.storage.from("attachments").remove(attachments.map((a) => a.storage_path));
}

export async function deleteAttachment(attachmentId: string, itemId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { data: attachment, error: readError } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (readError || !attachment) return fail("Anexo não encontrado.");

  const { error: storageError } = await supabase.storage.from("attachments").remove([attachment.storage_path]);
  if (storageError) return fail("Não foi possível remover o arquivo do Storage.");

  const { error } = await supabase.from("attachments").delete().eq("id", attachmentId).eq("owner_id", user.id);
  if (error) return fail("O arquivo foi removido, mas não foi possível excluir o registro.");

  revalidatePath(`/itens/${itemId}`);
  return ok(null);
}

export interface ExtractedTextDetail {
  text: string | null;
  status: string;
  method: string | null;
  pageCount: number | null;
}

/** Texto extraído sob demanda (2.9, aba "Texto extraído") — buscado só quando o dono abre a aba, mesmo padrão do diálogo de versões (1.17) e dos jobs (2.2). */
export async function getExtractedText(attachmentId: string): Promise<ExtractedTextDetail | null> {
  const { supabase, user } = await requireOwner();

  const { data, error } = await supabase
    .from("attachments")
    .select("extracted_text, extraction_status, extraction_method, page_count")
    .eq("id", attachmentId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error || !data) return null;

  return { text: data.extracted_text, status: data.extraction_status, method: data.extraction_method, pageCount: data.page_count };
}

/** "Extrair novamente" (2.9) — `manual: true` roda mesmo com "OCR automático" desligado nas configurações. */
export async function requestExtraction(attachmentId: string, itemId: string): Promise<Result<null>> {
  const { user } = await requireOwner();

  await enqueueJob({
    ownerId: user.id,
    kind: "extract_attachment",
    payload: { attachmentId, manual: true },
    dedupeKey: `extract:${attachmentId}`,
  });

  revalidatePath(`/itens/${itemId}`);
  return ok(null);
}

/**
 * "Criar nota a partir do documento" (2.9): cria um item do tipo Documento
 * com o texto extraído (Markdown) convertido pra Tiptap (`markdownToTiptapDoc`
 * — não `generateJSON` do Tiptap, que exige `window`/DOM e não existe no
 * servidor) e o anexo vinculado (`reuseAttachment`, 1.9 — uma cópia própria,
 * já que um anexo só pertence a um item por vez).
 */
export async function createNoteFromDocument(attachmentId: string): Promise<Result<{ id: string }>> {
  const { supabase, user } = await requireOwner();

  const { data: attachment, error: readError } = await supabase
    .from("attachments")
    .select("file_name, extracted_text, extraction_status")
    .eq("id", attachmentId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (readError || !attachment) return fail("Anexo não encontrado.");
  if (attachment.extraction_status !== "done" || !attachment.extracted_text) {
    return fail("Este anexo ainda não tem texto extraído.");
  }

  const docType = await getObjectTypeBySlug(supabase, "documento");
  const content = markdownToTiptapDoc(attachment.extracted_text);

  const { data: item, error: insertError } = await supabase
    .from("items")
    .insert({
      owner_id: user.id,
      title: attachment.file_name,
      type_id: docType?.id ?? null,
      status: "inbox",
      content: content as unknown as Json,
      content_text: extractText(content),
      source: "import",
    })
    .select("id")
    .single();
  if (insertError || !item) return fail("Não foi possível criar a nota.");

  const linked = await reuseAttachment(attachmentId, item.id);
  if (!linked.ok) return fail("Nota criada, mas não foi possível vincular o anexo. Vincule manualmente.");

  revalidatePath("/inbox");
  return ok({ id: item.id });
}

const DOCUMENT_SUMMARY_SYSTEM_PROMPT =
  "Você resume documentos em português do Brasil, com fidelidade ao conteúdo, em 1 ou 2 parágrafos curtos.";

/**
 * "Resumir documento" (2.9): resumo curto com Claude, inserido no item do
 * anexo (não cria item novo). Chamada síncrona (não um job, ao contrário do
 * OCR e do resumo de reunião, 2.7) — é um pedido manual único, texto de
 * entrada já limitado pela extração (`MAX_PLAIN_TEXT_CHARS`), cabe numa
 * chamada só sem precisar de fila. Versão `reason='ai'` salva antes de
 * alterar o conteúdo, mesmo padrão da 2.7.
 */
export async function summarizeDocument(attachmentId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { data: attachment, error: readError } = await supabase
    .from("attachments")
    .select("item_id, extracted_text, extraction_status")
    .eq("id", attachmentId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (readError || !attachment || !attachment.item_id) return fail("Anexo não encontrado.");
  if (attachment.extraction_status !== "done" || !attachment.extracted_text) {
    return fail("Este anexo ainda não tem texto extraído.");
  }

  let summaryText: string;
  try {
    const result = await callClaude({
      ownerId: user.id,
      itemId: attachment.item_id,
      feature: "document_summary",
      system: DOCUMENT_SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: attachment.extracted_text }],
    });
    summaryText = result.text;
  } catch (err) {
    if (err instanceof AiDisabledError || err instanceof AiBudgetExceededError) return fail(err.message);
    return fail("Não foi possível gerar o resumo. Tente de novo.");
  }

  const { data: item, error: itemReadError } = await supabase
    .from("items")
    .select("title, content, properties")
    .eq("id", attachment.item_id)
    .maybeSingle();
  if (itemReadError || !item) return fail("Item não encontrado.");

  const { error: versionError } = await supabase.from("item_versions").insert({
    owner_id: user.id,
    item_id: attachment.item_id,
    title: item.title,
    content: item.content,
    properties: item.properties,
    reason: "ai",
  });
  if (versionError) return fail(GENERIC_ERROR);

  const existingContent = (item.content as unknown as JSONContent | null) ?? null;
  const summaryDoc = markdownToTiptapDoc(summaryText);
  const newContent: JSONContent = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Resumo do documento" }] },
      ...(summaryDoc.content ?? []),
      ...(existingContent?.content ?? []),
    ],
  };

  const { error: updateError } = await supabase
    .from("items")
    .update({ content: newContent as unknown as Json, content_text: extractText(newContent) })
    .eq("id", attachment.item_id);
  if (updateError) return fail("Resumo gerado, mas não foi possível salvar no item.");

  revalidatePath(`/itens/${attachment.item_id}`);
  return ok(null);
}

/**
 * "Escanear" (2.10): cria o item que vai receber as fotos digitalizadas —
 * mesmo padrão do "Gravar"/"Gravar reunião" (2.5, `createRecordingItem`):
 * cria o item vazio primeiro, só pra ter um `itemId` pra anexar as fotos
 * conforme cada uma é enviada.
 */
export async function createScanItem(): Promise<Result<{ id: string }>> {
  const { supabase, user } = await requireOwner();

  const docType = await getObjectTypeBySlug(supabase, "documento");
  const title = `Documento escaneado — ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`;

  const result = await createCaptureItem(supabase, {
    ownerId: user.id,
    title,
    body: "",
    spaceId: null,
    typeId: docType?.id ?? null,
    source: "scan",
  });
  if (!result) return fail("Não foi possível criar o item.");

  revalidatePath("/inbox");
  return ok(result);
}
