import { JobsWorkspace } from "@/features/jobs/components/jobs-workspace";
import { listJobs } from "@/features/jobs/queries";
import { handlers } from "@/lib/jobs/registry";
import { requireOwner } from "@/lib/auth";

export default async function JobsPage() {
  const { supabase } = await requireOwner();
  const initial = await listJobs(supabase, {}, 0);
  const kinds = Object.keys(handlers);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Jobs</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Fila de tarefas em segundo plano (transcrição, resumo, extração de texto, limpeza da lixeira...).
        </p>
      </div>
      <JobsWorkspace initialRows={initial.rows} initialTotal={initial.total} kinds={kinds} />
    </div>
  );
}
