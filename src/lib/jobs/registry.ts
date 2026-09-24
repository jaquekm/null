import "server-only";
import { calendarPush } from "./handlers/calendar-push";
import { calendarSync } from "./handlers/calendar-sync";
import { checkBudgets } from "./handlers/check-budgets";
import { checkMcpTokenExpiry } from "./handlers/check-mcp-token-expiry";
import { checkReviewsDue } from "./handlers/check-reviews-due";
import { cleanupOldData } from "./handlers/cleanup-old-data";
import { closeCardStatements } from "./handlers/close-card-statements";
import { dispatchReminders } from "./handlers/dispatch-reminders";
import { evaluateTimeAutomations } from "./handlers/evaluate-time-automations";
import { exportAll } from "./handlers/export-all";
import { extractAttachment } from "./handlers/extract-attachment";
import { generateBills } from "./handlers/generate-bills";
import { generateReminders } from "./handlers/generate-reminders";
import { generateReport } from "./handlers/generate-report";
import { indexItem } from "./handlers/index-item";
import { opsDailyCheck } from "./handlers/ops-daily-check";
import { pollTranscription } from "./handlers/poll-transcription";
import { prepareMeetingNotes } from "./handlers/prepare-meeting-notes";
import { purgeTrash } from "./handlers/purge-trash";
import { reencryptSecrets } from "./handlers/reencrypt-secrets";
import { remindRestoreTest } from "./handlers/remind-restore-test";
import { runAutomations } from "./handlers/run-automations";
import { scheduleReports } from "./handlers/schedule-reports";
import { summarizeTranscript } from "./handlers/summarize-transcript";
import { transcribeAudio } from "./handlers/transcribe-audio";
import type { JobHandler } from "./types";

/** Um handler por `kind` de job (2.2). */
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
  check_budgets: checkBudgets,
  check_reviews_due: checkReviewsDue,
  run_automations: runAutomations,
  evaluate_time_automations: evaluateTimeAutomations,
  generate_report: generateReport,
  schedule_reports: scheduleReports,
  index_item: indexItem,
  check_mcp_token_expiry: checkMcpTokenExpiry,
  remind_restore_test: remindRestoreTest,
  export_all: exportAll,
  ops_daily_check: opsDailyCheck,
  reencrypt_secrets: reencryptSecrets,
  cleanup_old_data: cleanupOldData,
};
