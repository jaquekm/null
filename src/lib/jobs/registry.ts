import "server-only";
import { pollTranscription } from "./handlers/poll-transcription";
import { purgeTrash } from "./handlers/purge-trash";
import { transcribeAudio } from "./handlers/transcribe-audio";
import type { JobHandler } from "./types";

/**
 * Um handler por `kind` de job (2.2). Fases seguintes registram mais:
 * `summarize_transcript` (2.7), `extract_attachment` (2.9),
 * `calendar_sync`/`dispatch_reminders`/`generate_reminders` (fase 3),
 * `index_item`/`run_automation` (fase 5), `generate_report` (fase 6).
 */
export const handlers: Record<string, JobHandler> = {
  purge_trash: purgeTrash,
  transcribe_audio: transcribeAudio,
  poll_transcription: pollTranscription,
};
