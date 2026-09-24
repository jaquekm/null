import { notifyOwner } from "@/lib/messaging/notify-owner";
import type { JobHandler } from "../types";

/** Só lembra se o último teste (bem-sucedido ou não) foi há mais de ~25 dias — não incomoda se o dono já rodou um há pouco fora do agendamento. */
const REMINDER_THRESHOLD_DAYS = 25;

/**
 * Job `remind_restore_test` (7.3, "push de lembrete mensal para o dono
 * executar/confirmar"): o teste de restauração em si roda no GitHub
 * Actions (`restore-test.yml`, manual — não dá pra disparar por webhook a
 * partir do Hub), então este job só cobra o lembrete; quem de fato roda e
 * registra o resultado (`backup_runs`, kind `restore_test`) é o workflow,
 * via `/api/ops/backup-report`.
 */
export const remindRestoreTest: JobHandler = async (job, { supabase }) => {
  const { data: lastRun } = await supabase
    .from("backup_runs")
    .select("created_at")
    .eq("owner_id", job.owner_id)
    .eq("kind", "restore_test")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const daysSinceLastRun = lastRun ? (Date.now() - new Date(lastRun.created_at).getTime()) / (24 * 60 * 60 * 1000) : Infinity;
  if (daysSinceLastRun < REMINDER_THRESHOLD_DAYS) {
    return { status: "done", result: { skipped: "recent_test" } };
  }

  await notifyOwner(job.owner_id, {
    title: "Teste de restauração do backup",
    text: lastRun
      ? `O último teste foi há ${Math.floor(daysSinceLastRun)} dias. Rode o workflow "restore-test" no GitHub Actions pra confirmar que o backup ainda restaura.`
      : 'Nenhum teste de restauração registrado ainda. Rode o workflow "restore-test" no GitHub Actions — ver docs/restauracao.md.',
  });

  return { status: "done", result: { reminded: true, daysSinceLastRun: Number.isFinite(daysSinceLastRun) ? Math.floor(daysSinceLastRun) : null } };
};
