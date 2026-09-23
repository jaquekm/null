import { nextOccurrence } from "@/features/reminders/lib/recurrence";
import { listDueReportDefinitions, updateReportDefinitionNextRun } from "@/features/reports/queries";
import { enqueueJob } from "../enqueue";
import type { JobHandler } from "../types";

/**
 * Job periódico `schedule_reports` (6.4, a cada 15 min — `job_schedules`,
 * `ensureReportScheduleJob`): definições agendadas (`schedule_rrule` não
 * nulo, `enabled`, `next_run_at` vencido) disparam `generate_report` e têm
 * a próxima ocorrência recalculada. Mesmo padrão de "consulta `next_run_at`,
 * enfileira, reagenda" de `evaluate_time_automations` (5.3) — só que a
 * própria coluna já guarda `next_run_at` (não precisa reconstruir a partir
 * de `last_run_at`, `report_definitions` já nasceu com essa coluna na
 * migration 6.1).
 */
export const scheduleReports: JobHandler = async (job, { supabase }) => {
  const now = new Date();
  const due = await listDueReportDefinitions(supabase, job.owner_id, now);

  for (const definition of due) {
    await enqueueJob({
      ownerId: job.owner_id,
      kind: "generate_report",
      payload: { definitionId: definition.id },
      dedupeKey: `generate_report:${definition.id}:${definition.nextRunAt}`,
    });

    const next = definition.scheduleRrule ? nextOccurrence(definition.scheduleRrule, definition.timezone, now) : null;
    await updateReportDefinitionNextRun(supabase, definition.id, next?.toISOString() ?? null);
  }

  return { status: "done", result: { triggered: due.length } };
};
