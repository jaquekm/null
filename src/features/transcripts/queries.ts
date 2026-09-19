import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MeetingSummary } from "@/features/media/schemas";
import type { Database } from "@/lib/supabase/database.types";
import type { Segment } from "@/lib/transcription/types";

type Client = SupabaseClient<Database>;

export interface TranscriptForItem {
  id: string;
  attachmentId: string;
  status: string;
  text: string | null;
  segments: Segment[];
  speakerNames: Record<string, string>;
  summary: MeetingSummary | null;
  durationSeconds: number | null;
  error: string | null;
}

/** A transcrição mais recente de um item (normalmente só existe uma) — usada pra decidir o que mostrar na página do item (2.7/2.8). */
export async function getTranscriptForItem(supabase: Client, itemId: string): Promise<TranscriptForItem | null> {
  const { data, error } = await supabase
    .from("transcripts")
    .select("id, attachment_id, status, text, segments, speaker_names, summary, duration_seconds, error")
    .eq("item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    attachmentId: data.attachment_id,
    status: data.status,
    text: data.text,
    segments: (data.segments as unknown as Segment[] | null) ?? [],
    speakerNames: (data.speaker_names as unknown as Record<string, string> | null) ?? {},
    summary: (data.summary as unknown as MeetingSummary | null) ?? null,
    durationSeconds: data.duration_seconds,
    error: data.error,
  };
}
