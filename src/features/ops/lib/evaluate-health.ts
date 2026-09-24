export interface CheckResult {
  key: string;
  ok: boolean;
  detail: string;
}

const JOBS_TICK_STALE_MINUTES = 5;
const AI_BUDGET_WARN_RATIO = 0.8;
const STORAGE_WARN_RATIO = 0.8;

export function evaluateDatabaseConnectivity(ok: boolean): CheckResult {
  return { key: "database", ok, detail: ok ? "Consulta ao banco funcionando." : "Falha ao consultar o banco." };
}

/** "Último tick de jobs < 5 min" (7.6). */
export function evaluateJobsTick(lastTickAt: string | null, now: Date): CheckResult {
  if (!lastTickAt) return { key: "jobs_tick", ok: false, detail: "Nenhum tick de jobs registrado ainda." };
  const minutesSince = (now.getTime() - new Date(lastTickAt).getTime()) / 60_000;
  return { key: "jobs_tick", ok: minutesSince < JOBS_TICK_STALE_MINUTES, detail: `Último tick há ${minutesSince.toFixed(1)} min.` };
}

/** "Jobs com falha nas últimas 24h" (7.6). */
export function evaluateJobsFailing(failedCount: number): CheckResult {
  return { key: "jobs_failing", ok: failedCount === 0, detail: `${failedCount} job(s) com falha nas últimas 24h.` };
}

/** "Último backup (< 48h)" (7.6) — reaproveita `getBackupStatus.databaseStale` (7.3). */
export function evaluateBackupFresh(databaseStale: boolean): CheckResult {
  return { key: "backup", ok: !databaseStale, detail: databaseStale ? "Backup de banco atrasado (mais de 48h) ou nunca rodou." : "Backup de banco em dia." };
}

/** "Conexão Google ativa" (7.6) — sem nenhuma conexão configurada não é problema (módulo simplesmente não usado); só uma conexão revogada é. */
export function evaluateGoogleConnection(hasRevoked: boolean): CheckResult {
  return {
    key: "google_connection",
    ok: !hasRevoked,
    detail: hasRevoked ? "Conexão com o Google revogada — reconecte em /configuracoes/integracoes." : "Conexão com o Google ativa (ou nunca conectada).",
  };
}

/** "Orçamento de IA acima de 80%" (7.6, `ops_daily_check`) — sem `AI_MONTHLY_BUDGET_USD` configurado, o alerta fica desligado. */
export function evaluateAiBudget(spentUsd: number, budgetUsd: number | undefined): CheckResult | null {
  if (!budgetUsd) return null;
  const ratio = spentUsd / budgetUsd;
  return { key: "ai_budget", ok: ratio < AI_BUDGET_WARN_RATIO, detail: `Gasto de IA em ${(ratio * 100).toFixed(0)}% do orçamento mensal.` };
}

/** "Tokens MCP expirando em 7 dias" (7.6) — resumo pro digest diário; o aviso individual por token já existe (`check_mcp_token_expiry`, 6.9). */
export function evaluateMcpTokensExpiring(count: number): CheckResult {
  return { key: "mcp_tokens_expiring", ok: count === 0, detail: `${count} token(s) MCP expirando em até 7 dias.` };
}

/** "Links compartilhados sem validade antigos" (7.6) — sem `expires_at` e criados há mais de 90 dias. */
export function evaluateOldShareLinks(count: number): CheckResult {
  return { key: "old_share_links", ok: count === 0, detail: `${count} link(s) compartilhado(s) sem validade, criado(s) há mais de 90 dias.` };
}

/** "Uso de Storage perto do limite do plano" (7.6) — sem `STORAGE_PLAN_LIMIT_BYTES` configurado, o alerta fica desligado (não tem como saber o limite do plano sozinho). */
export function evaluateStorageUsage(usedBytes: number, limitBytes: number | undefined): CheckResult | null {
  if (!limitBytes) return null;
  const ratio = usedBytes / limitBytes;
  return { key: "storage_usage", ok: ratio < STORAGE_WARN_RATIO, detail: `Uso de Storage em ${(ratio * 100).toFixed(0)}% do limite configurado.` };
}
