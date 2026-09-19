import "server-only";
import { purgeTrash } from "./handlers/purge-trash";
import type { JobHandler } from "./types";

/**
 * Um handler por `kind` de job (2.2). Fases seguintes registram mais:
 * `transcribe_audio`/`poll_transcription` (2.6), `summarize_transcript`
 * (2.7), `extract_attachment` (2.9), `calendar_sync`/`dispatch_reminders`/
 * `generate_reminders` (fase 3), `index_item`/`run_automation` (fase 5),
 * `generate_report` (fase 6).
 */
export const handlers: Record<string, JobHandler> = {
  purge_trash: purgeTrash,
};
