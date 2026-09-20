import { dispatchReminderOccurrence } from "@/features/reminders/lib/dispatch";
import type { JobHandler } from "../types";

const BATCH_LIMIT = 50;

/**
 * Job `dispatch_reminders` (3.8, periódico a cada minuto): pega os lembretes
 * `scheduled` já vencidos e processa cada ocorrência (`dispatchReminderOccurrence`,
 * compartilhado com o botão "Enviar agora").
 */
export const dispatchReminders: JobHandler = async (job, { supabase }) => {
  const { data: reminders, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("owner_id", job.owner_id)
    .eq("status", "scheduled")
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(BATCH_LIMIT);
  if (error) return { status: "retry", error: error.message };
  if (!reminders || reminders.length === 0) return { status: "done", result: { processed: 0 } };

  const errors: string[] = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reminder of reminders) {
    try {
      const result = await dispatchReminderOccurrence(supabase, job.owner_id, reminder);
      sent += result.sent;
      failed += result.failed;
      skipped += result.skipped;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Falha ao processar o lembrete ${reminder.id}.`);
    }
  }

  if (errors.length > 0) return { status: "retry", error: errors.join("; ") };
  return { status: "done", result: { processed: reminders.length, sent, failed, skipped } };
};
