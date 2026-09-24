import type { JobHandler } from "../types";

const JOBS_RETENTION_DAYS = 30;
const SHARE_LINK_VIEWS_RETENTION_DAYS = 180;
const AUTOMATION_EVENT_LOG_RETENTION_DAYS = 7;
const CANCELLED_EVENTS_RETENTION_DAYS = 30;
const EXPORTS_RETENTION_DAYS = 7;

function cutoff(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Job periódico (7.9, diário via `job_schedules`): os 5 alvos de limpeza do
 * enunciado. `jobs` concluídos usam `finished_at` (nunca apaga o próprio job
 * "cleanup_old_data" em execução — ele só vira `status: 'done'` depois que
 * este handler retorna). "Exportações" não tem tabela própria — desde a 7.4
 * elas são linhas de `backup_runs` com `kind: 'export'` (mesmo registro do
 * backup externo).
 */
export const cleanupOldData: JobHandler = async (job, { supabase }) => {
  const ownerId = job.owner_id;
  const result: Record<string, number> = {};

  const { data: oldJobs, error: jobsError } = await supabase
    .from("jobs")
    .delete()
    .eq("owner_id", ownerId)
    .eq("status", "done")
    .lt("finished_at", cutoff(JOBS_RETENTION_DAYS))
    .select("id");
  if (jobsError) return { status: "retry", error: jobsError.message };
  result.jobs = oldJobs?.length ?? 0;

  const { data: oldViews, error: viewsError } = await supabase
    .from("share_link_views")
    .delete()
    .eq("owner_id", ownerId)
    .lt("created_at", cutoff(SHARE_LINK_VIEWS_RETENTION_DAYS))
    .select("id");
  if (viewsError) return { status: "retry", error: viewsError.message };
  result.shareLinkViews = oldViews?.length ?? 0;

  const { data: oldLogs, error: logsError } = await supabase
    .from("automation_event_log")
    .delete()
    .eq("owner_id", ownerId)
    .lt("created_at", cutoff(AUTOMATION_EVENT_LOG_RETENTION_DAYS))
    .select("id");
  if (logsError) return { status: "retry", error: logsError.message };
  result.automationEventLog = oldLogs?.length ?? 0;

  const { data: oldCancelledEvents, error: eventsError } = await supabase
    .from("events")
    .delete()
    .eq("owner_id", ownerId)
    .eq("status", "cancelled")
    .lt("updated_at", cutoff(CANCELLED_EVENTS_RETENTION_DAYS))
    .select("id");
  if (eventsError) return { status: "retry", error: eventsError.message };
  result.cancelledEvents = oldCancelledEvents?.length ?? 0;

  const { data: oldExports, error: exportsError } = await supabase
    .from("backup_runs")
    .delete()
    .eq("owner_id", ownerId)
    .eq("kind", "export")
    .lt("created_at", cutoff(EXPORTS_RETENTION_DAYS))
    .select("id");
  if (exportsError) return { status: "retry", error: exportsError.message };
  result.exports = oldExports?.length ?? 0;

  return { status: "done", result };
};
