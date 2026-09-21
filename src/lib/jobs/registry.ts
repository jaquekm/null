import "server-only";
import { calendarPush } from "./handlers/calendar-push";
import { calendarSync } from "./handlers/calendar-sync";
import { closeCardStatements } from "./handlers/close-card-statements";
import { dispatchReminders } from "./handlers/dispatch-reminders";
import { extractAttachment } from "./handlers/extract-attachment";
import { generateBills } from "./handlers/generate-bills";
import { generateReminders } from "./handlers/generate-reminders";
import { pollTranscription } from "./handlers/poll-transcription";
import { prepareMeetingNotes } from "./handlers/prepare-meeting-notes";
import { purgeTrash } from "./handlers/purge-trash";
import { summarizeTranscript } from "./handlers/summarize-transcript";
import { transcribeAudio } from "./handlers/transcribe-audio";
import type { JobHandler } from "./types";

/**
 * Um handler por `kind` de job (2.2). Fases seguintes registram mais:
 * `index_item`/`run_automation` (fase 5), `generate_report` (fase 6).
 */
export const handlers: Record<string, JobHandler> = {
  purge_trash: purgeTrash,
  transcribe_audio: transcribeAudio,
  poll_transcription: pollTranscription,
  summarize_transcript: summarizeTranscript,
  extract_attachment: extractAttachment,
  calendar_sync: calendarSync,
  calendar_push: calendarPush,
  prepare_meeting_notes: prepareMeetingNotes,
  dispatch_reminders: dispatchReminders,
  generate_reminders: generateReminders,
  close_card_statements: closeCardStatements,
  generate_bills: generateBills,
};
