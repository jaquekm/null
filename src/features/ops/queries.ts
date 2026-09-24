import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/**
 * Resolve o `owner_id` do único dono do Hub (CLAUDE.md: "sistema pessoal...
 * com um único usuário") a partir de `user_settings` — usada por rotas que
 * rodam fora de sessão e sem nenhum outro jeito de saber de quem é o dado
 * (ex.: `/api/ops/backup-report`, chamada pelo workflow do GitHub Actions,
 * que não tem `owner_id` nenhum pra mandar). `user_settings.owner_id` é
 * chave primária — sempre no máximo uma linha por dono, e neste app só
 * existe um dono de verdade.
 */
export async function getSoleOwnerId(admin: Client): Promise<string | null> {
  const { data } = await admin.from("user_settings").select("owner_id").limit(1).maybeSingle();
  return data?.owner_id ?? null;
}

export interface BackupRunInput {
  ownerId: string;
  kind: "database" | "storage" | "restore_test" | "export";
  status: "success" | "failed";
  sizeBytes?: number | null;
  location?: string | null;
  detail?: string | null;
}

/** Registra um backup/exportação/teste de restauração (7.1/7.2/7.3/7.4). */
export async function recordBackupRun(admin: Client, input: BackupRunInput): Promise<void> {
  await admin.from("backup_runs").insert({
    owner_id: input.ownerId,
    kind: input.kind,
    status: input.status,
    size_bytes: input.sizeBytes ?? null,
    location: input.location ?? null,
    detail: input.detail ?? null,
  });
}

export interface LastBackupRun {
  status: "success" | "failed";
  createdAt: string;
  sizeBytes: number | null;
}

export interface BackupStatus {
  database: LastBackupRun | null;
  storage: LastBackupRun | null;
  restoreTest: LastBackupRun | null;
  /** Sem backup de banco bem-sucedido há mais de 48h (7.3, alerta da página). */
  databaseStale: boolean;
  /** Sem teste de restauração há mais de 45 dias (7.3, alerta da página). */
  restoreTestStale: boolean;
}

const STALE_DATABASE_HOURS = 48;
const STALE_RESTORE_TEST_DAYS = 45;

async function lastRunOfKind(supabase: Client, kind: BackupRunInput["kind"]): Promise<LastBackupRun | null> {
  const { data } = await supabase
    .from("backup_runs")
    .select("status, created_at, size_bytes")
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { status: data.status as "success" | "failed", createdAt: data.created_at, sizeBytes: data.size_bytes };
}

/** `/configuracoes/backup` (7.3): último backup de banco/arquivos, último teste de restauração, e os dois alertas do enunciado. */
export async function getBackupStatus(supabase: Client): Promise<BackupStatus> {
  const [database, storage, restoreTest] = await Promise.all([
    lastRunOfKind(supabase, "database"),
    lastRunOfKind(supabase, "storage"),
    lastRunOfKind(supabase, "restore_test"),
  ]);

  const hoursSinceDatabase = database ? (Date.now() - new Date(database.createdAt).getTime()) / (60 * 60 * 1000) : Infinity;
  const daysSinceRestoreTest = restoreTest ? (Date.now() - new Date(restoreTest.createdAt).getTime()) / (24 * 60 * 60 * 1000) : Infinity;

  return {
    database,
    storage,
    restoreTest,
    databaseStale: !(database?.status === "success") || hoursSinceDatabase > STALE_DATABASE_HOURS,
    restoreTestStale: !(restoreTest?.status === "success") || daysSinceRestoreTest > STALE_RESTORE_TEST_DAYS,
  };
}

/** Agenda o job `remind_restore_test` (7.3, ~mensal) pro dono, se ainda não existir — mesmo padrão "garante na primeira visita de verdade" de `ensureReportScheduleJob` (6.4), chamado a partir de `/configuracoes/backup`. */
export async function ensureRestoreTestReminderSchedule(supabase: Client, ownerId: string): Promise<void> {
  await supabase.from("job_schedules").upsert({ kind: "remind_restore_test", owner_id: ownerId, interval_seconds: 30 * 24 * 60 * 60, enabled: true }, { onConflict: "kind" });
}

/** Agenda o job `ops_daily_check` (7.6, diário) pro dono, se ainda não existir — chamado a partir de `/configuracoes` (visitada com frequência, ao contrário de uma tela dedicada de monitoramento, que o enunciado não pede). */
export async function ensureOpsDailyCheckSchedule(supabase: Client, ownerId: string): Promise<void> {
  await supabase.from("job_schedules").upsert({ kind: "ops_daily_check", owner_id: ownerId, interval_seconds: 24 * 60 * 60, enabled: true }, { onConflict: "kind" });
}

/** Agenda o job `cleanup_old_data` (7.9, diário) — mesmo padrão de `ensureOpsDailyCheckSchedule`. */
export async function ensureCleanupSchedule(supabase: Client, ownerId: string): Promise<void> {
  await supabase.from("job_schedules").upsert({ kind: "cleanup_old_data", owner_id: ownerId, interval_seconds: 24 * 60 * 60, enabled: true }, { onConflict: "kind" });
}

/** Carimba que `/api/jobs/tick` (2.2) rodou agora — "último tick de jobs < 5 min" (7.6) precisa disso mesmo quando não havia nenhum job pra processar. */
export async function recordTickHeartbeat(admin: Client, ownerId: string): Promise<void> {
  await admin.from("ops_heartbeat").upsert({ owner_id: ownerId, last_tick_at: new Date().toISOString() }, { onConflict: "owner_id" });
}

export async function getLastTickAt(admin: Client, ownerId: string): Promise<string | null> {
  const { data } = await admin.from("ops_heartbeat").select("last_tick_at").eq("owner_id", ownerId).maybeSingle();
  return data?.last_tick_at ?? null;
}

export async function checkDatabaseConnectivity(admin: Client): Promise<boolean> {
  const { error } = await admin.from("user_settings").select("owner_id").limit(1);
  return !error;
}

export async function countFailedJobsSince(admin: Client, ownerId: string, since: Date): Promise<number> {
  const { count } = await admin.from("jobs").select("*", { count: "exact", head: true }).eq("owner_id", ownerId).eq("status", "failed").gte("updated_at", since.toISOString());
  return count ?? 0;
}

export async function hasRevokedGoogleConnection(admin: Client, ownerId: string): Promise<boolean> {
  const { count } = await admin.from("google_connections").select("*", { count: "exact", head: true }).eq("owner_id", ownerId).neq("status", "active");
  return (count ?? 0) > 0;
}

/** Mesma consulta de `assertWithinBudget` (`src/lib/ai/claude.ts`), reaproveitada pro digest do `ops_daily_check` (7.6) em vez de pra travar uma chamada de IA. */
export async function getMonthlyAiSpendUsd(admin: Client, ownerId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { data } = await admin.from("usage_events").select("cost_usd").eq("owner_id", ownerId).eq("provider", "anthropic").gte("created_at", startOfMonth.toISOString());
  return (data ?? []).reduce((sum, row) => sum + (row.cost_usd ?? 0), 0);
}

export async function countMcpTokensExpiringSoon(admin: Client, ownerId: string): Promise<number> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { count } = await admin
    .from("api_tokens")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .is("revoked_at", null)
    .not("expires_at", "is", null)
    .gte("expires_at", now.toISOString())
    .lte("expires_at", windowEnd.toISOString());
  return count ?? 0;
}

/** "Links compartilhados sem validade antigos" (7.6) — sem `expires_at` e criados há mais de 90 dias, ainda não revogados. */
export async function countOldShareLinksWithoutExpiry(admin: Client, ownerId: string): Promise<number> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const { count } = await admin
    .from("share_links")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .is("revoked_at", null)
    .is("expires_at", null)
    .lte("created_at", cutoff.toISOString());
  return count ?? 0;
}

/** Aproximação do uso de Storage — soma de `attachments.size_bytes` (não inclui o que não é anexo, ex.: exports/backups temporários, mas é o que o app sabe medir sem chamar a API de gerenciamento do Supabase). */
export async function getTotalAttachmentsBytes(admin: Client, ownerId: string): Promise<number> {
  const { data } = await admin.from("attachments").select("size_bytes").eq("owner_id", ownerId);
  return (data ?? []).reduce((sum, row) => sum + (row.size_bytes ?? 0), 0);
}
