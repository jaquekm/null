import { Upload } from "tus-js-client";
import { publicEnv } from "@/lib/env";
import { fail, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/client";
import { findDuplicateAttachment, recordAttachment, reuseAttachment } from "../actions";
import type { AttachmentRow } from "../queries";
import { buildStoragePath } from "./build-storage-path";
import { MAX_ATTACHMENT_SIZE_BYTES, RESUMABLE_UPLOAD_THRESHOLD_BYTES } from "./limits";
import { sha256OfFile } from "./sha256";

export interface UploadOutcome {
  attachment: AttachmentRow;
  reused: boolean;
}

/**
 * Orquestra o envio de um anexo (1.9): calcula o sha256, checa duplicata
 * (reaproveita se existir), senão envia — upload padrão até 6 MB, resumível
 * (TUS) acima disso — e registra a linha em `attachments`.
 */
export async function uploadAttachment(
  itemId: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<Result<UploadOutcome | null>> {
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return fail(`Arquivo maior que o limite do plano (${Math.round(MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024)} MB).`);
  }

  const sha256 = await sha256OfFile(file);

  const duplicate = await findDuplicateAttachment(sha256);
  if (!duplicate.ok) return duplicate;

  if (duplicate.data) {
    const reused = await reuseAttachment(duplicate.data.id, itemId);
    if (!reused.ok) return reused;
    if (!reused.data) return fail("Não foi possível reaproveitar o anexo.");
    onProgress?.(1);
    return ok({ attachment: reused.data, reused: true });
  }

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return fail("Sessão expirada. Recarregue a página.");

  const path = buildStoragePath(userData.user.id, itemId, crypto.randomUUID(), file.name);
  const contentType = file.type || "application/octet-stream";

  if (file.size > RESUMABLE_UPLOAD_THRESHOLD_BYTES) {
    try {
      await uploadViaTus(path, file, contentType, onProgress);
    } catch {
      return fail("Não foi possível enviar o arquivo.");
    }
  } else {
    const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType });
    if (error) return fail("Não foi possível enviar o arquivo.");
    onProgress?.(1);
  }

  const recorded = await recordAttachment({
    itemId,
    storagePath: path,
    fileName: file.name,
    mimeType: contentType,
    sizeBytes: file.size,
    sha256,
  });
  if (!recorded.ok) return recorded;
  if (!recorded.data) return fail("Não foi possível registrar o anexo.");
  return ok({ attachment: recorded.data, reused: false });
}

async function uploadViaTus(
  path: string,
  file: File,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Sessão expirada.");

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: "attachments",
        objectName: path,
        contentType,
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024,
      onError: (error) => reject(error),
      onProgress: (bytesSent, bytesTotal) => onProgress?.(bytesSent / bytesTotal),
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}
