import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";

export type Job = Tables<"jobs">;

export interface JobContext {
  /** Cliente admin (service role) — jobs rodam fora de sessão de usuário. */
  supabase: SupabaseClient<Database>;
}

export type JobOutcome =
  | { status: "done"; result?: unknown }
  | { status: "retry"; error: string; delaySeconds?: number }
  | { status: "failed"; error: string };

export type JobHandler = (job: Job, ctx: JobContext) => Promise<JobOutcome>;
