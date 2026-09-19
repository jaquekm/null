"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Database } from "@/lib/supabase/database.types";
import { buildStoragePath } from "./lib/build-storage-path";
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
  itemId: z.string().uuid(),
  storagePath: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().length(64),
  durationSeconds: z.number().positive().optional(),
});

/** Registra a linha em `attachments` depois de um upload direto ao Storage ter dado certo. */
export async function recordAttachment(input: z.infer<typeof recordSchema>): Promise<Result<AttachmentRow | null>> {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return fail(GENERIC_ERROR);

  const { supabase, user } = await requireOwner();

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      owner_id: user.id,
      item_id: parsed.data.itemId,
      storage_path: parsed.data.storagePath,
      file_name: parsed.data.fileName,
      mime_type: parsed.data.mimeType,
      size_bytes: parsed.data.sizeBytes,
      sha256: parsed.data.sha256,
      duration_seconds: parsed.data.durationSeconds ?? null,
    })
    .select("id, file_name, mime_type, size_bytes, created_at")
    .single();

  if (error || !data) return fail(GENERIC_ERROR);

  revalidatePath(`/itens/${parsed.data.itemId}`);
  return ok({ id: data.id, fileName: data.file_name, mimeType: data.mime_type, sizeBytes: data.size_bytes, createdAt: data.created_at });
}

/**
 * "Reutilizar" um anexo idêntico (1.9): copia o objeto no Storage para um
 * caminho novo (evita reenviar os bytes) e cria uma linha própria — cada
 * anexo tem seu próprio `storage_path` único, mesmo reaproveitando o
 * conteúdo.
 */
export async function reuseAttachment(
  existingAttachmentId: string,
  itemId: string,
): Promise<Result<AttachmentRow | null>> {
  const { supabase, user } = await requireOwner();

  const { data: existing, error: readError } = await supabase
    .from("attachments")
    .select("storage_path, file_name, mime_type, size_bytes, sha256")
    .eq("id", existingAttachmentId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (readError || !existing) return fail("Anexo original não encontrado.");

  const newPath = buildStoragePath(user.id, itemId, crypto.randomUUID(), existing.file_name);

  const { error: copyError } = await supabase.storage.from("attachments").copy(existing.storage_path, newPath);
  if (copyError) return fail("Não foi possível reaproveitar o anexo.");

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
    })
    .select("id, file_name, mime_type, size_bytes, created_at")
    .single();

  if (error || !data) return fail(GENERIC_ERROR);

  revalidatePath(`/itens/${itemId}`);
  return ok({ id: data.id, fileName: data.file_name, mimeType: data.mime_type, sizeBytes: data.size_bytes, createdAt: data.created_at });
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
