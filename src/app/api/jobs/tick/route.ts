import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import { runJob } from "@/lib/jobs/run-job";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { timingSafeEqualStrings } from "@/lib/timing-safe-equal";

/** Ajustar conforme o plano da Vercel (docs/fase-02-midia-transcricao.md, 2.2). */
export const maxDuration = 60;

const TICK_BUDGET_MS = 45_000;
const CLAIM_BATCH_SIZE = 5;

type Client = SupabaseClient<Database>;

async function enqueueDueSchedules(supabase: Client): Promise<void> {
  const { data: schedules, error } = await supabase.from("job_schedules").select("*").eq("enabled", true);
  if (error || !schedules) return;

  const now = Date.now();
  for (const schedule of schedules) {
    const lastAt = schedule.last_enqueued_at ? new Date(schedule.last_enqueued_at).getTime() : null;
    const due = lastAt === null || now - lastAt >= schedule.interval_seconds * 1000;
    if (!due) continue;

    // Insert direto (não `enqueueJob`): já estamos num tick, então o
    // `fetch` sem await de `enqueueJob` pra acelerar o processamento seria
    // só uma chamada redundante a esta mesma rota — o job entra na fila e é
    // reivindicado no `claim_jobs` logo abaixo, na mesma execução.
    const { error: insertError } = await supabase.from("jobs").insert({
      owner_id: schedule.owner_id,
      kind: schedule.kind,
      payload: schedule.payload,
      dedupe_key: `schedule:${schedule.kind}`,
    });
    if (insertError && insertError.code !== "23505") continue;

    await supabase.from("job_schedules").update({ last_enqueued_at: new Date().toISOString() }).eq("kind", schedule.kind);
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!timingSafeEqualStrings(authHeader, `Bearer ${serverEnv.CRON_SECRET}`)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const startedAt = Date.now();

  await enqueueDueSchedules(supabase);

  const processedIds: string[] = [];

  while (Date.now() - startedAt < TICK_BUDGET_MS) {
    const { data: jobs, error } = await supabase.rpc("claim_jobs", { p_limit: CLAIM_BATCH_SIZE });
    if (error || !jobs || jobs.length === 0) break;

    for (const job of jobs) {
      await runJob(supabase, job);
      processedIds.push(job.id);
    }
  }

  return NextResponse.json({ processed: processedIds.length, ids: processedIds });
}
