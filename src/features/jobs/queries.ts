import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface JobRow {
  id: string;
  kind: string;
  status: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  lastError: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface JobListFilters {
  status?: string | null;
  kind?: string | null;
}

const PAGE_SIZE = 30;

export async function listJobs(
  supabase: Client,
  filters: JobListFilters,
  page: number,
): Promise<{ rows: JobRow[]; total: number }> {
  let query = supabase
    .from("jobs")
    .select("id, kind, status, priority, attempts, max_attempts, run_after, last_error, created_at, finished_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.kind) query = query.eq("kind", filters.kind);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: data.map((job) => ({
      id: job.id,
      kind: job.kind,
      status: job.status,
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      runAfter: job.run_after,
      lastError: job.last_error,
      createdAt: job.created_at,
      finishedAt: job.finished_at,
    })),
    total: count ?? 0,
  };
}

export interface JobDetail extends JobRow {
  payload: Record<string, unknown>;
  result: unknown;
}

export async function getJob(supabase: Client, id: string): Promise<JobDetail | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, kind, status, priority, attempts, max_attempts, run_after, last_error, created_at, finished_at, payload, result",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    kind: data.kind,
    status: data.status,
    priority: data.priority,
    attempts: data.attempts,
    maxAttempts: data.max_attempts,
    runAfter: data.run_after,
    lastError: data.last_error,
    createdAt: data.created_at,
    finishedAt: data.finished_at,
    payload: (data.payload as Record<string, unknown> | null) ?? {},
    result: data.result,
  };
}

export async function countFailedJobs(supabase: Client): Promise<number> {
  const { count, error } = await supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "failed");
  if (error) throw error;
  return count ?? 0;
}
