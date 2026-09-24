import { getBackupStatus, countFailedJobsSince, countMcpTokensExpiringSoon, countOldShareLinksWithoutExpiry, getMonthlyAiSpendUsd, getTotalAttachmentsBytes, hasRevokedGoogleConnection } from "@/features/ops/queries";
import { evaluateAiBudget, evaluateBackupFresh, evaluateGoogleConnection, evaluateJobsFailing, evaluateMcpTokensExpiring, evaluateOldShareLinks, evaluateStorageUsage, type CheckResult } from "@/features/ops/lib/evaluate-health";
import { serverEnv } from "@/lib/env";
import { logEvent } from "@/lib/observability/log";
import { notifyOwner } from "@/lib/messaging/notify-owner";
import type { JobHandler } from "../types";

const FAILED_JOBS_WINDOW_HOURS = 24;

/**
 * Job `ops_daily_check` (7.6, diário): verifica jobs falhando, backup
 * atrasado, Google desconectado, orçamento de IA, tokens MCP expirando,
 * links compartilhados antigos sem validade e uso de Storage — só manda
 * push se **algum** desses estiver com problema (o enunciado é explícito:
 * "manda push/e-mail só se houver problema"). Sobreposição de propósito com
 * `check_mcp_token_expiry` (6.9, aviso por token): este job é um resumo
 * diário de tudo junto, aquele é o aviso imediato por token — os dois
 * convivem.
 */
export const opsDailyCheck: JobHandler = async (job, { supabase }) => {
  const ownerId = job.owner_id;
  const failedSince = new Date(Date.now() - FAILED_JOBS_WINDOW_HOURS * 60 * 60 * 1000);

  const [failedJobs, backupStatus, hasRevoked, spentUsd, mcpExpiring, oldShareLinks, storageBytes] = await Promise.all([
    countFailedJobsSince(supabase, ownerId, failedSince),
    getBackupStatus(supabase),
    hasRevokedGoogleConnection(supabase, ownerId),
    getMonthlyAiSpendUsd(supabase, ownerId),
    countMcpTokensExpiringSoon(supabase, ownerId),
    countOldShareLinksWithoutExpiry(supabase, ownerId),
    getTotalAttachmentsBytes(supabase, ownerId),
  ]);

  const checks: CheckResult[] = [
    evaluateJobsFailing(failedJobs),
    evaluateBackupFresh(backupStatus.databaseStale),
    evaluateGoogleConnection(hasRevoked),
    evaluateMcpTokensExpiring(mcpExpiring),
    evaluateOldShareLinks(oldShareLinks),
  ];
  const aiCheck = evaluateAiBudget(spentUsd, serverEnv.AI_MONTHLY_BUDGET_USD);
  if (aiCheck) checks.push(aiCheck);
  const storageCheck = evaluateStorageUsage(storageBytes, serverEnv.STORAGE_PLAN_LIMIT_BYTES);
  if (storageCheck) checks.push(storageCheck);

  const problems = checks.filter((c) => !c.ok);
  logEvent(problems.length > 0 ? "warn" : "info", "ops_daily_check", { jobId: job.id, problems: problems.map((p) => p.key) });

  if (problems.length > 0) {
    await notifyOwner(ownerId, {
      title: `Verificação diária: ${problems.length} ponto(s) de atenção`,
      text: problems.map((p) => `• ${p.detail}`).join("\n"),
    });
  }

  return { status: "done", result: { problems: problems.map((p) => p.key) } };
};
