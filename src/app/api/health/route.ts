import { NextResponse } from "next/server";
import { getBackupStatus, checkDatabaseConnectivity, countFailedJobsSince, getLastTickAt, getSoleOwnerId, hasRevokedGoogleConnection } from "@/features/ops/queries";
import { evaluateBackupFresh, evaluateDatabaseConnectivity, evaluateGoogleConnection, evaluateJobsFailing, evaluateJobsTick } from "@/features/ops/lib/evaluate-health";
import { logEvent } from "@/lib/observability/log";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { timingSafeEqualStrings } from "@/lib/timing-safe-equal";

const FAILED_JOBS_WINDOW_HOURS = 24;

/**
 * `GET /api/health` (7.6): raso por padrão (monitor externo de
 * disponibilidade, sem segredo — só confirma que o processo responde) ou
 * `?deep=1` (protegido por `CRON_SECRET`, checa banco/jobs/backup/Google —
 * pensado pro mesmo monitor externo rodar com menos frequência, ou pra
 * conferência manual).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";

  if (!deep) {
    return NextResponse.json({ status: "ok", time: new Date().toISOString(), version: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!timingSafeEqualStrings(authHeader, `Bearer ${serverEnv.CRON_SECRET}`)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const ownerId = await getSoleOwnerId(admin);
  if (!ownerId) {
    return NextResponse.json({ status: "degraded", error: "Nenhum dono configurado ainda." }, { status: 503 });
  }

  const failedSince = new Date(Date.now() - FAILED_JOBS_WINDOW_HOURS * 60 * 60 * 1000);
  const [databaseOk, lastTickAt, failedJobs, backupStatus, hasRevoked] = await Promise.all([
    checkDatabaseConnectivity(admin),
    getLastTickAt(admin, ownerId),
    countFailedJobsSince(admin, ownerId, failedSince),
    getBackupStatus(admin),
    hasRevokedGoogleConnection(admin, ownerId),
  ]);

  const checks = [
    evaluateDatabaseConnectivity(databaseOk),
    evaluateJobsTick(lastTickAt, new Date()),
    evaluateJobsFailing(failedJobs),
    evaluateBackupFresh(backupStatus.databaseStale),
    evaluateGoogleConnection(hasRevoked),
  ];

  const allOk = checks.every((c) => c.ok);
  if (!allOk) logEvent("warn", "health_check_degraded", { checks: checks.filter((c) => !c.ok).map((c) => c.key) });

  return NextResponse.json({ status: allOk ? "ok" : "degraded", time: new Date().toISOString(), checks }, { status: allOk ? 200 : 503 });
}
