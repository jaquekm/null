import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { ensureRestoreTestReminderSchedule, getBackupStatus, type LastBackupRun } from "@/features/ops/queries";
import { requireOwner } from "@/lib/auth";

const KIND_LABELS = { database: "Backup do banco", storage: "Backup de arquivos", restoreTest: "Teste de restauração" } as const;

function formatSize(bytes: number | null): string {
  if (bytes == null) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? ` — ${mb.toFixed(1)} MB` : ` — ${(bytes / 1024).toFixed(0)} KB`;
}

function StatusCard({ label, run, stale, staleReason }: { label: string; run: LastBackupRun | null; stale: boolean; staleReason: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
      {stale ? (
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
      )}
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-black dark:text-zinc-50">{label}</p>
        {run ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {run.status === "success" ? "Sucesso" : "Falhou"} em {new Date(run.createdAt).toLocaleString("pt-BR")}
            {formatSize(run.sizeBytes)}
          </p>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Nenhum registro ainda.</p>
        )}
        {stale && <p className="text-xs text-amber-600 dark:text-amber-400">{staleReason}</p>}
      </div>
    </div>
  );
}

/** `/configuracoes/backup` (7.3): status dos backups + alertas de atraso. Os workflows em si rodam no GitHub Actions (7.1/7.2/7.3) — esta página só lê o que `/api/ops/backup-report` já registrou. */
export default async function BackupStatusPage() {
  const { supabase, user } = await requireOwner();

  await ensureRestoreTestReminderSchedule(supabase, user.id);
  const status = await getBackupStatus(supabase);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Backup</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Banco e arquivos são copiados fora do Supabase e da Vercel por workflows do GitHub Actions
          (<code>backup.yml</code> diário, <code>storage-backup.yml</code> semanal). Esta tela só mostra o que já
          rodou — o passo a passo pra restaurar tudo em caso de desastre está em{" "}
          <code>docs/restauracao.md</code>.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <StatusCard
          label={KIND_LABELS.database}
          run={status.database}
          stale={status.databaseStale}
          staleReason="Sem backup de banco bem-sucedido há mais de 48h."
        />
        <StatusCard label={KIND_LABELS.storage} run={status.storage} stale={false} staleReason="" />
        <StatusCard
          label={KIND_LABELS.restoreTest}
          run={status.restoreTest}
          stale={status.restoreTestStale}
          staleReason="Sem teste de restauração há mais de 45 dias — rode o workflow restore-test.yml."
        />
      </div>
    </div>
  );
}
