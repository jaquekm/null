"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import { getJob, listJobs, type JobDetail, type JobListFilters, type JobRow } from "./queries";

const GENERIC_ERROR = "Não foi possível concluir a ação.";

/** Busca uma página de jobs pros filtros de status/tipo (2.2) — chamada pelo client a cada mudança de filtro/página. */
export async function getJobsPage(filters: JobListFilters, page: number): Promise<{ rows: JobRow[]; total: number }> {
  const { supabase } = await requireOwner();
  return listJobs(supabase, filters, page);
}

/** Detalhe completo (payload/resultado) buscado sob demanda ao expandir uma linha. */
export async function getJobDetail(jobId: string): Promise<JobDetail | null> {
  const { supabase } = await requireOwner();
  return getJob(supabase, jobId);
}

/** "Tentar de novo" (2.2): volta pra `queued` com as tentativas zeradas — uma nova chance completa, não só mais uma tentativa. */
export async function retryJob(jobId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("jobs")
    .update({
      status: "queued",
      attempts: 0,
      run_after: new Date().toISOString(),
      last_error: null,
      finished_at: null,
      locked_at: null,
    })
    .eq("id", jobId)
    .eq("owner_id", user.id)
    .in("status", ["failed", "canceled"]);

  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/configuracoes/jobs");
  return ok(null);
}

export async function cancelJob(jobId: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("jobs")
    .update({ status: "canceled", finished_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("owner_id", user.id)
    .in("status", ["queued", "running"]);

  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/configuracoes/jobs");
  return ok(null);
}
