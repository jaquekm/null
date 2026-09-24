import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface AttachmentRow {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  extractionStatus: string;
  /** Miniatura gerada no navegador antes do upload (7.9) — `null` quando não é imagem ou a geração falhou. */
  thumbnailPath: string | null;
}

export async function listItemAttachments(supabase: Client, itemId: string): Promise<AttachmentRow[]> {
  const { data, error } = await supabase
    .from("attachments")
    .select("id, file_name, mime_type, size_bytes, created_at, extraction_status, thumbnail_path")
    .eq("item_id", itemId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((a) => ({
    id: a.id,
    fileName: a.file_name,
    mimeType: a.mime_type,
    sizeBytes: a.size_bytes,
    createdAt: a.created_at,
    extractionStatus: a.extraction_status,
    thumbnailPath: a.thumbnail_path,
  }));
}

export interface AttachmentWithPath extends AttachmentRow {
  storagePath: string;
}

export async function getAttachmentById(supabase: Client, id: string): Promise<AttachmentWithPath | null> {
  const { data, error } = await supabase
    .from("attachments")
    .select("id, file_name, mime_type, size_bytes, created_at, storage_path, extraction_status, thumbnail_path")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    fileName: data.file_name,
    mimeType: data.mime_type,
    sizeBytes: data.size_bytes,
    createdAt: data.created_at,
    storagePath: data.storage_path,
    extractionStatus: data.extraction_status,
    thumbnailPath: data.thumbnail_path,
  };
}
