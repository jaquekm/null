import { Upload } from "tus-js-client";
import { publicEnv } from "@/lib/env";
import { fail, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/client";
import { findDuplicateAttachment, recordAttachment, reuseAttachment } from "../actions";
import type { AttachmentRow } from "../queries";
import { buildStoragePath } from "./build-storage-path";
import { generateThumbnail } from "./generate-thumbnail";
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
 * `itemId` nulo = anexo avulso, sem item (4.8: boleto de conta a pagar) —
 * nesse caso a reutilização por hash é pulada (o "reaproveitar" da 1.9
 * sempre associa a cópia a um item, o que não se aplica aqui).
 */
export async function uploadAttachment(
  itemId: string | null,
  file: File,
  onProgress?: (fraction: number) => void,
  durationSeconds?: number,
  skipExtraction?: boolean,
): Promise<Result<UploadOutcome | null>> {
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return fail(`Arquivo maior que o limite do plano (${Math.round(MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024)} MB).`);
  }

  const sha256 = await sha256OfFile(file);

  if (itemId) {
    const duplicate = await findDuplicateAttachment(sha256);
    if (!duplicate.ok) return duplicate;

    if (duplicate.data) {
      const reused = await reuseAttachment(duplicate.data.id, itemId);
      if (!reused.ok) return reused;
      if (!reused.data) return fail("Não foi possível reaproveitar o anexo.");
      onProgress?.(1);
      return ok({ attachment: reused.data, reused: true });
    }
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

  const thumbnailPath = await uploadThumbnailIfImage(supabase, path, file);

  const recorded = await recordAttachment({
    itemId: itemId ?? undefined,
    storagePath: path,
    fileName: file.name,
    mimeType: contentType,
    sizeBytes: file.size,
    sha256,
    durationSeconds,
    skipExtraction,
    thumbnailPath: thumbnailPath ?? undefined,
  });
  if (!recorded.ok) return recorded;
  if (!recorded.data) return fail("Não foi possível registrar o anexo.");
  return ok({ attachment: recorded.data, reused: false });
}

/**
 * Gera e envia a miniatura (7.9) — melhor esforço: qualquer falha (formato
 * não suportado pelo navegador, erro de rede) só deixa a miniatura de fora,
 * nunca derruba o upload do arquivo original que já terminou.
 */
async function uploadThumbnailIfImage(supabase: ReturnType<typeof createClient>, originalPath: string, file: File): Promise<string | null> {
  try {
    const thumbnail = await generateThumbnail(file);
    if (!thumbnail) return null;

    const thumbnailPath = `${originalPath}.thumb.jpg`;
    const { error } = await supabase.storage.from("attachments").upload(thumbnailPath, thumbnail, { contentType: "image/jpeg" });
    if (error) return null;
    return thumbnailPath;
  } catch {
    return null;
  }
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
